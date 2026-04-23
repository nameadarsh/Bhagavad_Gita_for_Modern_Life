import apiClient from './apiClient';

export const chatService = {
  sendMessage: async (payload) => {
    try {
      const response = await apiClient.post('/api/chat', payload);
      return response.data;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  },

  streamMessage: async (payload, onChunk) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              onChunk(data);
            } catch (e) {
              console.error('Error parsing SSE line:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in streamMessage:', error);
      throw error;
    }
  },
};
