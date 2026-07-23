'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DEFAULT_REVALIDATE_PAYLOAD,
  PublicCompanyGroup,
  PublicSiteEntry,
  RevalidateMode,
  RevalidatePayload,
  RevalidateResult,
} from '@/types';
import { Navbar } from './Navbar';
import { CompanyCard } from './CompanyCard';
import { AddSiteModal } from './AddSiteModal';
import { LoginPromptModal } from './LoginPromptModal';
import {
  Search,
  Plus,
  RefreshCw,
  Sparkles,
  Globe,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Server,
  Layers,
} from 'lucide-react';

const CLIENT_TIMEOUT_MS = 12000;

/**
 * Revalidate an internal (preview-channel) site directly from the browser.
 * The browser must be on the VPN to reach the target. The secret is fetched
 * on demand from our (auth-gated) server just before the call. CORS on the
 * target endpoint is the caller's responsibility — a blocked request surfaces
 * here as a "Client Fetch Failed" result.
 */
async function revalidateInternalFromBrowser(
  companyId: string,
  site: PublicSiteEntry,
  payload: RevalidatePayload
): Promise<RevalidateResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const secretRes = await fetch(`/api/sites/${companyId}/${site.id}/secret`);
    if (!secretRes.ok) {
      if (secretRes.status === 403) {
        throw new Error(
          'Live-site secrets are kept server-side — use Server-side or Automatic for this site'
        );
      }
      throw new Error('Could not load secret for client-side revalidation');
    }
    const { secret } = await secretRes.json();

    const response = await fetch(site.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw string
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || (response.ok ? 'OK' : `HTTP ${response.status}`),
      data,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      status: isAbort ? 504 : 0,
      statusText: isAbort ? 'Gateway Timeout (12s)' : 'Client Fetch Failed (network/CORS/VPN)',
      error: err?.message || 'Request failed',
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }
}

