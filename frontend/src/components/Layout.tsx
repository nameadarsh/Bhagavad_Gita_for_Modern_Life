import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import Navbar from './Navbar';
import { useBackendStore } from '../store/backendStore';
import { requestWarmupRetry } from '../services/api';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const isBackendReady = useBackendStore((s) => s.isBackendReady);
  const isWarmingUp = useBackendStore((s) => s.isWarmingUp);
  const warmupTimedOut = useBackendStore((s) => s.warmupTimedOut);
  const restartWarmup = useBackendStore((s) => s.restartWarmup);
  const hasApiUrl = Boolean(import.meta.env.VITE_API_BASE_URL);

  const showBanner = !isBackendReady && (isWarmingUp || warmupTimedOut || !hasApiUrl);

  return (
    <div className="min-h-screen bg-orange-50/30 flex flex-col selection:bg-orange-200 selection:text-orange-900">
      <Navbar />
      {showBanner && (
        <div
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-0"
          role="status"
        >
          <div className="rounded-xl border border-orange-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm flex flex-wrap items-center gap-3">
            {!hasApiUrl ? (
              <span className="font-medium text-slate-800">
                Missing <code className="text-xs bg-slate-100 px-1 rounded">VITE_API_BASE_URL</code>. Set it in{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">frontend/.env</code> and reload.
              </span>
            ) : warmupTimedOut ? (
              <>
                <span className="font-medium text-slate-800">The guidance service is not ready. Check the API URL or try again.</span>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await requestWarmupRetry();
                      restartWarmup();
                    })();
                  }}
                  className="ml-auto text-sm font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
                >
                  Retry connection
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" aria-hidden />
                <span className="font-medium text-slate-800">Preparing the guidance service (first load can take a minute)…</span>
              </>
            )}
          </div>
        </div>
      )}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 md:pt-24 md:pb-12">
        <div className="animate-in fade-in duration-700">
          {children}
        </div>
      </main>
      <footer className="w-full py-10 px-4 border-t border-orange-100 bg-white/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
            Your queries are not stored permanently and are used only to generate responses.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
