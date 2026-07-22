'use client';

import React, { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onLogin: (username: string, password: string) => Promise<boolean>;
  errorMsg?: string;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  isOpen,
  onLogin,
  errorMsg,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);
    try {
      const success = await onLogin(username, password);
      if (!success) {
        setLocalError('Invalid username or password.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-[#09090b] border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 bg-zinc-900/60 border-b border-zinc-800 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">nextjs-revalidator</h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              A Cache Revalidation Management Console
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {(errorMsg || localError) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{localError || errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Email</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Email"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Login'}</span>
            </button>
          </form>

          <p className="text-[11px] text-zinc-700 text-center font-mono mt-8">
            <a href="https://github.com/charles-mendoza/">@charles-mendoza</a>
          </p>
        </div>
      </div>
    </div>
  );
};
