import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin (Firestore) initialization for the server-side data store.
 *
 * Credentials are read from the environment:
 *   - FIREBASE_SERVICE_ACCOUNT: the full service-account JSON (raw or base64), OR
 *   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * If no credentials are configured, getDb() returns null and the store falls back
 * to its in-memory implementation. This module is server-only and must never be
 * imported by the Edge middleware.
 */

interface ServiceAccountLike {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

// Cache on globalThis so the instance survives module re-evaluation (dev HMR,
// multiple server bundles). getFirestore() returns a singleton per app, and
// its settings() may only be called once — a module-scoped cache would reset
// and re-trigger settings() on the already-initialized instance ("Firestore has
// already been initialized" error).
const globalForFirebase = globalThis as typeof globalThis & {
  __revalidatorFirestore__?: Firestore | null;
};

function normalizePrivateKey(key: string | undefined): string | undefined {
  // Env vars often store the PEM with literal "\n" sequences; restore real newlines.
  return key ? key.replace(/\\n/g, '\n') : key;
}

function loadServiceAccount(): ServiceAccountLike | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    let json: Record<string, string> | null = null;
    try {
      json = JSON.parse(raw);
    } catch {
      try {
        json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch {
        json = null;
      }
    }
    if (json) {
      return {
        projectId: json.project_id ?? json.projectId,
        clientEmail: json.client_email ?? json.clientEmail,
        privateKey: normalizePrivateKey(json.private_key ?? json.privateKey),
      };
    }
    // Raw was provided but couldn't be parsed — warn instead of silently falling
    // back to the in-memory store (which would look like "data isn't persisting").
    console.warn(
      '[firebase-admin] FIREBASE_SERVICE_ACCOUNT is set but could not be parsed as JSON (or base64 JSON). Firestore is disabled.'
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

/** Firestore instance if Firebase is configured, else null. Cached across calls. */
export function getDb(): Firestore | null {
  if (globalForFirebase.__revalidatorFirestore__ !== undefined) {
    return globalForFirebase.__revalidatorFirestore__;
  }

  const sa = loadServiceAccount();
  if (!sa || !sa.projectId || !sa.clientEmail || !sa.privateKey) {
    globalForFirebase.__revalidatorFirestore__ = null;
    return null;
  }

  const app: App = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: sa.projectId,
          clientEmail: sa.clientEmail,
          privateKey: sa.privateKey,
        }),
      });

  const db = getFirestore(app);
  // Site entries carry optional last* fields; ignore undefined so writes don't throw.
  // settings() may only be called once per Firestore instance and only before any
  // other use — guard it so a re-init on an already-used instance can't crash.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already initialized/used (e.g. reused across a reload) — safe to ignore.
  }
  globalForFirebase.__revalidatorFirestore__ = db;
  return db;
}

export function isFirestoreConfigured(): boolean {
  return getDb() !== null;
}
