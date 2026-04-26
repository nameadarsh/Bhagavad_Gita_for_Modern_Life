import { useState, useEffect, useMemo } from 'react';
import { List, Search, Loader2, ChevronDown, Info } from 'lucide-react';
import { dataService } from '../data/dataService';
import type { Verse } from '../types';
import ShlokCard from '../components/ShlokCard';

const VERSES_PER_PAGE = 21;

const AllShloks = () => {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(VERSES_PER_PAGE);

  const loadVerses = () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = dataService.getAllVerses();
      setVerses(data);
    } catch (err) {
      console.error('Failed to load verses:', err);
      setError('The collection could not be retrieved at this time.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVerses();
  }, []);

  const filteredVerses = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return verses.filter(v => 
      v.id.toLowerCase().includes(lowerSearch) ||
      v.english.toLowerCase().includes(lowerSearch) ||
      v.sanskrit.toLowerCase().includes(lowerSearch) ||
      v.themes.some(t => t.toLowerCase().includes(lowerSearch))
    );
  }, [searchTerm, verses]);

  const displayedVerses = useMemo(() => {
    return filteredVerses.slice(0, visibleCount);
  }, [filteredVerses, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + VERSES_PER_PAGE);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <List className="text-orange-500" size={32} />
            <span>Complete Collection</span>
          </h1>
          <p className="text-slate-500">
            {verses.length} verses indexed from the Bhagavad Gita.
          </p>
        </div>

        <div className="relative group max-w-xl w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400 group-focus-within:text-orange-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by text, verse number, or theme..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(VERSES_PER_PAGE);
            }}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-orange-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 size={48} className="animate-spin text-orange-600" />
          <p className="text-slate-400 font-medium italic">Unfolding the sacred scrolls...</p>
        </div>
      ) : error ? (
        <div className="max-w-md mx-auto text-center py-20 bg-white rounded-3xl border border-orange-100 p-8 space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Info size={32} />
          </div>
          <p className="text-slate-600 font-medium">{error}</p>
          <button
          onClick={loadVerses}
          className="w-full px-6 py-3 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
        >
          Retry Connection
        </button>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedVerses.length > 0 ? (
              displayedVerses.map((v) => (
                <ShlokCard key={v.id} verse={v} />
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-orange-100">
                <p className="text-slate-400 font-medium">No verses found matching your search term.</p>
              </div>
            )}
          </div>

          {visibleCount < filteredVerses.length && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                className="flex items-center space-x-2 px-8 py-3 bg-white text-orange-600 font-bold rounded-xl border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm hover:shadow active:scale-95"
              >
                <span>Load More Verses</span>
                <ChevronDown size={20} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AllShloks;
