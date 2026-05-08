import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  analysisSchema,
  SYSTEM_PROMPT,
  buildUserPrompt,
  accountSummarySchema,
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryUserPrompt,
} from './prompts';
import type { Account, AccountSummary, Analysis, Post } from '../types';

// Allowed values are not enumerated as a strict type because OpenAI may release
// newer models we want to point at without a code change. The route validates
// against ALLOWED_MODELS.
export type AnalyzerModel = string;

// gpt-4o is the cost/quality default. gpt-4o-mini is ~20x cheaper but visibly
// shallower on the synthesis call. Both support structured outputs.
export const DEFAULT_MODEL: AnalyzerModel = 'gpt-4o';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI();
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
  const completion = await client.chat.completions.parse(
    {
      model: args.model,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
      response_format: zodResponseFormat(analysisSchema, 'post_analysis'),
    },
    { signal },
  );

  const choice = completion.choices[0];
  if (!choice?.message.parsed) {
    throw new Error(
      `analysis parse failed (finish_reason=${choice?.finish_reason ?? 'unknown'}; refusal=${choice?.message.refusal ?? 'none'})`,
    );
  }
  return choice.message.parsed;
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
  const completion = await client.chat.completions.parse(
    {
      model,
      // Synthesis output is small (~600-1200 tokens) but the input grows with
      // post count; allow generous output room.
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: buildSummaryUserPrompt(account) },
      ],
      response_format: zodResponseFormat(accountSummarySchema, 'account_summary'),
    },
    { signal },
  );

  const choice = completion.choices[0];
  if (!choice?.message.parsed) {
    throw new Error(
      `synthesis parse failed (finish_reason=${choice?.finish_reason ?? 'unknown'}; refusal=${choice?.message.refusal ?? 'none'})`,
    );
  }
  return choice.message.parsed;
}
