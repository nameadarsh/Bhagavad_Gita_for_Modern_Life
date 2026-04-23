import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useChatStore = create((set, get) => ({
  // State
  messages: [],          // Array of message objects
  isLoading: false,      // True when API call is in flight
  conversationId: null,  // Current conversation UUID
  error: null,           // Error string or null

  // Actions
  addUserMessage: (text) => {
    const newMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
      error: null,
    }));
    return newMessage;
  },

  addAIMessage: (response) => {
    const newMessage = {
      id: uuidv4(),
      role: 'assistant',
      sections: response.sections || {
        answer: response.response || '',
        explanation: '',
        guidance: '',
      },
      verses: response.verses || [],
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
      isLoading: false,
    }));
    return newMessage;
  },

  updateStreamingMessage: (delta) => {
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        // Create new assistant message if it doesn't exist
        const newMessage = {
          id: uuidv4(),
          role: 'assistant',
          sections: {
            answer: delta.type === 'answer_chunk' ? delta.content : '',
            explanation: delta.type === 'explanation_chunk' ? delta.content : '',
            guidance: delta.type === 'guidance_chunk' ? delta.content : '',
          },
          verses: delta.type === 'verse' ? [delta] : [],
          timestamp: new Date().toISOString(),
          isStreaming: true,
        };
        return { messages: [...state.messages, newMessage] };
      }

      // Update existing assistant message
      const updatedMessages = [...state.messages];
      const index = updatedMessages.length - 1;
      const msg = { ...updatedMessages[index] };

      if (delta.type === 'answer_chunk') msg.sections.answer += delta.content;
      if (delta.type === 'explanation_chunk') msg.sections.explanation += delta.content;
      if (delta.type === 'guidance_chunk') msg.sections.guidance += delta.content;
      if (delta.type === 'verse') msg.verses.push(delta);
      if (delta.type === 'done') {
        msg.isStreaming = false;
        if (delta.conversation_id) {
          return { messages: updatedMessages, conversationId: delta.conversation_id };
        }
      }

      updatedMessages[index] = msg;
      return { messages: updatedMessages };
    });
  },

  setLoading: (bool) => set({ isLoading: bool }),
  setConversationId: (id) => set({ conversationId: id }),
  resetChat: () => set({ messages: [], conversationId: null, error: null }),
  setError: (msg) => set({ error: msg, isLoading: false }),
}));

export default useChatStore;
