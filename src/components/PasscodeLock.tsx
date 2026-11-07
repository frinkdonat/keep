'use client';

import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

interface PasscodeLockProps {
  onSuccess: () => void;
}

export function PasscodeLock({ onSuccess }: PasscodeLockProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;

    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        setError(true);
        setPasscode('');
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6 border border-indigo-500/20">
          <Lock className="h-6 w-6" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Unlock Keep</h2>
          <p className="text-sm text-zinc-400 mt-1">Enter your master passcode to access your saved links</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(false);
              }}
              placeholder="Passcode..."
              autoFocus
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-center text-lg tracking-widest text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400">
              <ShieldAlert className="h-4 w-4" />
              <span>Invalid passcode, please try again</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{loading ? 'Verifying...' : 'Unlock'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
