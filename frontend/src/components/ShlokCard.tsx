import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Verse } from '../types';

interface ShlokCardProps {
  verse: Verse;
  defaultExpanded?: boolean;
}

const ShlokCard = ({ verse, defaultExpanded = false }: ShlokCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const navigate = useNavigate();

  const handleAsk = () => {
    navigate('/', { state: { verseId: verse.id, initialQuery: `Explain Chapter ${verse.chapter}, Verse ${verse.verse}` } });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-orange-100 overflow-hidden transition-all hover:shadow-xl hover:shadow-orange-600/5 hover:-translate-y-1 group">
      <div 
        className="p-5 cursor-pointer flex justify-between items-center bg-white group-hover:bg-orange-50/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
              CH {verse.chapter} • V {verse.verse}
            </span>
          </div>
          <p className="font-serif text-slate-800 line-clamp-1 italic text-lg tracking-tight">
            {verse.sanskrit}
          </p>
        </div>
        <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-orange-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-orange-50 bg-white space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1 h-3 bg-orange-300 rounded-full"></div>
              Sanskrit
            </h4>
            <p className="font-serif text-xl text-slate-900 leading-relaxed italic border-l-4 border-orange-100 pl-4">
              {verse.sanskrit}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1 h-3 bg-slate-300 rounded-full"></div>
              English
            </h4>
            <p className="text-slate-800 leading-relaxed font-medium">
              {verse.english}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1 h-3 bg-amber-300 rounded-full"></div>
              Explanation
            </h4>
            <p className="text-slate-600 text-sm leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              {verse.brief_explanation}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {verse.themes.map((theme, i) => (
              <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-full border border-orange-100 uppercase tracking-wide">
                #{theme}
              </span>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAsk();
              }}
              className="group/btn flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white text-sm font-bold rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 active:scale-95"
            >
              <MessageCircle size={18} className="group-hover/btn:rotate-12 transition-transform" />
              <span>Ask about this</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShlokCard;
