'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Shield,
  User,
  Key,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PublicUser } from '@/lib/types';

interface UserManagementModalProps {
  onClose: () => void;
}

export function UserManagementModal({ onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmRegenId, setConfirmRegenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.users) setUsers(data.users);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmRegenId) return;
    const timer = setTimeout(() => setConfirmRegenId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmRegenId]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setCreating(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setUsers((prev) => [...prev, data.user]);
        setUsername('');
        setPassword('');
      } else {
        setErrorMsg(data.error || 'Failed to create user');
      }
    } catch {
      setErrorMsg('Network error while creating user');
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerateKey = async (u: PublicUser) => {
    if (confirmRegenId !== u.id) {
      setConfirmRegenId(u.id);
      setConfirmDeleteId(null);
      return;
    }
    setConfirmRegenId(null);

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateApiKey: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((item) => (item.id === u.id ? data.user : item)));
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteUser = async (u: PublicUser) => {
    if (confirmDeleteId !== u.id) {
      setConfirmDeleteId(u.id);
      setConfirmRegenId(null);
      return;
    }
    setConfirmDeleteId(null);

    setUsers((prev) => prev.filter((item) => item.id !== u.id));
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      if (!res.ok) {
        loadUsers();
      }
    } catch {
      loadUsers();
    }
  };

  const copyApiKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101015] shadow-2xl shadow-black/90"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">User Workspaces</h2>
              <p className="text-xs text-zinc-400">
                Manage isolated accounts and personal Chrome Extension API keys
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add User Form */}
          <form
            onSubmit={handleCreateUser}
            className="rounded-xl border border-white/[0.07] bg-[#0b0b0f] p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <UserPlus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Add New User</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Username (e.g. alex)"
                className="rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/70"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Password (min. 4 chars)"
                className="rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/70"
              />
              <button
                type="submit"
                disabled={creating || !username.trim() || !password}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{creating ? 'Creating...' : 'Create User'}</span>
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 pt-1">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>

          {/* Existing Users List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 px-1">
              <span>Active Accounts ({users.length})</span>
              <span>Personal Extension API Key</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => {
                  const isAdmin = u.role === 'admin';
                  return (
                    <div
                      key={u.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0d0d12] px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
                            isAdmin
                              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                              : 'border-white/[0.08] bg-white/[0.03] text-zinc-400'
                          }`}
                        >
                          {isAdmin ? (
                            <Shield className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-zinc-100">
                              {u.username}
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                isAdmin
                                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                                  : 'bg-white/[0.05] text-zinc-400'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                            {u.item_count} saved {u.item_count === 1 ? 'link' : 'links'}
                          </p>
                        </div>
                      </div>

                      {/* API Key & Controls */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#14141b] px-2.5 py-1">
                          <Key className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                          <span className="max-w-[140px] truncate font-mono text-[11px] text-zinc-300">
                            {u.api_key}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyApiKey(u.id, u.api_key)}
                            className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Copy user's API key"
                          >
                            {copiedId === u.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {!isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRegenerateKey(u)}
                              className={`rounded-lg transition-colors cursor-pointer select-none ${
                                confirmRegenId === u.id
                                  ? 'bg-amber-500/20 border border-amber-500/35 px-2 py-0.5 text-[11px] font-semibold text-amber-300'
                                  : 'p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                              }`}
                              title={
                                confirmRegenId === u.id
                                  ? 'Click again to regenerate API Key'
                                  : 'Regenerate API Key'
                              }
                            >
                              {confirmRegenId === u.id ? (
                                'Rotate?'
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className={`rounded-lg transition-colors cursor-pointer select-none ${
                                confirmDeleteId === u.id
                                  ? 'bg-rose-500/20 border border-rose-500/35 px-2 py-0.5 text-[11px] font-semibold text-rose-300'
                                  : 'p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400'
                              }`}
                              title={
                                confirmDeleteId === u.id
                                  ? 'Click again to delete user and workspace'
                                  : 'Delete user and workspace'
                              }
                            >
                              {confirmDeleteId === u.id ? (
                                'Sure?'
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
