import { NextResponse } from 'next/server';
import { addSite, getPublicCompanies } from '@/lib/store';
import { getSessionUser } from '@/lib/session';
import { UnsafeUrlError, assertSafeRevalidateUrl, assertValidHttpUrl } from '@/lib/ssrf';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Secrets are stripped by getPublicCompanies() — never sent to the browser.
  return NextResponse.json({ sites: await getPublicCompanies(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { companyName, url, secret, environment, channel } = body as {
    companyName?: string;
    url?: string;
    secret?: string;
    environment?: string;
    channel?: string;
  };

  if (!companyName?.trim() || !url?.trim() || !secret?.trim()) {
    return NextResponse.json(
      { error: 'companyName, url, and secret are required' },
      { status: 400 }
    );
  }

  // Validation depends on how the site will be revalidated:
  //  - preview (internal) → revalidated client-side; server never calls it, so only
  //    check the URL is well-formed (internal hosts may not resolve server-side).
  //  - live (public) → revalidated server-side; enforce the full SSRF allowlist.
  const effectiveChannel = channel || 'preview';
  try {
    if (effectiveChannel === 'live') {
      await assertSafeRevalidateUrl(url.trim());
    } else {
      assertValidHttpUrl(url.trim());
    }
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const sites = await addSite(user.id, { companyName, url, secret, environment, channel });
  return NextResponse.json({ success: true, sites });
}
