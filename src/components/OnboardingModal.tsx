'use client';

import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Globe,
  Key,
  Puzzle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ArrowRight,
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
  const [submitting, setSubmitting] = useState(false);

  const serverUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const displayKey = apiKey || 'keep_secret_api_key';

  const handleCopy = (value: string, field: 'url' | 'key') => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComplete]);

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/setup', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080a]/95 p-4 backdrop-blur-xl overflow-y-auto">
      <div className="relative my-auto w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#101014] p-6 sm:p-8 shadow-2xl shadow-black/90">
        {/* Top Badge & Header */}
        <div className="flex items-center gap-3.5 pb-6 border-b border-white/[0.07]">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Bookmark className="h-5 w-5 fill-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-indigo-400">
              <Sparkles className="h-3 w-3" />
              <span>First-Time Setup</span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
              Welcome to Your Keep Instance
            </h2>
          </div>
        </div>

        <div className="mt-6 space-y-5 text-sm">
          {/* Step 1: Environment Credentials Status */}
          <div className="rounded-xl border border-white/[0.07] bg-[#0b0b0e] p-4">
            <div className="flex items-start gap-3">
              {isDefaultCredentials ? (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              ) : (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  1. Docker Environment Security
                </h3>
                {isDefaultCredentials ? (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    You are currently using one or more default dummy values (
                    <code className="text-amber-300 font-mono">USERNAME</code>,{' '}
                    <code className="text-amber-300 font-mono">PASSWORD</code>, or{' '}
                    <code className="text-amber-300 font-mono">API_KEY</code>). For production
                    security, set custom values in your Docker container environment variables.
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Your custom Docker environment credentials (<code className="text-emerald-300 font-mono">USERNAME</code>,{' '}
                    <code className="text-emerald-300 font-mono">PASSWORD</code>, and{' '}
                    <code className="text-emerald-300 font-mono">API_KEY</code>) are active and secured.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Chrome Extension Connection */}
          <div className="rounded-xl border border-white/[0.07] bg-[#0b0b0e] p-4 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Puzzle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  2. Connect the Chrome Extension
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Right-click the Keep icon in your Chrome toolbar, select{' '}
                  <strong className="text-zinc-200">Options</strong>, and paste these two values:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pl-10">
              {/* Server URL copy box */}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#121217] px-3 py-2">
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    <Globe className="h-3 w-3" />
                    <span>Server URL</span>
                  </div>
                  <div className="truncate font-mono text-xs text-zinc-200 mt-0.5">
                    {serverUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(serverUrl, 'url')}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.12] transition cursor-pointer"
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

              {/* API Key copy box */}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#121217] px-3 py-2">
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    <Key className="h-3 w-3" />
                    <span>API Key</span>
                  </div>
                  <div className="truncate font-mono text-xs text-zinc-200 mt-0.5">
                    {displayKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(displayKey, 'key')}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.12] transition cursor-pointer"
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
            </div>
          </div>

          {/* Step 3: Workflow note */}
          <p className="text-xs text-zinc-500 text-center">
            This guide is saved to your server database — once completed, it will not appear again on any of your devices unless you reinstall the container.
          </p>
        </div>

        <div className="mt-6 pt-5 border-t border-white/[0.07] flex justify-end">
          <button
            type="button"
            onClick={handleFinish}
            disabled={submitting}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition cursor-pointer"
          >
            <span>{submitting ? 'Saving...' : 'Complete Setup & Open Keep'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
