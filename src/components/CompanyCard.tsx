'use client';

import React, { useState } from 'react';
import {
  DEFAULT_REVALIDATE_PAYLOAD,
  PublicSiteEntry,
  PublicCompanyGroup,
  RevalidateMode,
  RevalidatePayload,
  RevalidateResult,
} from '@/types';
import {
  Zap,
  Trash2,
  Code2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  Layers,
  ExternalLink,
  KeyRound,
  ChevronDown,
  Check,
  Braces,
} from 'lucide-react';
import { RevalidatePayloadModal } from './RevalidatePayloadModal';

interface CompanyCardProps {
  company: PublicCompanyGroup;
  onRevalidateSite: (
    companyId: string,
    site: PublicSiteEntry,
    mode: RevalidateMode,
    payload: RevalidatePayload
  ) => Promise<RevalidateResult>;
  onDeleteSite: (companyId: string, siteId: string) => void;
  onDeleteCompany: (companyId: string) => void;
  onOpenAddModalWithCompany?: (companyName: string) => void;
}

const REVALIDATE_MODES: { value: RevalidateMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatic', hint: 'By channel (preview → client, live → server)' },
  { value: 'client', label: 'Client-side', hint: 'From your browser (may require VPN)' },
  { value: 'server', label: 'Server-side', hint: 'Via the server proxy' },
];

const MODE_LABEL: Record<RevalidateMode, string> = {
  auto: 'Automatic',
  client: 'Client-side',
  server: 'Server-side',
};

const isDefaultPayload = (p: RevalidatePayload): boolean =>
  p?.all === true && Object.keys(p).length === 1;

