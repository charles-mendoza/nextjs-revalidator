# nextjs-revalidator

A PWA dashboard for triggering on-demand Next.js cache revalidation
across multiple sites and their environments (dev/uat/prod × preview/live).
Built with **Next.js (App Router)** and React 19.

## Revalidation model (hybrid, keyed on `channel`)

The dashboard revalidates a site one of two ways depending on its `channel`, so it
can reach both public and internal/VPN-only targets:

- **`live` (public) → server-side.** The browser sends `{ companyId, siteId }` to
  `/api/revalidate`; the server looks up the URL + secret and makes the outbound
  POST. The secret never leaves the server.
- **`preview` (internal) → client-side.** The browser POSTs to the target directly
  (so it works for VPN-only hosts, as long as **the user is connected to the VPN**).
  The secret is fetched on demand from `/api/sites/[companyId]/[siteId]/secret` just
  before the call.

Why: a serverless deployment cannot route to VPN-only hosts, but the user's browser
(on the VPN) can. See the security note below for the tradeoff this implies.

## Security model

- **Auth**: multi-user login (Firebase Authentication, or env users for local dev —
  see below) issues an HMAC-signed HttpOnly session cookie carrying the user id. All
  data + revalidation endpoints (including the preview-secret endpoint) are gated by
  `middleware.ts`, and all data is scoped per user. Login fails closed if no users
  are configured — there are no default credentials, and no in-app registration.
- **Secrets**: `live`-channel secrets are **never** sent to the browser — the site
  list (`GET /api/sites`) is always secret-stripped. `preview`-channel secrets are
  deliberately exposed to authenticated browsers (only on demand, only for preview
  sites) because client-side revalidation requires the browser to send the Bearer
  token. The secret endpoint refuses to return secrets for `live` sites.
- **SSRF protection** (`lib/ssrf.ts`): the **server-side** (`live`) path validates
  targets with an allowlist model — cloud-metadata / loopback / link-local are
  always blocked; private/internal ranges are blocked unless permitted via
  `REVALIDATE_ALLOWED_HOSTS`. The **client-side** (`preview`) path only checks the
  URL is well-formed http(s), since the server never calls it.

> **CORS caveat for preview sites:** client-side revalidation is cross-origin. The
> target endpoint must return CORS headers for this app's origin, or the browser
> will block reading the response (the dashboard then reports a failed fetch even if
> the target may have processed the request).

## Deployment

Works both self-hosted and on serverless (e.g. Vercel):

- **Serverless (Vercel):** `live`/public sites revalidate server-side; `preview`/
  internal sites revalidate client-side from the user's VPN-connected browser.
- **Self-hosted inside the network/VPN:** both paths work, and preview sites could
  also be reached server-side if you prefer (change their channel to `live` and add
  their host/CIDR to `REVALIDATE_ALLOWED_HOSTS`).

`next.config.mjs` sets `output: 'standalone'` for a self-contained server bundle
(harmless on Vercel).

## PWA

The app is an installable PWA (manifest at `src/app/manifest.ts` → `/manifest.webmanifest`,
icons in `public/`, dark theme). A hand-rolled service worker (`public/sw.js`, registered
by `src/components/ServiceWorkerRegister.tsx`) provides installability and an offline
fallback (`/offline`). It **never caches `/api/*`** or non-GET requests, so live data and
secrets are never persisted; navigations are network-first with an offline fallback and
static assets use stale-while-revalidate. The service worker registers only in production
builds (`npm run build && npm run start`), not `npm run dev`.

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set required variables.
3. Run the dev server: `npm run dev`

## Scripts

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build (standalone)
- `npm run start` — run the production server
- `npm run lint` — ESLint (`next lint`)
- `npm run typecheck` — `tsc --noEmit`
