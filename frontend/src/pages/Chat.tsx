import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Trash2, Info, X, ChevronDown } from 'lucide-react';
import { chatApi } from '../services/api';
import { dataService } from '../data/dataService';
import { useChatStore } from '../store/chatStore';
import { useBackendStore } from '../store/backendStore';
import ChatMessage from '../components/ChatMessage';
import type { Verse } from '../types';

const Chat = () => {
  const location = useLocation();
  const { messages, sessionId, language, setLanguage, setSessionId, addMessage, clearHistory } = useChatStore();
  const { isBackendReady, isWarmingUp, warmupTimedOut, restartWarmup } = useBackendStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedContextVerseId, setDismissedContextVerseId] = useState<string | null>(null);
  const [pendingQueuedQuery, setPendingQueuedQuery] = useState<string | null>(null);
  const [showReadyNotice, setShowReadyNotice] = useState(false);
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
  const previousReadyRef = useRef(isBackendReady);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const queuedQueryRef = useRef<{ query: string; verseId?: string } | null>(null);
  const isSendDisabled = isLoading || warmupTimedOut;

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
    if (!trimmedQuery || isLoading) return;

    if (!isBackendReady) {
      queuedQueryRef.current = { query: trimmedQuery, verseId };
      setPendingQueuedQuery(trimmedQuery);
      return;
    }

    // 1. Generate unique stream ID for this request
    const streamId = Math.random().toString(36).substring(7);
    activeStreamIdRef.current = streamId;

    // Abort previous stream if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setInput('');
    setPendingQueuedQuery(null);
    queuedQueryRef.current = null;
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
  }, [addMessage, contextVerse?.id, input, isBackendReady, isLoading, language, sessionId, setSessionId]);

  // Handle incoming navigation state (e.g. from "Ask this shlok")
  useEffect(() => {
    if (!locationVerseId || !location.state?.initialQuery || !isBackendReady || hasSentInitialQuery.current) {
      return;
    }

    hasSentInitialQuery.current = true;
    void handleSend(location.state.initialQuery, locationVerseId);
    window.history.replaceState({}, document.title);
  }, [handleSend, isBackendReady, location.state, locationVerseId]);

  useEffect(() => {
    if (!isBackendReady || isLoading || !queuedQueryRef.current) {
      return;
    }

    const queued = queuedQueryRef.current;
    void handleSend(queued.query, queued.verseId);
  }, [handleSend, isBackendReady, isLoading]);

  useEffect(() => {
    if (!previousReadyRef.current && isBackendReady) {
      setShowReadyNotice(true);
      const timeoutId = window.setTimeout(() => {
        setShowReadyNotice(false);
      }, 3000);

      previousReadyRef.current = isBackendReady;
      return () => window.clearTimeout(timeoutId);
    }

    previousReadyRef.current = isBackendReady;
  }, [isBackendReady]);

  const handleRetryWarmup = () => {
    restartWarmup();
  };

  const showEmptyState = messages.length === 0 && !isLoading;

  const renderInputForm = (isCentered = false) => (
    <div className={`relative group ${isCentered ? 'w-full max-w-2xl mt-6' : 'flex-shrink-0'}`}>
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
          placeholder={showEmptyState ? "Ask anything about your situation..." : !isBackendReady ? "Type now, your message will send when ready..." : isLoading ? "Thinking..." : "Type your question here..."}
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
    <div className="flex flex-col h-[calc(100vh-11rem)] md:h-[70vh]">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
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
            onClick={() => setDismissedContextVerseId(contextVerse.id)}
            className="text-orange-300 hover:text-orange-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showReadyNotice && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-medium text-emerald-700 shadow-sm flex-shrink-0">
          Chat is ready
        </div>
      )}

      {!isBackendReady && (
        <div className="mb-4 p-4 bg-white border border-orange-100 rounded-2xl shadow-sm flex-shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              {warmupTimedOut ? (
                <>
                  <h2 className="text-sm font-semibold text-slate-800">Server is taking longer than expected</h2>
                  <p className="text-sm text-slate-500 mt-1">Please try again.</p>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-slate-800">Preparing guidance... this may take a moment.</h2>
                </>
              )}
              {pendingQueuedQuery && (
                <p className="text-sm text-orange-600 mt-2">Your message is queued and will send automatically once ready.</p>
              )}
            </div>
            {warmupTimedOut ? (
              <button
                type="button"
                onClick={handleRetryWarmup}
                className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-sm"
              >
                Retry
              </button>
            ) : (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
              </div>
            )}
          </div>
          {!warmupTimedOut && (
            <div className="h-2 w-full bg-orange-100 rounded-full overflow-hidden">
              <div className={`h-full w-1/3 bg-orange-500 rounded-full ${isWarmingUp ? 'animate-pulse' : ''}`}></div>
            </div>
          )}
        </div>
      )}

      {showEmptyState ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-gray-500 text-lg font-medium">Ask what truly weighs on your mind.</p>
          {renderInputForm(true)}
        </div>
      ) : (
        <>
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto pr-2 mb-4 space-y-2 scroll-smooth min-h-0"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
          {renderInputForm(false)}
        </>
      )}
    </div>
  );
};

export default Chat;
