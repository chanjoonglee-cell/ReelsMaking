import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { analysisSchema, SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { Account, Analysis, Post } from '../types';

export type AnalyzerModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'claude-opus-4-7';

export const DEFAULT_MODEL: AnalyzerModel = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

async function analyzePost(args: {
  post: Post;
  handle: string;
  displayName: string;
  followers: number;
  model: AnalyzerModel;
}): Promise<Analysis> {
  const client = getClient();
  const response = await client.messages.parse({
    model: args.model,
    max_tokens: 2000,
    // Sonnet 4.6 default effort is `high`; analysis quality is fine at `medium`
    // and we save ~30-40% tokens, which matters when fanning out across 10 posts.
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(analysisSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({
          post: args.post,
          followers: args.followers,
          handle: args.handle,
          displayName: args.displayName,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error(`analysis parse failed (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}

export type AnalyzeProgress =
  | { type: 'start'; total: number }
  | { type: 'done'; index: number; total: number; postId: string }
  | { type: 'error'; index: number; total: number; postId: string; message: string };

// Mutates account.posts[i].analysis in place. Errors on individual posts are
// surfaced via onProgress and recorded as an undefined analysis — one bad
// post must not kill the run.
export async function analyzePostsParallel(
  account: Account,
  model: AnalyzerModel,
  onProgress?: (p: AnalyzeProgress) => void,
): Promise<void> {
  const total = account.posts.length;
  onProgress?.({ type: 'start', total });

  await Promise.all(
    account.posts.map(async (post, i) => {
      try {
        const analysis = await analyzePost({
          post,
          handle: account.handle,
          displayName: account.displayName,
          followers: account.followers,
          model,
        });
        account.posts[i] = { ...post, analysis };
        onProgress?.({ type: 'done', index: i + 1, total, postId: post.id });
      } catch (err) {
        const message = (err as Error).message;
        onProgress?.({ type: 'error', index: i + 1, total, postId: post.id, message });
      }
    }),
  );
}
