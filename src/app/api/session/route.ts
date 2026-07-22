import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/** Lightweight auth-state check for the client to hydrate its UI. */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    authenticated: Boolean(user),
    username: user?.username ?? null,
  });
}
