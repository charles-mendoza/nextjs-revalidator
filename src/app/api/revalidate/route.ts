import { NextResponse } from 'next/server';
import { findSite, recordRevalidation } from '@/lib/store';
import { getSessionUser } from '@/lib/session';
import { UnsafeUrlError, assertSafeRevalidateUrl } from '@/lib/ssrf';
import { DEFAULT_REVALIDATE_PAYLOAD, type RevalidatePayload, type RevalidateResult } from '@/types';

export const runtime = 'nodejs';

const TIMEOUT_MS = 12000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Server-side revalidation proxy. The client sends { companyId, siteId, payload };
 * the URL and secret are looked up server-side so the secret never reaches the
 * browser. `payload` is the JSON body forwarded to the target (default { all: true }).
 * The target is re-validated against the SSRF allowlist at request time.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { companyId, siteId, payload } = body as {
    companyId?: string;
    siteId?: string;
    payload?: unknown;
  };

  if (!companyId || !siteId) {
    return NextResponse.json(
      { ok: false, error: 'companyId and siteId are required' },
      { status: 400 }
    );
  }

  if (payload !== undefined && !isPlainObject(payload)) {
    return NextResponse.json(
      { ok: false, error: 'payload must be a JSON object' },
      { status: 400 }
    );
  }
  const outboundBody: RevalidatePayload = isPlainObject(payload)
    ? payload
    : DEFAULT_REVALIDATE_PAYLOAD;

  const found = await findSite(user.id, companyId, siteId);
  if (!found) {
    return NextResponse.json({ ok: false, error: 'Site not found' }, { status: 404 });
  }
  const { site } = found;

  // Re-check the stored URL against the SSRF allowlist (defends against
  // DNS-rebinding and any allowlist change since the site was added).
  try {
    await assertSafeRevalidateUrl(site.url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    throw err;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(site.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${site.secret}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Nextjs-Revalidator/2.0',
      },
      body: JSON.stringify(outboundBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    const responseText = await response.text();
    let parsedData: unknown = responseText;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // keep raw string
    }

    const result: RevalidateResult = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || (response.ok ? 'OK' : `HTTP ${response.status}`),
      data: parsedData,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    await recordRevalidation(user.id, companyId, siteId, {
      ok: result.ok,
      status: result.status,
      statusText: result.statusText,
      durationMs,
      snippet: responseText.slice(0, 500),
    });

    return NextResponse.json(result);
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const result: RevalidateResult = {
      ok: false,
      status: isAbort ? 504 : 502,
      statusText: isAbort ? 'Gateway Timeout (12s)' : 'Fetch Failed',
      error:
        err instanceof Error ? err.message : 'Could not complete POST request to target server',
      durationMs,
      timestamp: new Date().toISOString(),
    };
    await recordRevalidation(user.id, companyId, siteId, {
      ok: false,
      status: result.status,
      statusText: result.statusText,
      durationMs,
    });
    return NextResponse.json(result);
  }
}
