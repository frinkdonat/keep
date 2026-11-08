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
  Database,
  Download,
  Sparkles,
  HardDrive,
} from 'lucide-react';
import { PublicUser } from '@/lib/types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DbInfo {
  dbSizeBytes: number;
  walSizeBytes: number;
  backupCount: number;
  lastBackupDate: string | null;
  lastMaintenanceTime: number | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // SQLite Maintenance & Backup state
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [runningMaintenance, setRunningMaintenance] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, dbRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/admin/maintenance'),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbInfo(dbData.info || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setUsername('');
      setPassword('');
      setErrorMsg('');
      setMaintenanceSuccess(false);
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    if (
      !confirm(
        `Generate a new Chrome Extension API Key for "${u.username}"? Their old key will stop working.`
      )
    ) {
      return;
    }

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
    if (
      !confirm(
        `Delete user "${u.username}" and permanently remove all ${u.item_count} saved links in their workspace?`
      )
    ) {
      return;
    }

    setUsers((prev) => prev.filter((item) => item.id !== u.id));
    try {
      await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    } catch {
      loadData();
    }
  };

  const copyApiKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunMaintenance = async () => {
    setRunningMaintenance(true);
    try {
      const res = await fetch('/api/admin/maintenance', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.info) setDbInfo(data.info);
        setMaintenanceSuccess(true);
        setTimeout(() => setMaintenanceSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setRunningMaintenance(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/admin/backup';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101015] shadow-2xl shadow-black/90"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Admin Control Center</h2>
              <p className="text-xs text-zinc-400">
                User workspaces, security keys, and SQLite database maintenance
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
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors cursor-pointer"
                              title="Regenerate API Key"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete user and workspace"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* SQLite Database Maintenance & Backups Section */}
          <div className="rounded-xl border border-white/[0.07] bg-[#0b0b0f] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <Database className="h-3.5 w-3.5 text-indigo-400" />
                <span>SQLite Maintenance & Backups</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                Auto-optimized every 6h
              </span>
            </div>

            {/* Storage Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-white/[0.05] bg-[#121218] p-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">
                  Database Size
                </span>
                <span className="text-sm font-semibold text-zinc-200 font-mono mt-0.5 block">
                  {dbInfo ? formatBytes(dbInfo.dbSizeBytes) : '...'}
                </span>
              </div>

              <div className="rounded-lg border border-white/[0.05] bg-[#121218] p-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">
                  WAL Journal
                </span>
                <span className="text-sm font-semibold text-zinc-200 font-mono mt-0.5 block">
                  {dbInfo ? formatBytes(dbInfo.walSizeBytes) : '...'}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-lg border border-white/[0.05] bg-[#121218] p-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">
                  Rolling Backups
                </span>
                <span className="text-sm font-semibold text-zinc-200 font-mono mt-0.5 block truncate">
                  {dbInfo
                    ? `${dbInfo.backupCount} saved${
                        dbInfo.lastBackupDate ? ` (${dbInfo.lastBackupDate})` : ''
                      }`
                    : '...'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleRunMaintenance}
                disabled={runningMaintenance}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                {runningMaintenance ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                ) : maintenanceSuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                )}
                <span>
                  {runningMaintenance
                    ? 'Optimizing...'
                    : maintenanceSuccess
                    ? 'Optimized & Checkpointed!'
                    : 'Run Optimization & Flush WAL'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600/15 px-3.5 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-600/25 hover:text-indigo-200 transition-colors cursor-pointer"
                title="Download atomic snapshot of the SQLite database to your machine"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Database Backup (.db)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
