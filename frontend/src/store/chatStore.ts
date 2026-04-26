import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  setSessionId: (id: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  updateLastMessage: (updates: Partial<ChatMessage>) => void;
  clearHistory: () => void;
  language: string;
  setLanguage: (lang: string) => void;
  // Global Audio State
  playingMessageId: string | null;
  playingAudioType: 'chat' | 'shlok' | 'translation' | 'explanation' | null;
  setPlayingAudio: (id: string | null, type: 'chat' | 'shlok' | 'translation' | 'explanation' | null) => void;
  globalAudio: HTMLAudioElement | null;
  audioQueue: string[];
  currentChunkIndex: number;
  stopAudio: () => void;
  playAudio: (id: string, urls: string[], type: 'chat' | 'shlok' | 'translation' | 'explanation', onStart?: () => void, onEnd?: () => void, onError?: (err: string) => void) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      messages: [],
      setSessionId: (id) => set({ sessionId: id }),
      addMessage: (message) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ 
          messages: [...state.messages, { ...message, id }] 
        }));
        return id;
      },
      updateMessage: (id, updates) => set((state) => ({
        messages: state.messages.map((msg) => 
          msg.id === id ? { ...msg, ...updates } : msg
        )
      })),
      updateLastMessage: (updates) => set((state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'ai') return state;
        
        const newMessages = [...state.messages];
        newMessages[newMessages.length - 1] = { ...lastMessage, ...updates };
        return { messages: newMessages };
      }),
      clearHistory: () => {
        const { stopAudio } = get();
        stopAudio();
        set({ messages: [], sessionId: null });
        localStorage.removeItem('gita-chat-storage');
      },
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
      // Global Audio Implementation
      playingMessageId: null,
      playingAudioType: null,
      globalAudio: null,
      audioQueue: [],
      currentChunkIndex: 0,
      setPlayingAudio: (id, type) => set({ playingMessageId: id, playingAudioType: type }),
      
      stopAudio: () => {
        const { globalAudio } = get();
        if (globalAudio) {
          globalAudio.pause();
          globalAudio.src = "";
          globalAudio.onplay = null;
          globalAudio.onended = null;
          globalAudio.onerror = null;
        }
        set({ 
          globalAudio: null, 
          playingMessageId: null, 
          playingAudioType: null,
          audioQueue: [], 
          currentChunkIndex: 0 
        });
      },

      playAudio: async (id, urls, type, onStart, onEnd, onError) => {
        const { stopAudio, playingMessageId, playingAudioType } = get();

        // Toggle logic: if same audio is playing, stop and return
        if (playingMessageId === id && playingAudioType === type) {
          stopAudio();
          return;
        }

        // Stop any currently playing audio before starting new one
        stopAudio();

        if (!urls || urls.length === 0) {
          // Silent fail as requested
          return;
        }

        set({ audioQueue: urls, currentChunkIndex: 0 });

        const playChunk = async (index: number) => {
          if (index >= urls.length) {
            set({ playingMessageId: null, playingAudioType: null });
            onEnd?.();
            return;
          }

          set({ currentChunkIndex: index });
          const audio = new Audio(urls[index]);
          
          // Preload next
          if (index + 1 < urls.length) {
            new Audio(urls[index + 1]).load();
          }

          audio.onplay = () => {
            set({ playingMessageId: id, playingAudioType: type });
            onStart?.();
          };

          audio.onended = () => {
            playChunk(index + 1);
          };

          audio.onerror = () => {
            console.error(`Error playing chunk ${index} type=${type}`);
            if (index + 1 < urls.length) {
              playChunk(index + 1);
            } else {
              set({ playingMessageId: null, playingAudioType: null });
              // Silent fail
            }
          };

          set({ globalAudio: audio });
          try {
            await audio.play();
          } catch (e) {
            console.error("Playback failed:", e);
            set({ playingMessageId: null, playingAudioType: null });
            // Silent fail
          }
        };

        await playChunk(0);
      },
    }),
    {
      name: 'gita-chat-storage',
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages,
        language: state.language,
      }), // Don't persist audio objects
    }
  )
);
