import { NextResponse } from 'next/server';
import { findSite } from '@/lib/store';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Returns a site's Bearer secret so the BROWSER can revalidate it directly.
 * This is only allowed for `preview` (internal) sites, which are revalidated
 * client-side because a serverless deployment can't reach VPN-only hosts.
 *
 * `live` (public) sites are revalidated server-side and their secrets NEVER
 * leave the server — this endpoint refuses them.
 *
 * Auth-gated by middleware (matches /api/sites/:path*).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; siteId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId, siteId } = await params;
  const found = await findSite(user.id, companyId, siteId);
  if (!found) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }
  if (found.site.channel !== 'preview') {
    return NextResponse.json(
      { error: 'Secret is only exposed for client-side (preview) revalidation' },
      { status: 403 }
    );
  }
  return NextResponse.json({ secret: found.site.secret });
}