export const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  onRevalidateSite,
  onDeleteSite,
  onDeleteCompany,
  onOpenAddModalWithCompany,
}) => {
  const [siteResults, setSiteResults] = useState<{ [siteId: string]: RevalidateResult }>({});
  const [loadingSites, setLoadingSites] = useState<{ [siteId: string]: boolean }>({});
  const [expandedInspect, setExpandedInspect] = useState<{ [siteId: string]: boolean }>({});
  const [isRevalidatingAll, setIsRevalidatingAll] = useState(false);
  const [modeBySite, setModeBySite] = useState<{ [siteId: string]: RevalidateMode }>({});
  const [openMenuSiteId, setOpenMenuSiteId] = useState<string | null>(null);
  const [bodyBySite, setBodyBySite] = useState<{ [siteId: string]: RevalidatePayload }>({});
  const [editingPayloadFor, setEditingPayloadFor] = useState<string | null>(null);

  const modeFor = (siteId: string): RevalidateMode => modeBySite[siteId] ?? 'auto';
  const payloadFor = (siteId: string): RevalidatePayload =>
    bodyBySite[siteId] ?? DEFAULT_REVALIDATE_PAYLOAD;

  const handleRevalidateSingle = async (site: PublicSiteEntry) => {
    setLoadingSites((prev) => ({ ...prev, [site.id]: true }));
    try {
      const res = await onRevalidateSite(company.id, site, modeFor(site.id), payloadFor(site.id));
      setSiteResults((prev) => ({ ...prev, [site.id]: res }));
    } catch (e: any) {
      setSiteResults((prev) => ({
        ...prev,
        [site.id]: {
          ok: false,
          status: 500,
          statusText: 'Client Error',
          error: e.message || 'Request failed',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setLoadingSites((prev) => ({ ...prev, [site.id]: false }));
    }
  };

  const handleRevalidateAll = async () => {
    const count = company.sites.length;
    const confirmed = window.confirm(
      `Revalidate all ${count} ${count === 1 ? 'environment' : 'environments'} for "${company.name}"?\n\nThis will trigger a revalidation request to each one.`
    );
    if (!confirmed) return;

    setIsRevalidatingAll(true);
    for (const site of company.sites) {
      await handleRevalidateSingle(site);
    }
    setIsRevalidatingAll(false);
  };

  const getEnvBadge = (env: string) => {
    const lower = env.toLowerCase();
    if (lower === 'prod' || lower === 'production') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (lower === 'uat' || lower === 'staging') {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  };

  const getChannelBadge = (channel: string) => {
    const lower = channel.toLowerCase();
    if (lower === 'live') {
      return 'bg-teal-500/10 text-teal-300 border-teal-500/30';
    }
    return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl shadow-xl transition-all duration-200 hover:border-zinc-700/80">
      <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 flex items-center justify-center font-bold text-base">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-lg text-white tracking-tight">{company.name}</h2>
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-500/20">
                {company.sites.length} {company.sites.length === 1 ? 'Node' : 'Nodes'}
              </span>
            </div>
            {/* <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-zinc-600" />
              Multi-environment revalidation endpoints
            </p> */}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRevalidateAll}
            disabled={isRevalidatingAll || company.sites.length === 0}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition-all shadow-md shadow-indigo-900/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Trigger POST revalidation for all environments under this company"
          >
            {isRevalidatingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-indigo-200 fill-indigo-200/20" />
            )}
            <span>{isRevalidatingAll ? 'Revalidating All...' : 'Revalidate All'}</span>
          </button>

          {onOpenAddModalWithCompany && (
            <button
              onClick={() => onOpenAddModalWithCompany(company.name)}
              className="text-xs text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 px-3 py-1.5 rounded-md transition-all cursor-pointer"
            >
              + Node
            </button>
          )}

          <button
            onClick={() => onDeleteCompany(company.id)}
            title="Delete company and all its sites"
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {company.sites.map((site) => {
          const isLoading = loadingSites[site.id];
          const result = siteResults[site.id];
          const isInspected = expandedInspect[site.id];

          return (
            <div key={site.id} className="p-4 sm:px-6 hover:bg-zinc-800/20 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${getEnvBadge(
                        site.environment
                      )}`}
                    >
                      {site.environment}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${getChannelBadge(
                        site.channel
                      )}`}
                    >
                      {site.channel}
                    </span>

                    {/* Indicates how this node is revalidated. preview = internal, called
                        client-side (browser/VPN, secret fetched on demand); live = public,
                        called server-side (secret never leaves the server). */}
                    {/* <div
                      className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-400"
                      title={
                        site.channel === 'preview'
                          ? 'Internal site: revalidated from your browser (requires VPN). Secret fetched on demand.'
                          : 'Public site: revalidated server-side. Secret never leaves the server.'
                      }
                    >
                      <KeyRound className="w-3 h-3 text-zinc-500" />
                      <span className="font-mono text-[11px] text-zinc-500">Bearer</span>
                      <span className="font-mono text-zinc-500">
                        {!site.hasSecret
                          ? 'not set'
                          : site.channel === 'preview'
                            ? '•••••• (client-side)'
                            : '•••••• (server-side)'}
                      </span>
                    </div> */}
                  </div>

                  <div className="flex items-center gap-2 group min-w-0">
                    <span className="font-mono text-xs text-zinc-500 truncate min-w-0">{site.url}</span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-indigo-400 hover:text-indigo-300 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {result && (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                        result.ok
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {result.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span>
                        {result.status} {result.statusText}
                      </span>
                      <span className="text-[10px] text-zinc-500 border-l border-zinc-700/50 pl-1.5 ml-0.5">
                        {result.durationMs}ms
                      </span>
                    </div>
                  )}

                  {/* Split button: main action + merged method dropdown */}
                  <div className="relative inline-flex">
                    <div className="inline-flex rounded-md border border-indigo-400/20 overflow-hidden">
                      <button
                        onClick={() => handleRevalidateSingle(site)}
                        disabled={isLoading}
                        title={`Revalidate — method: ${MODE_LABEL[modeFor(site.id)]}`}
                        className="text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-400/5 hover:bg-indigo-500 px-4 py-2 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            <span>POSTing...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Revalidate</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setOpenMenuSiteId((prev) => (prev === site.id ? null : site.id))
                        }
                        disabled={isLoading}
                        aria-haspopup="menu"
                        aria-expanded={openMenuSiteId === site.id}
                        title="Choose revalidation method"
                        className="px-1.5 border-l border-indigo-400/20 text-indigo-400 hover:text-white bg-indigo-400/5 hover:bg-indigo-500 transition-all disabled:opacity-50 cursor-pointer flex items-center"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            openMenuSiteId === site.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {openMenuSiteId === site.id && (
                      <>
                        {/* click-away backdrop */}
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuSiteId(null)} />
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden py-1 animate-fade-in"
                        >
                          {REVALIDATE_MODES.map((opt) => {
                            const active = modeFor(site.id) === opt.value;
                            return (
                              <button
                                key={opt.value}
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => {
                                  setModeBySite((prev) => ({ ...prev, [site.id]: opt.value }));
                                  setOpenMenuSiteId(null);
                                }}
                                className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors cursor-pointer"
                              >
                                <span className="flex flex-col">
                                  <span
                                    className={`text-xs font-medium ${
                                      active ? 'text-indigo-300' : 'text-zinc-200'
                                    }`}
                                  >
                                    {opt.label}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">{opt.hint}</span>
                                </span>
                                {active && (
                                  <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Configure the JSON body sent to this site's revalidate endpoint */}
                  <button
                    onClick={() => setEditingPayloadFor(site.id)}
                    disabled={isLoading}
                    title={`Edit revalidation payload (currently ${
                      isDefaultPayload(payloadFor(site.id)) ? 'all domains' : 'custom'
                    })`}
                    className="relative p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Braces className="w-3.5 h-3.5" />
                    {!isDefaultPayload(payloadFor(site.id)) && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400 border border-[#09090b]" />
                    )}
                  </button>

                  {result && (
                    <button
                      onClick={() =>
                        setExpandedInspect((prev) => ({ ...prev, [site.id]: !prev[site.id] }))
                      }
                      className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors cursor-pointer"
                      title="Inspect POST Response Payload"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteSite(company.id, site.id)}
                    className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                    title="Remove site environment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isInspected && result && (
                <div className="mt-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-300 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-400">
                      <Code2 className="w-3.5 h-3.5" />
                      Server-Side POST Response Inspector
                    </span>
                    <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-zinc-900 p-2 rounded border border-zinc-800">
                    <div>
                      <span className="text-zinc-500">Method:</span>{' '}
                      <span className="text-indigo-400 font-bold">POST</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Status:</span>{' '}
                      <span className={result.ok ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {result.status} {result.statusText}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Latency:</span>{' '}
                      <span className="text-amber-300">{result.durationMs} ms</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Auth:</span>{' '}
                      <span className="text-sky-300">Bearer {site.channel === 'preview' ? '(client-side)' : '(server-side)'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500 mb-1">Payload / Response Body:</div>
                    <pre className="bg-zinc-900 p-2.5 rounded text-[11px] text-indigo-300/90 overflow-x-auto max-h-48 whitespace-pre-wrap border border-zinc-800">
                      {typeof result.data === 'object'
                        ? JSON.stringify(result.data, null, 2)
                        : (result.data as string) || result.error || 'Empty response'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingPayloadFor &&
        (() => {
          const site = company.sites.find((s) => s.id === editingPayloadFor);
          if (!site) return null;
          return (
            <RevalidatePayloadModal
              isOpen
              siteLabel={`${company.name} · ${site.environment}/${site.channel} — ${site.url}`}
              initialPayload={payloadFor(site.id)}
              onClose={() => setEditingPayloadFor(null)}
              onSave={(payload) =>
                setBodyBySite((prev) => ({ ...prev, [site.id]: payload }))
              }
            />
          );
        })()}
    </div>
  );
};
