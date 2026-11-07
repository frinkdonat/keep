'use client';

import React, { useState } from 'react';
import { X, Puzzle, Copy, Check, ExternalLink, Key, Globe } from 'lucide-react';

interface ExtensionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExtensionHelpModal({ isOpen, onClose }: ExtensionHelpModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const apiKey = 'keep_secret_token_12345'; // default from .env

  const copyToClipboard = (text: string, type: 'url' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Puzzle className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100">Chrome Extension Setup</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-zinc-300">
          <p className="text-xs text-zinc-400">
            Save any YouTube video or website in 1 click right from Chrome. Follow these 3 easy steps:
          </p>

          <ol className="space-y-3 text-xs text-zinc-300 list-decimal list-inside pl-1">
            <li className="leading-relaxed">
              Open Chrome and go to <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">chrome://extensions</code>, then toggle on <strong className="text-zinc-100">Developer mode</strong> in the top right.
            </li>
            <li className="leading-relaxed">
              Click <strong className="text-zinc-100">Load unpacked</strong> and select the <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">extension</code> folder located inside this project directory.
            </li>
            <li className="leading-relaxed">
              Right-click the Keep extension icon, select <strong className="text-zinc-100">Options</strong>, and paste your Server URL and API Key below.
            </li>
          </ol>

          {/* Quick Copy Credentials */}
          <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span className="flex items-center gap-1 font-medium">
                  <Globe className="h-3 w-3" /> Server URL
                </span>
                <button
                  onClick={() => copyToClipboard(serverUrl, 'url')}
                  className="flex items-center gap-1 text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="rounded-lg bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-200 border border-zinc-800">
                {serverUrl}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span className="flex items-center gap-1 font-medium">
                  <Key className="h-3 w-3" /> API Key (from .env)
                </span>
                <button
                  onClick={() => copyToClipboard(apiKey, 'key')}
                  className="flex items-center gap-1 text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="rounded-lg bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-200 border border-zinc-800">
                {apiKey}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
