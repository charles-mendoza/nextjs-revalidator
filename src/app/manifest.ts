import type { MetadataRoute } from 'next';

/**
 * Web app manifest (served at /manifest.webmanifest). Dark theme to match the
 * dashboard. Icons reuse the existing PNGs in public/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'nextjs-revalidator',
    short_name: 'Revalidator',
    description: 'On-demand Next.js cache revalidation dashboard.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