export function Dashboard() {
  const [companies, setCompanies] = useState<PublicCompanyGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  // ms-epoch expiry of the current session; drives the client-side auto-logout timer.
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [prefilledCompany, setPrefilledCompany] = useState<string>('');
  const [isLoadingSites, setIsLoadingSites] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Authenticate against the server; the server sets an HttpOnly session cookie.
  const authenticateCredentials = async (u: string, p: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setUsername(data.username || u);
        setSessionExpiresAt(data.expiresAt ?? null);
        setIsAuthModalOpen(false);
        setAuthError('');
        showToast(`Login successful! Welcome, ${data.username || u}`, 'success');
        fetchSites();
        return true;
      }
      setAuthError(data.message || 'Invalid username or password');
      return false;
    } catch {
      setAuthError('Error communicating with authentication server');
      return false;
    }
  };

  // On load, ask the server whether we already have a valid session cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (cancelled) return;
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUsername(data.username || '');
          setSessionExpiresAt(data.expiresAt ?? null);
          fetchSites();
        } else {
          setIsLoadingSites(false);
          setIsAuthModalOpen(true);
        }
      } catch {
        if (!cancelled) {
          setIsLoadingSites(false);
          setIsAuthModalOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSites = async () => {
    setIsLoadingSites(true);
    try {
      const res = await fetch('/api/sites');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.sites || []);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        setSessionExpiresAt(null);
        setIsAuthModalOpen(true);
      }
    } catch (e) {
      console.error('Error fetching sites:', e);
    } finally {
      setIsLoadingSites(false);
    }
  };

  // Clear the server cookie + all client auth state and return to the login screen.
  // Silent: no toast/warning. Reused by both manual logout and the auto-logout timer.
  const autoLogout = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // ignore network errors — clear client state regardless
    }
    setIsAuthenticated(false);
    setUsername('');
    setSessionExpiresAt(null);
    setCompanies([]);
    setSearchQuery('');
    setIsAuthModalOpen(true);
  }, []);

  // Manual logout (so a different user can sign in) — same as auto-logout, with a toast.
  const handleLogout = async () => {
    await autoLogout();
    showToast('Signed out', 'info');
  };

  // Client-side expiry timer: silently auto-logs-out the moment the session token
  // expires, without any advance warning. Re-armed whenever the expiry changes.
  useEffect(() => {
    if (!isAuthenticated || sessionExpiresAt == null) return;
    const msUntilExpiry = sessionExpiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      autoLogout();
      return;
    }
    // setTimeout delays are clamped to a 32-bit signed int (~24.8 days); the session
    // max-age is far below this, but cap defensively so a huge value can't overflow.
    const delay = Math.min(msUntilExpiry, 2_147_483_647);
    const id = setTimeout(autoLogout, delay);
    return () => clearTimeout(id);
  }, [isAuthenticated, sessionExpiresAt, autoLogout]);

  // Hybrid revalidation, routed by `mode`:
  //  - 'auto'   → by channel (preview → client-side, live → server-side)
  //  - 'client' → browser POSTs the target directly (needs the user on the VPN for
  //               internal hosts; fetches the secret on demand)
  //  - 'server' → server-side proxy; secret stays server-side
  const handleRevalidateSite = async (
    companyId: string,
    site: PublicSiteEntry,
    mode: RevalidateMode = 'auto',
    payload: RevalidatePayload = DEFAULT_REVALIDATE_PAYLOAD
  ): Promise<RevalidateResult> => {
    const resolved = mode === 'auto' ? (site.channel === 'preview' ? 'client' : 'server') : mode;

    let result: RevalidateResult;
    if (resolved === 'client') {
      result = await revalidateInternalFromBrowser(companyId, site, payload);
    } else {
      const res = await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, siteId: site.id, payload }),
      });
      result = await res.json();
    }
    if (result.ok) {
      showToast(
        `Revalidated ${site.environment} (${site.channel}) - ${result.status} ${result.statusText}`,
        'success'
      );
    } else {
      showToast(
        `Failed ${site.environment} (${site.channel}) - ${result.status} ${result.statusText}`,
        'error'
      );
    }
    return result;
  };

  const handleAddSite = async (newSiteData: {
    companyName: string;
    url: string;
    secret: string;
    environment: string;
    channel: string;
  }) => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSiteData),
    });
    if (res.ok) {
      const data = await res.json();
      setCompanies(data.sites || []);
      showToast(`Added ${newSiteData.companyName} (${newSiteData.environment}) successfully!`, 'success');
    } else {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save site');
    }
  };

  const handleDeleteSite = async (companyId: string, siteId: string) => {
    if (!window.confirm('Are you sure you want to remove this site environment?')) {
      return;
    }
    const res = await fetch(`/api/sites/${companyId}/${siteId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setCompanies(data.sites || []);
      showToast('Environment site removed', 'info');
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm('Are you sure you want to delete this company and all its environments?')) {
      return;
    }
    const res = await fetch(`/api/sites/${companyId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setCompanies(data.sites || []);
      showToast('Company group removed', 'info');
    }
  };

  const totalCompaniesCount = companies.length;
  const totalSitesCount = useMemo(
    () => companies.reduce((acc, c) => acc + (c.sites ? c.sites.length : 0), 0),
    [companies]
  );
  const existingCompanyNames = useMemo(() => companies.map((c) => c.name), [companies]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return companies
      .map((company) => {
        const matchesCompanyName = company.name.toLowerCase().includes(q);
        const matchingSites = company.sites.filter((site) => {
          const matchesEnvFilter = envFilter === 'all' || site.environment.toLowerCase() === envFilter;
          const matchesChannelFilter =
            channelFilter === 'all' || site.channel.toLowerCase() === channelFilter;
          if (!matchesEnvFilter || !matchesChannelFilter) return false;
          if (!q) return true;
          // Note: secrets are never present client-side, so they are not searchable.
          return (
            matchesCompanyName ||
            site.url.toLowerCase().includes(q) ||
            site.environment.toLowerCase().includes(q) ||
            site.channel.toLowerCase().includes(q)
          );
        });
        return { ...company, sites: matchingSites };
      })
      .filter((company) => company.sites && company.sites.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, searchQuery, envFilter, channelFilter]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 shadow-2xl text-xs font-medium animate-slide-up">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
          {toast.type === 'info' && <Sparkles className="w-4 h-4 text-sky-400" />}
          <span className="text-zinc-200">{toast.message}</span>
        </div>
      )}

      <Navbar
        onOpenAddModal={() => {
          setPrefilledCompany('');
          setIsAddModalOpen(true);
        }}
        onReAuthenticate={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        username={username}
        isAuthenticated={isAuthenticated}
        totalCompaniesCount={totalCompaniesCount}
        totalSitesCount={totalSitesCount}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                  <Server className="w-4 h-4" />
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Revalidation Control Dashboard
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Trigger on-demand Next.js{' '}
                <code className="text-indigo-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  /api/revalidate
                </code>{' '}
                POST webhooks via server proxy
              </p>
            </div>

            <button
              onClick={() => {
                setPrefilledCompany('');
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-900/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Site</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-zinc-800">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sites by name, URL, environment or channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="md:col-span-3 relative">
              <select
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
              >
                <option value="all">All Environments</option>
                <option value="dev">DEV Environment</option>
                <option value="uat">UAT Environment</option>
                <option value="prod">PROD Environment</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="md:col-span-3 relative">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
              >
                <option value="all">All Channels</option>
                <option value="preview">Preview Channel</option>
                <option value="live">Live Channel</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Registered Sites ({filteredCompanies.length})
            </h3>
            {/* <span className="text-xs text-zinc-500 font-mono">High density node grouping</span> */}
          </div>

          {isLoadingSites ? (
            <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 font-mono">Loading site configurations from server...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-zinc-200">No sites found</h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No environments match "${searchQuery}". Try clearing search filters.`
                    : 'No websites registered yet. Click "Add New Site" to create one.'}
                </p>
              </div>
              {totalSitesCount === 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setEnvFilter('all');
                    setChannelFilter('all');
                    setPrefilledCompany('');
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Site</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onRevalidateSite={handleRevalidateSite}
                  onDeleteSite={handleDeleteSite}
                  onDeleteCompany={handleDeleteCompany}
                  onOpenAddModalWithCompany={(cName) => {
                    setPrefilledCompany(cName);
                    setIsAddModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-800/80 bg-[#09090b] py-6 mt-12 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-zinc-300">nextjs-revalidator</span> • <a href="https://github.com/charles-mendoza/">@charles-mendoza</a>
          </div>
          {/* <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>Secrets stored server-side only — never sent to the browser</span>
          </div> */}
        </div>
      </footer>

      <AddSiteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddSite={handleAddSite}
        prefilledCompany={prefilledCompany}
        existingCompanies={existingCompanyNames}
      />

      <LoginPromptModal
        isOpen={isAuthModalOpen}
        onLogin={authenticateCredentials}
        errorMsg={authError}
      />
    </div>
  );
}
