'use client';

import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Globe,
  Key,
  ShieldAlert,
  X,
} from 'lucide-react';

interface OnboardingModalProps {
  isDefaultCredentials: boolean;
  apiKey?: string;
  onComplete: () => void;
}

export function OnboardingModal({
  isDefaultCredentials,
  apiKey,
  onComplete,
}: OnboardingModalProps) {
  const [copiedField, setCopiedField] = useState<'url' | 'key' | null>(null);

  const serverUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const displayKey = apiKey || 'keep_secret_api_key';

  const handleCopy = (value: string, field: 'url' | 'key') => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080a]/90 p-4 backdrop-blur-md select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101014] p-6 shadow-2xl shadow-black/90"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Bookmark className="h-4 w-4 fill-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Extension Connection
              </h2>
              <p className="text-[11px] text-zinc-400">
                Connect your browser extension to this Keep instance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-xs">
          {/* Default Credentials Alert */}
          {isDefaultCredentials && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-300">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <p className="leading-relaxed">
                Using default credentials. Set custom <code className="font-mono text-amber-200">PASSWORD</code> and <code className="font-mono text-amber-200">API_KEY</code> in Docker for production security.
              </p>
            </div>
          )}

          {/* Server URL Box */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0b0b0e] px-3.5 py-2.5">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <Globe className="h-3 w-3 text-indigo-400" />
                <span>Server URL</span>
              </div>
              <div className="truncate font-mono text-xs text-zinc-200 mt-0.5">
                {serverUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(serverUrl, 'url')}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.12] transition cursor-pointer"
            >
              {copiedField === 'url' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* API Key Box */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0b0b0e] px-3.5 py-2.5">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <Key className="h-3 w-3 text-indigo-400" />
                <span>API Key</span>
              </div>
              <div className="truncate font-mono text-xs text-zinc-200 mt-0.5">
                {displayKey}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(displayKey, 'key')}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.12] transition cursor-pointer"
            >
              {copiedField === 'key' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 text-center leading-relaxed pt-1">
            Right-click the Keep extension icon in Chrome → <strong>Options</strong> → paste these values.
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-white/[0.07] flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            className="w-full sm:w-auto rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/[0.12] transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
