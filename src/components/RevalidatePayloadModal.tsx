'use client';

import React, { useEffect, useState } from 'react';
import { X, Braces, RotateCcw } from 'lucide-react';
import { DEFAULT_REVALIDATE_PAYLOAD, RevalidatePayload } from '@/types';

interface RevalidatePayloadModalProps {
  isOpen: boolean;
  siteLabel: string;
  initialPayload: RevalidatePayload;
  onClose: () => void;
  onSave: (payload: RevalidatePayload) => void;
}

type BuilderMode = 'all' | 'tags' | 'custom';

// Convenience presets for the CMS tag families.
const TAG_PRESETS: { key: string; label: string; tag: string }[] = [
  { key: 'navigation', label: 'Navigation', tag: 'cms:navigation' },
  { key: 'metadata', label: 'Metadata', tag: 'cms:metadata' },
  { key: 'headerFooter', label: 'Header / Footer', tag: 'cms:header-footer' },
  { key: 'mainExpanded', label: 'Main (expanded)', tag: 'cms:main-expanded' },
  { key: 'settings', label: 'Settings', tag: 'cms:settings' },
];

const PRESET_TAGS = new Set(TAG_PRESETS.map((p) => p.tag));

function isAllPayload(p: RevalidatePayload): boolean {
  return p?.all === true && Object.keys(p).length === 1;
}

function parseTagLines(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export const RevalidatePayloadModal: React.FC<RevalidatePayloadModalProps> = ({
  isOpen,
  siteLabel,
  initialPayload,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<BuilderMode>('all');
  const [selectedPresets, setSelectedPresets] = useState<Record<string, boolean>>({});
  const [extraTagsText, setExtraTagsText] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [error, setError] = useState('');

  // Re-initialize the form from the incoming payload each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const p = initialPayload ?? DEFAULT_REVALIDATE_PAYLOAD;

    if (isAllPayload(p)) {
      setMode('all');
      setSelectedPresets({});
      setExtraTagsText('');
      setRawJson('');
      return;
    }
    if (Array.isArray(p.tags)) {
      const tags = (p.tags as unknown[]).map(String);
      const presets: Record<string, boolean> = {};
      TAG_PRESETS.forEach((preset) => {
        if (tags.includes(preset.tag)) presets[preset.key] = true;
      });
      setSelectedPresets(presets);
      setExtraTagsText(tags.filter((t) => !PRESET_TAGS.has(t)).join('\n'));
      setMode('tags');
      setRawJson('');
      return;
    }
    // Anything else → custom JSON.
    setMode('custom');
    setRawJson(JSON.stringify(p, null, 2));
  }, [isOpen, initialPayload]);

  if (!isOpen) return null;

  // Derive the payload + any validation error for the current form state.
  const buildPayload = (): { payload?: RevalidatePayload; error?: string } => {
    if (mode === 'all') return { payload: { all: true } };
    if (mode === 'tags') {
      const presetTags = TAG_PRESETS.filter((p) => selectedPresets[p.key]).map((p) => p.tag);
      const extras = parseTagLines(extraTagsText);
      const tags = Array.from(new Set([...presetTags, ...extras]));
      if (tags.length === 0) return { error: 'Select at least one tag or add a custom tag.' };
      return { payload: { tags } };
    }
    // custom
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { error: 'Body must be a JSON object.' };
      }
      return { payload: parsed as RevalidatePayload };
    } catch {
      return { error: 'Invalid JSON.' };
    }
  };

  const { payload, error: buildError } = buildPayload();

  const handleSave = () => {
    if (!payload) {
      setError(buildError || 'Invalid payload');
      return;
    }
    onSave(payload);
    onClose();
  };

  const togglePreset = (key: string) =>
    setSelectedPresets((prev) => ({ ...prev, [key]: !prev[key] }));

  const modeBtn = (m: BuilderMode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError('');
      }}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
        mode === m
          ? 'bg-indigo-600 border-indigo-500 text-white'
          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#09090b] border border-zinc-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Braces className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Revalidation Payload</h3>
              <p className="text-xs text-zinc-400 truncate max-w-xs">{siteLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {(error || buildError) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
              {error || buildError}
            </div>
          )}

          <div className="flex items-center gap-2">
            {modeBtn('all', 'All domains')}
            {modeBtn('tags', 'Specific tags')}
            {modeBtn('custom', 'Custom JSON')}
          </div>

          {mode === 'all' && (
            <p className="text-xs text-zinc-400">
              Invalidates every CMS domain. Sends{' '}
              <code className="text-indigo-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                {'{ "all": true }'}
              </code>
              .
            </p>
          )}

          {mode === 'tags' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TAG_PRESETS.map((preset) => (
                  <label
                    key={preset.key}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selectedPresets[preset.key])}
                      onChange={() => togglePreset(preset.key)}
                      className="accent-indigo-500"
                    />
                    <span className="flex flex-col">
                      <span className="text-xs font-medium text-zinc-200">{preset.label}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{preset.tag}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Additional tags</label>
                <textarea
                  value={extraTagsText}
                  onChange={(e) => setExtraTagsText(e.target.value)}
                  rows={3}
                  placeholder={'One per line, e.g.\ncms:main-expanded:bar-en-ww/about'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Raw JSON body</label>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={6}
                placeholder={'{ "tags": ["cms:main-expanded"] }'}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Live preview of what will be sent */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Request body preview
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode('all');
                  setSelectedPresets({});
                  setExtraTagsText('');
                  setRawJson('');
                  setError('');
                }}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Reset to default { all: true }"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] text-indigo-300/90 overflow-x-auto max-h-32 whitespace-pre-wrap">
              {payload ? JSON.stringify(payload, null, 2) : '— invalid —'}
            </pre>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!payload}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-900/20 disabled:opacity-50 cursor-pointer"
            >
              Save Payload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
