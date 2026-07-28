'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Globe, Key, Building2, Layers, Compass } from 'lucide-react';
import { Modal, ModalHeader } from './Modal';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSite: (newSiteData: {
    companyName: string;
    url: string;
    secret: string;
    environment: string;
    channel: string;
  }) => Promise<void>;
  prefilledCompany?: string;
  existingCompanies?: string[];
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({
  isOpen,
  onClose,
  onAddSite,
  prefilledCompany = '',
  existingCompanies = [],
}) => {
  const [companyName, setCompanyName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [environment, setEnvironment] = useState<'dev' | 'uat' | 'prod' | string>('dev');
  const [channel, setChannel] = useState<'preview' | 'live' | string>('preview');
  const [customEnv, setCustomEnv] = useState('');
  const [customChannel, setCustomChannel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (prefilledCompany) {
      setCompanyName(prefilledCompany);
    }
  }, [prefilledCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!companyName.trim()) {
      setErrorMsg('Please specify a company or brand name');
      return;
    }
    if (!url.trim()) {
      setErrorMsg('Please enter a target revalidate URL');
      return;
    }
    if (!secret.trim()) {
      setErrorMsg('Please enter a revalidate secret key');
      return;
    }

    const finalEnv = environment === 'custom' ? customEnv.trim() || 'dev' : environment;
    const finalChannel = channel === 'custom' ? customChannel.trim() || 'preview' : channel;

    setIsSubmitting(true);
    try {
      await onAddSite({
        companyName: companyName.trim(),
        url: url.trim(),
        secret: secret.trim(),
        environment: finalEnv,
        channel: finalChannel,
      });
      setCompanyName('');
      setUrl('');
      setSecret('');
      setEnvironment('dev');
      setChannel('preview');
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to add site');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader
        icon={<Plus className="w-4 h-4" />}
        title="Add Site Environment"
        subtitle="Register a site node for POST revalidation"
        onClose={onClose}
      />

        <form onSubmit={handleSubmit} className="p-5 space-y-4" autoComplete="off">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              Collection Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Meta, Anthropic, Nvidia"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              list="existing-companies-list"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {existingCompanies.length > 0 && (
              <datalist id="existing-companies-list">
                {existingCompanies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Revalidate URL Path
            </label>
            <input
              type="url"
              required
              placeholder="https://example.com/api/revalidate"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Revalidate Secret Key (Bearer Token)
            </label>
            <input
              type="password"
              required
              name="revalidate-secret"
              // autoComplete="new-password"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-zinc-500">
              Stored server-side only. It is never returned to the browser after saving.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="dev">DEV (Development)</option>
                <option value="uat">UAT (Staging)</option>
                <option value="prod">PROD (Production)</option>
                <option value="custom">Custom Environment</option>
              </select>
              {environment === 'custom' && (
                <input
                  type="text"
                  placeholder="e.g. QA, Staging"
                  value={customEnv}
                  onChange={(e) => setCustomEnv(e.target.value)}
                  className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="preview">Preview</option>
                <option value="live">Live</option>
                <option value="custom">Custom Channel</option>
              </select>
              {channel === 'custom' && (
                <input
                  type="text"
                  placeholder="e.g. Draft, Edge"
                  value={customChannel}
                  onChange={(e) => setCustomChannel(e.target.value)}
                  className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
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
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-900/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Save Site Environment'}
            </button>
          </div>
        </form>
    </Modal>
  );
};
