/**
 * Edge-safe session token signing/verification using Web Crypto (works in both
 * the Next.js middleware Edge runtime and Node route handlers). No node:crypto,
 * so this module must NOT be marked `server-only` — it's imported by middleware.
 */

export const SESSION_COOKIE = 'revalidator_session';

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET is not configured (must be at least 16 chars). Refusing to issue sessions.'
    );
  }
  return secret;
}

export function sessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8 * 60 * 60; // 8h default
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: sessionMaxAgeSeconds(),
  };
}

export interface SessionPayload {
  uid: string;
  uname: string;
  exp: number; // ms epoch
}

function b64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringFromB64url(str: string): string {
  return new TextDecoder().decode(fromB64url(str));
}

function fromB64url(str: string): ArrayBuffer {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function hmacKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey(['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(sig);
}

/**
 * `<b64url(payloadJSON)>.<hmac>` — the HMAC binds the whole payload (user id +
 * expiry) so the client can neither extend the session nor swap the user.
 */
export async function createSessionToken(user: { id: string; username: string }): Promise<string> {
  const payload: SessionPayload = {
    uid: user.id,
    uname: user.username,
    exp: Date.now() + sessionMaxAgeSeconds() * 1000,
  };
  const encoded = b64urlFromString(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded)}`;
}

/** Verify signature + expiry and return the decoded payload, or null. */
export async function readSessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let sigBytes: ArrayBuffer;
  try {
    sigBytes = fromB64url(providedSig);
  } catch {
    return null;
  }

  const key = await hmacKey(['verify']);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(encoded)
  );
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(stringFromB64url(encoded));
  } catch {
    return null;
  }
  if (!payload || typeof payload.uid !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }
  if (Date.now() >= payload.exp) return null;
  return payload;
}

/** Constant-time signature + expiry check (boolean). Used by middleware. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return (await readSessionToken(token)) !== null;
}
