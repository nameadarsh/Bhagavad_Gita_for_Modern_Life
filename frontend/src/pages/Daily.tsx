import { useState, useEffect } from 'react';
import { RefreshCcw, Loader2, Info } from 'lucide-react';
import { dataService } from '../data/dataService';
import type { Verse } from '../types';
import ShlokCard from '../components/ShlokCard';

const Daily = () => {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadDaily = (mode: 'initial' | 'next' = 'initial') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = mode === 'initial'
        ? dataService.getDailyShlok()
        : dataService.getAnotherDailyShlok(verse?.id);
      setVerse(data);
    } catch (err) {
      console.error('Failed to load daily verse:', err);
      setError('The sacred scrolls are currently out of reach. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDaily();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className="text-center space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
            Daily Wisdom
          </h1>
          <p className="text-slate-500 font-medium">
            A hand-picked verse to inspire your spiritual journey today.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 size={40} className="animate-spin text-orange-600" />
          <p className="text-slate-400 italic">Finding a meaningful shlok for you...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-orange-100 p-8 space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Info size={32} />
          </div>
          <p className="text-slate-600 font-medium">{error}</p>
          <button
            onClick={() => loadDaily('initial')}
            className="px-6 py-2 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
          >
            Retry Connection
          </button>
        </div>
      ) : verse ? (
        <div className="animate-in fade-in zoom-in duration-500">
          <ShlokCard verse={verse} defaultExpanded={true} />
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => loadDaily('next')}
              className="flex items-center space-x-2 px-8 py-3 bg-white text-slate-600 font-bold rounded-2xl border border-orange-100 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm hover:shadow active:scale-95"
            >
              <RefreshCcw size={18} />
              <span>Give me another</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Daily;
