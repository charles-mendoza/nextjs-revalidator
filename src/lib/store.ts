import 'server-only';
import { randomBytes } from 'crypto';
import type { CompanyGroup, PublicCompanyGroup, SiteEntry } from '@/types';
import { getDb } from '@/lib/firebase-admin';

/**
 * Server-side data store for companies and their site environments, SCOPED PER USER.
 *
 * Two backends, chosen at runtime:
 *   - Firestore (Firebase Admin) when configured — persistent, path
 *     `users/{userId}/companies/{companyId}`; each doc holds { name, sites[] }.
 *   - In-memory fallback otherwise — resets on restart; seeds one user (SEED_USER).
 *
 * All exported functions are async and take `userId` first. Secrets stored here
 * NEVER leave the server; callers returning data to the browser must use
 * `toPublic()` / the getPublic* helpers to strip `secret`.
 */

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

function seedCompanies(): CompanyGroup[] {
  return [
    {
      id: 'example-group',
      name: 'Example',
      sites: [
        {
          id: 'example-prod-live',
          url: 'https://example.com/api/revalidate',
          secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          environment: 'prod',
          channel: 'live',
        },
      ],
    },
  ];
}

const dataByUser: Record<string, CompanyGroup[]> = {};

function seedUserId(): string | undefined {
  return process.env.SEED_USER || process.env.ADMIN_USERNAME || undefined;
}

function memUserData(userId: string): CompanyGroup[] {
  if (!dataByUser[userId]) {
    dataByUser[userId] = userId === seedUserId() ? seedCompanies() : [];
  }
  return dataByUser[userId];
}

// ---------------------------------------------------------------------------
// Firestore backend
// ---------------------------------------------------------------------------

function companiesCol(userId: string) {
  return getDb()!.collection('users').doc(userId).collection('companies');
}

async function fsGetCompanies(userId: string): Promise<CompanyGroup[]> {
  const snap = await companiesCol(userId).get();
  return snap.docs.map((d) => ({
    id: d.id,
    name: (d.get('name') as string) ?? '',
    sites: ((d.get('sites') as SiteEntry[]) ?? []),
  }));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(5).toString('hex')}`;
}

/** Strip secrets before returning company data to the client. */
export function toPublic(list: CompanyGroup[]): PublicCompanyGroup[] {
  return list.map((company) => ({
    id: company.id,
    name: company.name,
    sites: company.sites.map(({ secret, ...rest }) => ({
      ...rest,
      hasSecret: Boolean(secret),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Public API (async; Firestore when configured, else in-memory)
// ---------------------------------------------------------------------------

/** A user's companies with full (secret-bearing) entries — server use only. */
export async function getCompanies(userId: string): Promise<CompanyGroup[]> {
  if (getDb()) return fsGetCompanies(userId);
  return memUserData(userId);
}

/** A user's companies with secrets stripped — safe to send to the browser. */
export async function getPublicCompanies(userId: string): Promise<PublicCompanyGroup[]> {
  return toPublic(await getCompanies(userId));
}

/** Look up one of the user's sites (including secret) by company + site id. */
export async function findSite(
  userId: string,
  companyId: string,
  siteId: string
): Promise<{ company: CompanyGroup; site: SiteEntry } | null> {
  if (getDb()) {
    const doc = await companiesCol(userId).doc(companyId).get();
    if (!doc.exists) return null;
    const company: CompanyGroup = {
      id: doc.id,
      name: (doc.get('name') as string) ?? '',
      sites: ((doc.get('sites') as SiteEntry[]) ?? []),
    };
    const site = company.sites.find((s) => s.id === siteId);
    return site ? { company, site } : null;
  }

  const company = memUserData(userId).find((c) => c.id === companyId);
  if (!company) return null;
  const site = company.sites.find((s) => s.id === siteId);
  return site ? { company, site } : null;
}

export interface AddSiteInput {
  companyName: string;
  url: string;
  secret: string;
  environment?: string;
  channel?: string;
}

/** Add a site to one of the user's companies (matched by name) or create one. */
export async function addSite(
  userId: string,
  input: AddSiteInput
): Promise<PublicCompanyGroup[]> {
  const normalizedName = input.companyName.trim();
  const newSite: SiteEntry = {
    id: genId('site'),
    url: input.url.trim(),
    secret: input.secret.trim(),
    environment: input.environment || 'dev',
    channel: input.channel || 'preview',
  };

  if (getDb()) {
    const col = companiesCol(userId);
    const existing = (await fsGetCompanies(userId)).find(
      (c) => c.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (existing) {
      await col.doc(existing.id).update({ sites: [...existing.sites, newSite] });
    } else {
      await col.add({ name: normalizedName, sites: [newSite] });
    }
    return toPublic(await fsGetCompanies(userId));
  }

  const companies = memUserData(userId);
  const existing = companies.find(
    (c) => c.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) {
    existing.sites.push(newSite);
  } else {
    companies.push({ id: genId('company'), name: normalizedName, sites: [newSite] });
  }
  return toPublic(companies);
}

/** Delete one of the user's companies, or a single site within it. */
export async function deleteEntry(
  userId: string,
  companyId: string,
  siteId?: string
): Promise<PublicCompanyGroup[]> {
  if (getDb()) {
    const col = companiesCol(userId);
    const doc = await col.doc(companyId).get();
    if (doc.exists) {
      if (siteId) {
        const remaining = ((doc.get('sites') as SiteEntry[]) ?? []).filter(
          (s) => s.id !== siteId
        );
        if (remaining.length === 0) {
          await col.doc(companyId).delete();
        } else {
          await col.doc(companyId).update({ sites: remaining });
        }
      } else {
        await col.doc(companyId).delete();
      }
    }
    return toPublic(await fsGetCompanies(userId));
  }

  let companies = memUserData(userId);
  if (siteId) {
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      company.sites = company.sites.filter((s) => s.id !== siteId);
      if (company.sites.length === 0) {
        companies = companies.filter((c) => c.id !== companyId);
      }
    }
  } else {
    companies = companies.filter((c) => c.id !== companyId);
  }
  dataByUser[userId] = companies;
  return toPublic(companies);
}

/** Record the outcome of a revalidation against one of the user's sites. */
export async function recordRevalidation(
  userId: string,
  companyId: string,
  siteId: string,
  result: {
    ok: boolean;
    status: number;
    statusText: string;
    durationMs: number;
    snippet?: string;
  }
): Promise<void> {
  const patch = {
    lastOk: result.ok,
    lastStatus: result.status,
    lastStatusText: result.statusText,
    lastDurationMs: result.durationMs,
    lastResponseSnippet: result.snippet,
    lastRevalidatedAt: new Date().toISOString(),
  };

  if (getDb()) {
    const col = companiesCol(userId);
    const doc = await col.doc(companyId).get();
    if (!doc.exists) return;
    const sites = ((doc.get('sites') as SiteEntry[]) ?? []).map((s) =>
      s.id === siteId ? { ...s, ...patch } : s
    );
    await col.doc(companyId).update({ sites });
    return;
  }

  const found = await findSite(userId, companyId, siteId);
  if (!found) return;
  Object.assign(found.site, patch);
}
