import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, Tag, Users, Info } from 'lucide-react';
import { gitaApi } from '../services/api';
import type { ChapterDetail } from '../types';
import ShlokCard from '../components/ShlokCard';

const ChapterDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ChapterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChapter = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitaApi.getChapter(parseInt(id));
      setData(result);
    } catch (err) {
      console.error('Failed to fetch chapter details:', err);
      setError(`Unable to reveal the teachings of Chapter ${id}.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChapter();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={40} className="animate-spin text-orange-600" />
        <p className="text-slate-400">Loading verses of Chapter {id}...</p>
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
          onClick={fetchChapter}
          className="w-full px-6 py-3 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="space-y-4">
        <Link 
          to="/chapters" 
          className="inline-flex items-center text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Chapters</span>
        </Link>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-orange-100 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-slate-800">Chapter {data.info.chapter}</h1>
              <p className="text-orange-600 font-semibold">{data.info.verse_count} Sacred Verses</p>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-600 text-white rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-bold shadow-lg shadow-orange-600/20">
              {data.info.chapter}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-orange-50">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <Users size={14} />
                <span>Primary Speakers</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.info.speakers.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 text-xs font-semibold rounded-full border border-slate-100">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <Tag size={14} />
                <span>Major Themes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.info.themes_top.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 text-xs font-semibold rounded-full border border-orange-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800 px-2 flex items-center gap-2">
          <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
          Verses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.verses.map((v) => (
            <ShlokCard key={v.id} verse={v} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChapterDetailPage;
