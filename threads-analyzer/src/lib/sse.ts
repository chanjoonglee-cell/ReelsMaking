// Wire format helpers for Server-Sent Events emitted by /api/analyze.
// Each event has a typed name and a JSON-encoded payload.

export type AnalyzeEvent =
  | { event: 'progress'; data: ProgressData }
  | { event: 'account'; data: import('../types').Account }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: { handle: string; savedTo: string | null } };

export type ProgressData = {
  stage: 'scraping' | 'analyzing' | 'saving';
  message: string;
  // Optional counters when the stage is iterative.
  index?: number;
  total?: number;
};

const encoder = new TextEncoder();

export function formatSse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
