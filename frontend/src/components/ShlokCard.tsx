import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import type { Verse } from '../types';

interface ShlokCardProps {
  verse: Verse;
  defaultExpanded?: boolean;
}

const ShlokCard = ({ verse, defaultExpanded = false }: ShlokCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [placeholderType, setPlaceholderType] = useState<string | null>(null);
  
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const { 
    playingMessageId, 
    playingAudioType,
    stopAudio,
    playAudio,
  } = useChatStore();

  useEffect(() => {
    return () => {
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
    };
  }, []);

  const isShlokPlaying = playingMessageId === verse.id && playingAudioType === 'shlok';
  const isTranslationPlaying = playingMessageId === verse.id && playingAudioType === 'translation';
  const isExplanationPlaying = playingMessageId === verse.id && playingAudioType === 'explanation';

  const handlePlayStaticAudio = async (type: 'shlok' | 'explanation' | 'translation') => {
    if (type === 'translation' || type === 'explanation') {
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
      setPlaceholderType(type);
      placeholderTimerRef.current = setTimeout(() => {
        setPlaceholderType(null);
      }, 2000);
      return;
    }

    const isCurrentlyPlaying = playingMessageId === verse.id && playingAudioType === type;
    if (isCurrentlyPlaying) {
      stopAudio();
      return;
    }

    // Deterministic static URL based on chapter and verse
    const staticBaseUrl = "https://fshfxtshvffidmuevofm.supabase.co/storage/v1/object/public/shlok_audio";
    const key = `${verse.chapter}_${verse.verse}`;
    
    // Map internal type to Supabase folder
    const folderMap = {
      'shlok': 'shlok',
      'translation': 'translation',
      'explanation': 'explanation'
    };
    
    const audioUrl = `${staticBaseUrl}/${folderMap[type]}/${key}.mp3`;

    setIsLocalLoading(true);

    try {
      await playAudio(
        verse.id,
        [audioUrl],
        type,
        () => setIsLocalLoading(false),
        () => setIsLocalLoading(false),
        () => setIsLocalLoading(false)
      );
    } catch (error) {
      console.error(`Failed to play ${type} audio:`, error);
      setIsLocalLoading(false);
    }
  };

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

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayStaticAudio('shlok');
                }}
                disabled={isLocalLoading}
                className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
              >
                {isShlokPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                <span>{placeholderType === 'shlok' ? 'Coming soon' : 'Shlok Audio'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayStaticAudio('translation');
                }}
                disabled={isLocalLoading}
                className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
              >
                {isTranslationPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                <span>{placeholderType === 'translation' ? 'Coming soon' : 'Translation'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayStaticAudio('explanation');
                }}
                disabled={isLocalLoading}
                className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
              >
                {isExplanationPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                <span>{placeholderType === 'explanation' ? 'Coming soon' : 'Explanation'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {verse.themes.map((theme, i) => (
                <span key={i} className="text-[14px] px-[10px] py-[4px] bg-orange-50 text-orange-600 font-bold rounded-full border border-orange-100 uppercase">
                  #{theme}
                </span>
              ))}
            </div>
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
