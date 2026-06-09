import { User, ChevronDown, ChevronUp, Volume2, Loader2, VolumeX } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { chatApi, STATIC_AUDIO_BASE_URL } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { useBackendStore } from '../store/backendStore';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isAi = message.role === 'ai';
  const isBackendReady = useBackendStore((state) => state.isBackendReady);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [placeholderType, setPlaceholderType] = useState<string | null>(null);
  
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
    };
  }, []);
  
  const { 
    playingMessageId, 
    playingAudioType,
    stopAudio,
    playAudio,
    language,
  } = useChatStore();

  const isPlaying = playingMessageId === message.id && playingAudioType === 'chat';
  const isShlokPlaying = playingMessageId === message.id && playingAudioType === 'shlok';
  const isTranslationPlaying = playingMessageId === message.id && playingAudioType === 'translation';
  const isExplanationPlaying = playingMessageId === message.id && playingAudioType === 'explanation';

  const handlePlayAudio = async () => {
    if (!isBackendReady) {
      return;
    }

    if (isPlaying) {
      stopAudio();
      return;
    }

    if (isLocalLoading || !message.content) return;

    setIsLocalLoading(true);
    setTtsError(null);

    try {
      const data = await chatApi.generateTts(message.content, language);
      const urls = data.audio_urls || (data.audio_url ? [data.audio_url] : []);

      if (urls.length === 0) {
        const errMsg = data.error || 'Audio could not be generated';
        console.error('[TTS] No audio URLs returned:', errMsg);
        setTtsError('Audio unavailable');
        return;
      }

      await playAudio(
        message.id,
        urls,
        'chat',
        undefined,
        () => setTtsError(null)
      );
    } catch (error) {
      console.error('Failed to play audio:', error);
      setTtsError('Audio unavailable');
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handlePlayStaticAudio = async (type: 'shlok' | 'explanation' | 'translation') => {
    if (type === 'translation' || type === 'explanation') {
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
      setPlaceholderType(type);
      placeholderTimerRef.current = setTimeout(() => {
        setPlaceholderType(null);
      }, 2000);
      return;
    }

    const isCurrentlyPlaying = playingMessageId === message.id && playingAudioType === type;
    if (isCurrentlyPlaying) {
      stopAudio();
      return;
    }

    // Use deterministic URL if verse info is available
    let audioUrl = message.meta?.audio?.[type];
    if (!audioUrl && message.verse) {
      const key = `${message.verse.chapter}_${message.verse.verse}`;
      const folderMap = {
        'shlok': 'shlok',
        'translation': 'shlok_english_translation',
        'explanation': 'explanation'
      };
      audioUrl = `${STATIC_AUDIO_BASE_URL}/${folderMap[type]}/${key}.mp3`;
    }

    if (!audioUrl) {
      return;
    }

    setIsLocalLoading(true);

    try {
      await playAudio(
        message.id,
        [audioUrl],
        type,
        () => setIsLocalLoading(false),
        () => setIsLocalLoading(false)
      );
    } catch (error) {
      console.error(`Failed to play ${type} audio:`, error);
      setIsLocalLoading(false);
    }
  };

  // Improved paragraph splitting: based on character length (~250-300 chars)
  const formatContent = (content: string) => {
    const trimmed = content.trim();
    if (trimmed.includes('\n\n')) {
      return trimmed.split('\n\n').map(p => p.trim());
    }
    
    // Split by sentences
    const sentences = trimmed.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [trimmed];
    const paragraphs: string[] = [];
    let currentParagraph = "";

    sentences.forEach((sentence) => {
      if ((currentParagraph.length + sentence.length) > 280 && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = sentence;
      } else {
        currentParagraph += (currentParagraph ? " " : "") + sentence;
      }
    });
    
    if (currentParagraph) {
      paragraphs.push(currentParagraph.trim());
    }
    
    return paragraphs;
  };

  const paragraphs = formatContent(message.content);
  const isFallback = isAi && message.meta?.fallback === true;
  const isPendingAiMessage = isAi && message.content.trim().length === 0;

  return (
    <div className={`flex w-full mb-6 ${isAi ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-2xl shadow-sm transition-all duration-300 hover:scale-110 ${
          isAi ? 'bg-slate-200 text-slate-500 mr-3' : 'bg-white border border-slate-200 text-slate-500 ml-3'
        }`}>
          {isAi ? <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> : <User size={20} />}
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <div className={`p-4 md:p-6 rounded-3xl shadow-sm border transition-all duration-300 hover:shadow-md max-w-3xl ${
            isAi 
              ? 'bg-white border-orange-100 text-slate-800 rounded-tl-none' 
              : 'bg-orange-600 border-orange-700 text-white rounded-tr-none'
          }`}>
            {isPendingAiMessage ? (
              <div className="flex items-center space-x-2 py-1">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div>
                <span className="text-sm text-slate-500 italic">Thinking...</span>
              </div>
            ) : (
              <div className="text-sm md:text-[15px] leading-relaxed font-medium space-y-4">
                {paragraphs.map((paragraph, i) => (
                  <p key={i} className="animate-in fade-in duration-200 ease-out fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            
            {isAi && message.content && (
              <div className="mt-4 flex items-center justify-between border-t border-orange-50 pt-3">
                <button
                  onClick={handlePlayAudio}
                  disabled={isLocalLoading || !isBackendReady}
                  className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
                >
                  {isLocalLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isPlaying ? (
                    <VolumeX size={16} className="text-red-500" />
                  ) : (
                    <Volume2 size={16} />
                  )}
                  <span>
                    {isLocalLoading ? 'Loading...' : 
                     isPlaying ? 'Stop' : 
                     ttsError ? 'Retry audio' :
                     'Listen to Guidance'}
                  </span>
                </button>
                {ttsError && !isLocalLoading && (
                  <p className="text-[10px] text-red-400 font-medium">{ttsError}</p>
                )}
                {isFallback && (
                  <p className="text-[10px] text-slate-400 font-medium italic opacity-70">
                    Fallback mode
                  </p>
                )}
              </div>
            )}
          </div>

          {isAi && message.verse && (
            <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-orange-200 transition-all">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-[10px] font-bold text-orange-600 uppercase tracking-[0.2em] hover:bg-orange-50/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                  Referenced Verse: {message.verse.id}
                </span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {isExpanded && (
                <div className="p-5 border-t border-orange-50 space-y-4 bg-white animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <p className="font-serif text-slate-900 text-lg leading-relaxed italic border-l-4 border-orange-200 pl-4 bg-orange-50/30 py-3 rounded-r-xl">
                      {message.verse.sanskrit}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-800 text-sm font-semibold leading-relaxed">
                      "{message.verse.english}"
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-slate-600 text-xs leading-relaxed leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {message.verse.brief_explanation}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <button
                        onClick={() => handlePlayStaticAudio('shlok')}
                        disabled={isLocalLoading}
                        className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
                      >
                        {isShlokPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                        <span>{placeholderType === 'shlok' ? 'Coming soon' : 'Shlok Audio'}</span>
                      </button>

                      <button
                        onClick={() => handlePlayStaticAudio('translation')}
                        disabled={isLocalLoading}
                        className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
                      >
                        {isTranslationPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                        <span>{placeholderType === 'translation' ? 'Coming soon' : 'Translation'}</span>
                      </button>

                      <button
                        onClick={() => handlePlayStaticAudio('explanation')}
                        disabled={isLocalLoading}
                        className="inline-flex items-center gap-[6px] text-[14px] font-medium text-[#f97316] hover:text-orange-700 transition-colors disabled:opacity-50 bg-none border-none p-0 cursor-pointer"
                      >
                        {isExplanationPlaying ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                        <span>{placeholderType === 'explanation' ? 'Coming soon' : 'Explanation'}</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {message.verse.themes.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[14px] px-[10px] py-[4px] bg-orange-50 text-orange-600 font-bold rounded-full border border-orange-100 uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
