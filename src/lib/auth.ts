import 'server-only';
import { timingSafeEqual } from 'crypto';
import type { SessionUser } from '@/types';

/**
 * User provider + credential verification (Node-only; used by the login route).
 *
 * Two backends, chosen by configuration:
 *   1. Firebase Authentication (email/password) — when FIREBASE_API_KEY is set.
 *      Passwords are verified via the Identity Toolkit REST API; users are managed
 *      entirely in the Firebase console. This is the intended production path.
 *   2. Env users — APP_USERS JSON (or legacy ADMIN_USERNAME/ADMIN_PASSWORD).
 *      Used for local dev when Firebase isn't configured.
 *
 * There is NO self-registration in either case.
 */

interface EnvUser {
  id: string;
  username: string;
  password: string;
}

function firebaseAuthConfigured(): boolean {
  return Boolean(process.env.FIREBASE_API_KEY);
}

function loadEnvUsers(): EnvUser[] {
  const raw = process.env.APP_USERS;
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (u) =>
              u && typeof u.username === 'string' && typeof u.password === 'string'
          )
          .map((u) => ({
            id: String(u.id ?? u.username).trim(),
            username: String(u.username).trim(),
            password: String(u.password),
          }))
          .filter((u) => u.id && u.username);
      }
    } catch {
      // malformed APP_USERS — fall through to legacy single-user
    }
  }

  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (u && p) return [{ id: u, username: u, password: p }];
  return [];
}

export function isAuthConfigured(): boolean {
  return firebaseAuthConfigured() || loadEnvUsers().length > 0;
}

/** Returns the matching user, or null. Async because Firebase verification is a network call. */
export async function verifyUser(
  username: string,
  password: string
): Promise<SessionUser | null> {
  if (firebaseAuthConfigured()) {
    return verifyFirebaseUser(username, password);
  }
  return verifyEnvUser(username, password);
}

/** Verify email/password against Firebase Authentication via the Identity Toolkit REST API. */
async function verifyFirebaseUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !email || !password) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    if (!res.ok) return null; // invalid credentials / disabled user / etc.
    const data = (await res.json()) as { localId?: string; email?: string };
    if (!data.localId) return null;
    return { id: data.localId, username: data.email ?? email };
  } catch {
    return null;
  }
}

function verifyEnvUser(username: string, password: string): SessionUser | null {
  let matched: SessionUser | null = null;
  // Check every user (no early return) to avoid leaking which field matched via timing.
  for (const user of loadEnvUsers()) {
    if (safeEqual(username, user.username) && safeEqual(password, user.password)) {
      matched = { id: user.id, username: user.username };
    }
  }
  return matched;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
