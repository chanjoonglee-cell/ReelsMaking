import { NextRequest } from 'next/server';
import { listCached, loadAccount } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/cached            → list of cached handles
// GET /api/cached?handle=foo → full Account JSON (404 if missing)
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');

  if (!handle) {
    const entries = await listCached();
    return Response.json({ entries });
  }

  try {
    const account = await loadAccount(handle.replace(/^@/, ''));
    if (!account) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json(account);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
