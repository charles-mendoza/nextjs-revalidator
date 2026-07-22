import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, readSessionToken } from '@/lib/session-token';
import type { SessionUser } from '@/types';

/**
 * Resolve the authenticated user for the current request from the session cookie.
 * Returns null if there is no valid session. Route handlers use this to scope all
 * data access to the acting user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = await readSessionToken(token);
  if (!payload) return null;
  return { id: payload.uid, username: payload.uname };
}
