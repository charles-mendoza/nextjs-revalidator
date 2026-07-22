import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAuthConfigured, verifyUser } from '@/lib/auth';
import {
  SESSION_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
} from '@/lib/session-token';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { success: false, message: 'Authentication is not configured on the server.' },
      { status: 500 }
    );
  }

  const user = await verifyUser(username ?? '', password ?? '');
  if (!user) {
    return NextResponse.json(
      { success: false, message: 'Invalid username or password' },
      { status: 401 }
    );
  }

  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  const payload = await readSessionToken(token);
  return NextResponse.json({
    success: true,
    username: user.username,
    expiresAt: payload?.exp ?? null, // ms epoch; client schedules auto-logout on this
  });
}
