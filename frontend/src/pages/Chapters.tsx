import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Loader2, Users, Tag, Info } from 'lucide-react';
import { dataService } from '../data/dataService';
import type { ChapterInfo } from '../types';

const Chapters = () => {
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChapters = () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = dataService.getChapters();
      setChapters(data);
    } catch (err) {
      console.error('Failed to load chapters:', err);
      setError('Unable to load the eighteen chapters. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChapters();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 size={48} className="animate-spin text-orange-600" />
        <p className="text-slate-400 font-medium italic">Opening the ancient gates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-white rounded-3xl border border-orange-100 p-8 space-y-6 shadow-sm mt-10">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <Info size={32} />
        </div>
        <p className="text-slate-600 font-medium">{error}</p>
        <button
          onClick={loadChapters}
          className="w-full px-6 py-3 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="text-orange-500" size={32} />
          <span>The Eighteen Chapters</span>
        </h1>
        <p className="text-slate-500 font-medium">
          Explore the Bhagavad Gita by its philosophical divisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chapters.map((ch, idx) => (
          <Link
            key={ch.chapter}
            to={`/chapter/${ch.chapter}`}
            className="group bg-white p-6 rounded-3xl shadow-sm border border-orange-100 hover:border-orange-400 transition-all hover:shadow-xl hover:shadow-orange-600/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-6xl font-bold text-orange-900">{ch.chapter}</span>
            </div>
            
            <div className="relative space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Chapter {ch.chapter}</h3>
                  <p className="text-sm font-medium text-orange-600">{ch.verse_count} Verses</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <ChevronRight size={18} />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2">
                  <Users size={14} className="mt-1 text-slate-400" />
                  <div className="flex flex-wrap gap-1">
                    {ch.speakers.slice(0, 2).map((s, i) => (
                      <span key={i} className="text-[10px] text-slate-500 font-medium">{s}{i === 0 && ch.speakers.length > 1 ? ',' : ''}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Tag size={14} className="mt-1 text-slate-400" />
                  <div className="flex flex-wrap gap-1">
                    {ch.themes_top.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-100">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Chapters;
