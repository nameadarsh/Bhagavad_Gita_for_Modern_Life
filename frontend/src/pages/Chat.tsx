import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Trash2, Sparkles, Info, X } from 'lucide-react';
import { chatApi, gitaApi } from '../services/api';
import { useChatStore } from '../store/chatStore';
import ChatMessage from '../components/ChatMessage';
import type { Verse } from '../types';

const Chat = () => {
  const location = useLocation();
  const { messages, sessionId, setSessionId, addMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextVerse, setContextVerse] = useState<Verse | null>(null);
  const [showContext, setShowContext] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentInitialQuery = useRef(false);

  // Handle incoming navigation state (e.g. from "Ask this shlok")
  useEffect(() => {
    const handleInitialState = async () => {
      if (location.state?.verseId && !hasSentInitialQuery.current) {
        hasSentInitialQuery.current = true;
        try {
          const v = await gitaApi.getVerse(location.state.verseId);
          setContextVerse(v);
          setShowContext(true);
          
          if (location.state?.initialQuery) {
            handleSend(location.state.initialQuery, location.state.verseId);
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

    setInput('');
    addMessage({ role: 'user', content: trimmedQuery });
    setIsLoading(true);

    try {
      const response = await chatApi.sendQuery(
        trimmedQuery, 
        sessionId || undefined, 
        verseId || (showContext ? contextVerse?.id : undefined)
      );
      
      if (response.session_id && !sessionId) {
        setSessionId(response.session_id);
      }

      addMessage({
        role: 'ai',
        content: response.answer,
        verse: response.verse,
        meta: response.meta
      });
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'ai',
        content: 'I apologize, but I am having trouble connecting to the sacred teachings right now. Please try again in a moment.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-orange-500" size={24} />
          <span>Guide</span>
        </h1>
        {messages.length > 0 && (
          <button 
            onClick={clearHistory}
            className="flex items-center space-x-1 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
            <span>Clear Conversation</span>
          </button>
        )}
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
          messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
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
