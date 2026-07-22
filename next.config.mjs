/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-hosted deployment: build a standalone server bundle so it can run
  // inside the corporate network / VPN and reach internal revalidate targets.
  output: 'standalone',
  reactStrictMode: true,
  // Keep firebase-admin out of the bundler. It uses dynamic requires + native/
  // gRPC deps that break when bundled; treat it as an external Node module.
  serverExternalPackages: ['firebase-admin'],
  async headers() {
    return [
      {
        // The service worker must not be aggressively cached, and needs a
        // root scope so it can control the whole origin.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
