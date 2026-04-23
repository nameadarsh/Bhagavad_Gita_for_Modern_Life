import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  setSessionId: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      setSessionId: (id) => set({ sessionId: id }),
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      clearHistory: () => set({ messages: [], sessionId: null }),
    }),
    {
      name: 'gita-chat-storage',
    }
  )
);
