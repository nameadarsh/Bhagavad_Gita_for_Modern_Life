import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// Remove trailing slash to avoid //chat urls
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Add API prefix if needed (e.g., /api/v1)
const API_URL = `${API_BASE_URL}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
});

// Add request interceptor for logging
api.interceptors.request.use(config => {
  return config;
}, error => {
  return Promise.reject(error);
});

// Add response interceptor for retries and global error handling
api.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error;
    
    // Max 1 retry for 5xx errors or network errors
    if (!config || config._retry || (response && response.status < 500)) {
      return Promise.reject(error);
    }

    config._retry = true;
    
    // Wait 1s before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    return api(config);
  }
);

export const chatApi = {
  sendQuery: async (query: string, sessionId?: string, verseId?: string) => {
    const response = await api.post('/chat', {
      query,
      session_id: sessionId,
      verse_id: verseId,
    });
    return response.data;
  },
  streamQuery: async (query: string, sessionId?: string, verseId?: string, language: string = 'en', signal?: AbortSignal) => {
    return fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        query,
        session_id: sessionId,
        verse_id: verseId,
        language,
      }),
    });
  },
  generateTts: async (text: string, language: string = 'en') => {
    const response = await api.post('/tts', {
      text,
      language,
    });
    return response.data;
  },
};

export const gitaApi = {
  // Static content moved to local dataService
};

export default api;
