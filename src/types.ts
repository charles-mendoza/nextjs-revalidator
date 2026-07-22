export type Environment = 'dev' | 'uat' | 'prod' | string;
export type Channel = 'preview' | 'live' | string;

/** The authenticated user, as exposed to the browser (no credentials). */
export interface SessionUser {
  id: string;
  username: string;
}

/**
 * How a revalidation request is routed:
 *  - 'auto'   → decided by channel (preview → client, live → server)
 *  - 'client' → forced client-side (browser POSTs the target directly)
 *  - 'server' → forced server-side (via the /api/revalidate proxy)
 */
export type RevalidateMode = 'auto' | 'client' | 'server';

/**
 * JSON body POSTed to a target site's revalidate endpoint. Shapes the CMS supports:
 *   { all: true }                 // invalidate every CMS domain (default)
 *   { tags: ['cms:main-expanded'] } // invalidate specific tag(s)
 * Kept as an open object so fully custom bodies are allowed.
 */
export type RevalidatePayload = Record<string, unknown>;

export const DEFAULT_REVALIDATE_PAYLOAD: RevalidatePayload = { all: true };

/**
 * Full site entry as stored server-side. The `secret` field NEVER leaves the server.
 */
export interface SiteEntry {
  id: string;
  url: string;
  secret: string;
  environment: Environment;
  channel: Channel;
  lastRevalidatedAt?: string;
  lastStatus?: number;
  lastStatusText?: string;
  lastDurationMs?: number;
  lastResponseSnippet?: string;
  lastOk?: boolean;
}

/**
 * Site entry as sent to the browser — identical to SiteEntry but with `secret` removed.
 * `hasSecret` lets the UI show a masked placeholder without ever exposing the value.
 */
export type PublicSiteEntry = Omit<SiteEntry, 'secret'> & { hasSecret: boolean };

export interface CompanyGroup {
  id: string;
  name: string;
  sites: SiteEntry[];
}

export interface PublicCompanyGroup {
  id: string;
  name: string;
  sites: PublicSiteEntry[];
}

export interface RevalidateResult {
  ok: boolean;
  status: number;
  statusText: string;
  data?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
}
