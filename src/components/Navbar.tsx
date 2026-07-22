'use client';

import React from 'react';
import { Plus, LogOut, UserRound } from 'lucide-react';

interface NavbarProps {
  onOpenAddModal: () => void;
  onReAuthenticate?: () => void;
  onLogout?: () => void;
  username?: string;
  isAuthenticated: boolean;
  totalCompaniesCount: number;
  totalSitesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onLogout,
  username,
  isAuthenticated,
  totalCompaniesCount,
  totalSitesCount,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.6)]"></span>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              nextjs-revalidator
            </h1>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            v1.0.0
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 font-mono">
            <div>
              <span className="text-indigo-400 font-semibold">{totalCompaniesCount}</span> Brands
            </div>
            <span className="text-zinc-700">•</span>
            <div>
              <span className="text-indigo-400 font-semibold">{totalSitesCount}</span> Nodes
            </div>
          </div>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-900/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add site</span>
          </button>

          {isAuthenticated && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg pl-3 pr-1.5 py-1">
              {username && (
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-zinc-300">
                  <UserRound className="w-3.5 h-3.5 text-indigo-400" />
                  {username}
                </span>
              )}
              <button
                onClick={onLogout}
                title="Sign out"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
