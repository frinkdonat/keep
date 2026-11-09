import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Keep',
  description: 'Privacy policy for Keep and the Keep Chrome extension.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-indigo-500/20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl w-full">
        <Link 
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition mb-8 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Keep</span>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Privacy Policy</h1>
            <p className="text-xs text-zinc-400">Keep — 1-Click Watch Later Extension</p>
          </div>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-zinc-300 text-sm leading-relaxed border-t border-zinc-800/80 pt-6">
          <p className="text-xs text-zinc-500 font-mono">Last updated: November 8, 2026</p>

          <section>
            <h2 className="text-base font-semibold text-zinc-100 mb-2">1. Overview & Single Purpose</h2>
            <p>
              The <strong>Keep — 1-Click Watch Later</strong> extension is a personal productivity tool created solely to save the URL and title of the active browser tab to your self-hosted Keep server when you click the extension action icon.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-100 mb-2">2. Data Handled</h2>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400 pl-1">
              <li>
                <strong className="text-zinc-200">Active Tab URL and Title:</strong> Accessed solely upon explicit user gesture (clicking the extension icon in the browser toolbar).
              </li>
              <li>
                <strong className="text-zinc-200">Server Configuration:</strong> Your destination Keep server URL and secret API key are stored locally in your browser&apos;s storage.
              </li>
              <li>
                <strong className="text-zinc-200">In-Page Feedback Toast:</strong> Uses the scripting permission solely to display a transient in-page notification pill confirming when a link was successfully saved or reporting an error. No webpage contents or scripts are read, recorded, or modified.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-100 mb-2">3. Storage & Transmission</h2>
            <p>
              When you save a link, the URL and title are sent directly from your browser to your designated self-hosted server. 
              The extension <strong>never</strong> transmits data to any third-party servers, developer servers, or external services. No browsing history is tracked or retained outside your own private instance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-100 mb-2">4. Data Sharing & Selling</h2>
            <p>
              We do not collect, sell, rent, monetize, or share your personal data, URLs, or browsing activity with any third parties or data brokers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-100 mb-2">5. Support & Contact</h2>
            <p>
              For any questions or concerns regarding Keep, please contact the maintainer or visit:{' '}
              <a 
                href="https://github.com/frinkdonat/keep" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                https://github.com/frinkdonat/keep
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
