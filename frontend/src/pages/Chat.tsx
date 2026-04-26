import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Trash2, Sparkles, Info, X, ChevronDown } from 'lucide-react';
import { chatApi } from '../services/api';
import { dataService } from '../data/dataService';
import { useChatStore } from '../store/chatStore';
import ChatMessage from '../components/ChatMessage';
import type { Verse } from '../types';

const Chat = () => {
  const location = useLocation();
  const { messages, sessionId, language, setLanguage, setSessionId, addMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextVerse, setContextVerse] = useState<Verse | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', label: 'English', sub: 'en-IN' },
    { code: 'hi', label: 'Hindi', sub: 'hi-IN' },
    { code: 'bn', label: 'Bengali', sub: 'bn-IN' },
    { code: 'ta', label: 'Tamil', sub: 'ta-IN' },
    { code: 'te', label: 'Telugu', sub: 'te-IN' },
    { code: 'gu', label: 'Gujarati', sub: 'gu-IN' },
    { code: 'kn', label: 'Kannada', sub: 'kn-IN' },
    { code: 'ml', label: 'Malayalam', sub: 'ml-IN' },
    { code: 'mr', label: 'Marathi', sub: 'mr-IN' },
    { code: 'pa', label: 'Punjabi', sub: 'pa-IN' },
    { code: 'or', label: 'Odia', sub: 'or-IN' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  const hasSentInitialQuery = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);

  // Initialize: Clear stale history if no active session is continued
  useEffect(() => {
    // If we land here without a verse context (not continuing a specific thought)
    // and we don't have a session, ensure a clean slate
    if (!sessionId && messages.length > 0) {
      clearHistory();
    }
  }, []);

  // Handle incoming navigation state (e.g. from "Ask this shlok")
  useEffect(() => {
    const handleInitialState = async () => {
      if (location.state?.verseId && !hasSentInitialQuery.current) {
        hasSentInitialQuery.current = true;
        try {
          const v = dataService.getVerseById(location.state.verseId);
          if (v) {
            setContextVerse(v);
            setShowContext(true);
            
            if (location.state?.initialQuery) {
              handleSend(location.state.initialQuery, location.state.verseId);
            }
          }
        } catch (err) {
          console.error('Failed to load context verse:', err);
        }
        // Clear state so it doesn't trigger again on refresh
        window.history.replaceState({}, document.title);
      }
    };
    handleInitialState();
  }, [location.state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (queryText: string = input, verseId?: string) => {
    const trimmedQuery = queryText.trim();
    if (!trimmedQuery || isLoading) return;

    // 1. Generate unique stream ID for this request
    const streamId = Math.random().toString(36).substring(7);
    activeStreamIdRef.current = streamId;

    // Abort previous stream if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setInput('');
    addMessage({ role: 'user', content: trimmedQuery });
    setIsLoading(true);

    // Add empty AI message placeholder immediately and get its ID
    const aiMessageId = addMessage({
      role: 'ai',
      content: '',
    });

    try {
      const response = await chatApi.streamQuery(
        trimmedQuery, 
        sessionId || undefined, 
        verseId || (showContext ? contextVerse?.id : undefined),
        language,
        abortControllerRef.current.signal
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No reader available");

      let fullContent = "";
      let buffer = ""; // Buffer for partial chunks

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check if this stream is still the active one
        if (activeStreamIdRef.current !== streamId) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process buffer for complete SSE events
        // SSE events are separated by double newlines
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const eventBlock = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          
          if (eventBlock.startsWith('data: ')) {
            const dataStr = eventBlock.slice(6).trim();
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                
                // Double check activeStreamId before state update
                if (activeStreamIdRef.current === streamId) {
                  if (data.type === 'start') {
                    if (data.session_id && !sessionId) {
                      setSessionId(data.session_id);
                    }
                    useChatStore.getState().updateMessage(aiMessageId, {
                      verse: data.verse,
                      meta: data.meta
                    });
                  } else if (data.type === 'text') {
                    fullContent += data.content;
                    useChatStore.getState().updateMessage(aiMessageId, { content: fullContent });
                  } else if (data.type === 'error') {
                    throw new Error(data.message || 'Stream error');
                  } else if (data.type === 'end') {
                    // Done
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE JSON:", e, dataStr);
              }
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error: any) {
      // Only handle error if this is still the active stream
      if (activeStreamIdRef.current === streamId) {
        if (error.name === 'AbortError') {
          return;
        }
        
        console.error('Chat error details:', error);
        const errorMessage = error?.message || 'I apologize, but I am having trouble connecting to the sacred teachings right now. Please try again in a moment.';
        
        useChatStore.getState().updateMessage(aiMessageId, { content: errorMessage });
      }
    } finally {
      if (activeStreamIdRef.current === streamId) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-orange-500" size={24} />
          <span>Guide</span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-[11px] font-bold text-slate-700 rounded-xl hover:border-orange-200 transition-all shadow-sm"
            >
              <span>{currentLang.label}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showLangDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showLangDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowLangDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-40 bg-white border border-orange-50 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 py-1">
                  <div className="max-h-64 overflow-y-auto">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[11px] font-bold transition-colors ${
                          language === lang.code 
                            ? 'bg-orange-50 text-orange-600' 
                            : 'text-slate-600 hover:bg-orange-50/50 hover:text-orange-500'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {messages.length > 0 && (
            <button 
              onClick={clearHistory}
              className="flex items-center space-x-1 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {contextVerse && showContext && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 flex-shrink-0 relative">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
            <Info size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider">
              Context: Chapter {contextVerse.chapter}, Verse {contextVerse.verse}
            </h4>
            <p className="text-sm text-orange-700 truncate italic">
              {contextVerse.sanskrit}
            </p>
          </div>
          <button 
            onClick={() => setShowContext(false)}
            className="text-orange-300 hover:text-orange-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 mb-4 space-y-2 scroll-smooth min-h-0"
      >
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl shadow-inner">
              🕉️
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Welcome to Gita RAG</h2>
              <p className="text-slate-500 max-w-sm mt-2">
                Ask any question about life, duty, or spirituality, and receive guidance from the Bhagavad Gita.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg mt-4">
              {[
                "How can I find peace in difficult times?",
                "What is the importance of duty?",
                "How to handle fear and anxiety?",
                "Explain the path of devotion."
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="p-3 text-sm text-left border border-orange-100 bg-white rounded-xl hover:bg-orange-50 hover:border-orange-200 hover:shadow-md transition-all text-slate-700 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        {isLoading && (
          <div className="flex justify-start mb-6 animate-in fade-in duration-300">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-sm">
                <Bot size={18} className="animate-pulse" />
              </div>
              <div className="bg-white border border-orange-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div>
                </div>
                <span className="text-sm text-slate-500 italic">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative group flex-shrink-0">
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center bg-white rounded-xl border border-orange-100 shadow-sm focus-within:border-orange-300 transition-colors"
        >
          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? "Thinking..." : "Type your question here..."}
            className="flex-1 py-4 px-6 focus:outline-none text-slate-800 placeholder:text-slate-400 bg-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`p-3 mr-2 rounded-lg transition-all ${
              !input.trim() || isLoading 
                ? 'text-slate-300' 
                : 'text-white bg-orange-600 hover:bg-orange-700 shadow-sm active:scale-95'
            }`}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

// Internal Helper
const Bot = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export default Chat;
