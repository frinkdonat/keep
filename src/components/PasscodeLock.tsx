'use client';

import React, { useState } from 'react';
import { Bookmark, ArrowRight, ShieldAlert, User, Lock } from 'lucide-react';
import { UserRole } from '@/lib/types';

export interface AuthenticatedUserInfo {
  id: string;
  username: string;
  role: UserRole;
  apiKey: string;
}

export interface LoginSuccessPayload {
  user: AuthenticatedUserInfo;
  isDefaultCredentials: boolean;
  apiKey?: string;
}

interface PasscodeLockProps {
  onSuccess: (payload: LoginSuccessPayload) => void;
}

export function PasscodeLock({ onSuccess }: PasscodeLockProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        onSuccess({
          user: data.user,
          isDefaultCredentials: Boolean(data.isDefaultCredentials),
          apiKey: data.apiKey,
        });
      } else {
        setErrorMsg(data.error || 'Invalid username or password');
        setPassword('');
      }
    } catch {
      setErrorMsg('Connection error, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080a] p-4 select-none">
      {/* Subtle radial glow behind login card */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[36rem] rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101014]/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white mb-6 shadow-lg shadow-indigo-500/25">
          <Bookmark className="h-5 w-5 fill-white" />
        </div>

        <div className="text-center mb-7">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Sign in to Keep</h1>
          <p className="text-xs text-zinc-400 mt-1">Enter your workspace credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Username"
              autoFocus
              autoComplete="username"
              className="w-full rounded-xl border border-white/[0.08] bg-[#08080a]/90 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-indigo-500/70"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/[0.08] bg-[#08080a]/90 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-indigo-500/70"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Static Baked-in Watermark */}
      <div className="fixed bottom-4 right-4 z-10 pointer-events-none select-none opacity-25">
        <img
          src="/watermark.png"
          alt=""
          className="h-7 w-7 rounded-lg"
          draggable={false}
          decoding="async"
        />
      </div>
    </div>
  );
}
