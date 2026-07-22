import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, readSessionToken } from '@/lib/session-token';

export const runtime = 'nodejs';

/** Lightweight auth-state check for the client to hydrate its UI. */
export async function GET() {
  const store = await cookies();
  const payload = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    authenticated: Boolean(payload),
    username: payload?.uname ?? null,
    expiresAt: payload?.exp ?? null, // ms epoch; client schedules auto-logout on this
  });
}
