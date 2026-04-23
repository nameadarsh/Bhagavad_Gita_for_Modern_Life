import apiClient from './apiClient';

export const historyService = {
  getConversations: async () => {
    try {
      const response = await apiClient.get('/api/conversations');
      return response.data;
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  },

  getConversation: async (id) => {
    try {
      const response = await apiClient.get(`/api/conversations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error in getConversation:', error);
      throw error;
    }
  },
};
