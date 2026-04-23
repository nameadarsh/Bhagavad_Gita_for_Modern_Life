import { User, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isAi = message.role === 'ai';
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div className={`flex w-full mb-6 ${isAi ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-2xl shadow-sm transition-all duration-300 hover:scale-110 ${
          isAi ? 'bg-orange-600 text-white mr-3' : 'bg-white border border-slate-200 text-slate-500 ml-3'
        }`}>
          {isAi ? <Bot size={20} /> : <User size={20} />}
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <div className={`p-4 md:p-6 rounded-3xl shadow-sm border transition-all duration-300 hover:shadow-md max-w-3xl ${
            isAi 
              ? 'bg-white border-orange-100 text-slate-800 rounded-tl-none' 
              : 'bg-orange-600 border-orange-700 text-white rounded-tr-none'
          }`}>
            <div className="text-sm md:text-[15px] leading-relaxed font-medium space-y-4">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="animate-in fade-in duration-500 fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
                  {paragraph}
                </p>
              ))}
            </div>
            {isFallback && (
              <p className="mt-4 text-[10px] text-slate-400 font-medium italic border-t border-slate-100 pt-2 opacity-70">
                Note: Response generated using fallback mode.
              </p>
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
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                      Speaker: {message.verse.speaker}
                    </span>
                    <div className="flex gap-1.5">
                      {message.verse.themes.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 bg-orange-50 text-orange-600 font-bold rounded-full border border-orange-100 uppercase">
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
