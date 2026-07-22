import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  applicationName: 'nextjs-revalidator',
  title: 'nextjs-revalidator',
  description: 'A dashboard web app for triggering on-demand Next.js cache revalidation.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Revalidator',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    title: 'nextjs-revalidator',
    description: 'A dashboard web app for triggering on-demand Next.js cache revalidation.',
    siteName: 'nextjs-revalidator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'nextjs-revalidator',
    description: 'A dashboard web app for triggering on-demand Next.js cache revalidation.',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
