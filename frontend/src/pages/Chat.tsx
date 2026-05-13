import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Trash2, Info, X, ChevronDown, MessageSquare } from 'lucide-react';
import { chatApi } from '../services/api';
import { dataService } from '../data/dataService';
import { useChatStore } from '../store/chatStore';
import { useBackendStore } from '../store/backendStore';
import ChatMessage from '../components/ChatMessage';
import type { Verse } from '../types';

const Chat = () => {
  const location = useLocation();
  const { messages, sessionId, language, setLanguage, setSessionId, addMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedContextVerseId, setDismissedContextVerseId] = useState<string | null>(null);
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
  const locationVerseId = location.state?.verseId as string | undefined;
  const contextVerse = useMemo<Verse | null>(() => {
    if (!locationVerseId || dismissedContextVerseId === locationVerseId) {
      return null;
    }

    try {
      return dataService.getVerseById(locationVerseId);
    } catch (err) {
      console.error('Failed to load context verse:', err);
      return null;
    }
  }, [dismissedContextVerseId, locationVerseId]);

  const hasSentInitialQuery = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const isBackendReady = useBackendStore((s) => s.isBackendReady);
  const warmupTimedOut = useBackendStore((s) => s.warmupTimedOut);
  const isSendDisabled = isLoading || !isBackendReady;

  // Initialize: Clear stale history if no active session is continued
  useEffect(() => {
    // If we land here without a verse context (not continuing a specific thought)
    // and we don't have a session, ensure a clean slate
    if (!sessionId && messages.length > 0) {
      clearHistory();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(async (queryText: string = input, verseId?: string) => {
    const trimmedQuery = queryText.trim();
    if (!trimmedQuery || isLoading || !isBackendReady) return;

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
        verseId || contextVerse?.id,
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
    } catch (error: unknown) {
      // Only handle error if this is still the active stream
      if (activeStreamIdRef.current === streamId) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        console.error('Chat error details:', error);
        const errorMessage = error instanceof Error
          ? error.message
          : 'I apologize, but I am having trouble connecting to the sacred teachings right now. Please try again in a moment.';
        
        useChatStore.getState().updateMessage(aiMessageId, { content: errorMessage });
      }
    } finally {
      if (activeStreamIdRef.current === streamId) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [addMessage, contextVerse?.id, input, isLoading, isBackendReady, language, sessionId, setSessionId]);

  // Handle incoming navigation state (e.g. from "Ask this shlok") — only after backend readiness
  useEffect(() => {
    if (!locationVerseId || !location.state?.initialQuery || hasSentInitialQuery.current) {
      return;
    }
    if (!isBackendReady) {
      return;
    }

    hasSentInitialQuery.current = true;
    void handleSend(location.state.initialQuery, locationVerseId);
  }, [location.state?.initialQuery, locationVerseId, isBackendReady, handleSend]);

  const showEmptyState = messages.length === 0;

  const renderInputForm = (isHero: boolean) => (
    <div className={`w-full max-w-2xl mx-auto relative group ${isHero ? 'mt-8' : ''}`}>
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="relative flex items-center bg-white rounded-xl border border-orange-100 shadow-sm focus-within:border-orange-300 transition-colors"
      >
        <input
          type="text"
          value={input}
          disabled={isLoading || !isBackendReady}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            !isBackendReady
              ? (warmupTimedOut ? 'Service unavailable — use banner to retry…' : 'Preparing guidance service…')
              : showEmptyState
                ? 'Ask anything about your situation…'
                : isLoading
                  ? 'Thinking…'
                  : 'Type your question here…'
          }
          className="flex-1 py-4 px-6 focus:outline-none text-slate-800 placeholder:text-slate-400 bg-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSendDisabled}
          className={`p-3 mr-2 rounded-lg transition-all active:scale-95 ${
            !input.trim() || isSendDisabled 
              ? 'text-slate-300' 
              : 'text-white bg-orange-600 hover:bg-orange-700 shadow-sm'
          }`}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] md:h-[75vh]">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h1 className="text-base md:text-lg font-semibold text-slate-500 text-center">
          Ask what truly weighs on your mind.
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl hover:border-orange-200 transition-all shadow-sm"
            >
              <span>{`Chat in: ${currentLang.label}`}</span>
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
              className="flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-orange-500 transition-colors underline underline-offset-2"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {contextVerse && (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 flex-shrink-0 relative">
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
            onClick={() => setDismissedContextVerseId(contextVerse.id)}
            className="text-orange-300 hover:text-orange-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showEmptyState ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-8">
          <div className="bg-indigo-50 p-6 rounded-full">
            <MessageSquare size={48} className="text-indigo-600" />
          </div>
          <p className="text-slate-500 text-xl font-medium max-w-sm mx-auto leading-relaxed">
            What is currently on your mind? Share your situation and receive guidance.
          </p>
          {renderInputForm(true)}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto pr-2 mb-6 space-y-4 scroll-smooth"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
          {renderInputForm(false)}
        </div>
      )}
    </div>
  );
};

export default Chat;
