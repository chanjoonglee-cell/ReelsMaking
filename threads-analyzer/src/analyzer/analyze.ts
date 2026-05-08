import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  analysisSchema,
  SYSTEM_PROMPT,
  buildUserPrompt,
  accountSummarySchema,
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryUserPrompt,
} from './prompts';
import type { Account, AccountSummary, Analysis, Post } from '../types';

export type AnalyzerModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'claude-opus-4-7';

export const DEFAULT_MODEL: AnalyzerModel = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

async function analyzePost(
  args: {
    post: Post;
    handle: string;
    displayName: string;
    followers: number;
    model: AnalyzerModel;
  },
  signal?: AbortSignal,
): Promise<Analysis> {
  const client = getClient();
  const response = await client.messages.parse(
    {
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
    },
    { signal },
  );

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
  signal?: AbortSignal,
): Promise<void> {
  const total = account.posts.length;
  onProgress?.({ type: 'start', total });

  await Promise.all(
    account.posts.map(async (post, i) => {
      try {
        const analysis = await analyzePost(
          {
            post,
            handle: account.handle,
            displayName: account.displayName,
            followers: account.followers,
            model,
          },
          signal,
        );
        account.posts[i] = { ...post, analysis };
        onProgress?.({ type: 'done', index: i + 1, total, postId: post.id });
      } catch (err) {
        const message = (err as Error).message;
        onProgress?.({ type: 'error', index: i + 1, total, postId: post.id, message });
      }
    }),
  );
}

// Account-level synthesis. Runs after per-post analyses; needs at least one
// successful analysis to have something to synthesize from.
export async function synthesizeAccount(
  account: Account,
  model: AnalyzerModel,
  signal?: AbortSignal,
): Promise<AccountSummary> {
  const analyzedCount = account.posts.filter((p) => p.analysis).length;
  if (analyzedCount === 0) {
    throw new Error('synthesis skipped: no analyzed posts');
  }

  const client = getClient();
  const response = await client.messages.parse(
    {
      model,
      // Synthesis ouput is small (~600-1200 tokens) but the input grows with
      // post count; allow generous output room.
      max_tokens: 2000,
      // Bump to `high` effort: this is the single highest-value call of the run.
      output_config: {
        effort: 'high',
        format: zodOutputFormat(accountSummarySchema),
      },
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildSummaryUserPrompt(account) }],
    },
    { signal },
  );

  if (!response.parsed_output) {
    throw new Error(`synthesis parse failed (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}
