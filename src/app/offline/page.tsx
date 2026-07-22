import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline — nextjs-revalidator',
};

/**
 * Static offline fallback shown by the service worker when a navigation fails
 * with no network. No data fetching — must be precacheable and unauthenticated.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full text-center space-y-5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 shadow-xl">
        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-amber-400"></span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">You&apos;re offline</h1>
          <p className="text-xs text-zinc-400 mt-2 font-mono">
            nextjs-revalidator needs a network connection to load sites and trigger
            revalidation. Reconnect and try again.
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-colors"
        >
          Retry
        </a>
      </div>
    </div>
  );
}
