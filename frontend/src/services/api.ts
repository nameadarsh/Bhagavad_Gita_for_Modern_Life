import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// Remove trailing slash to avoid //chat urls
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Add API prefix if needed (e.g., /api/v1)
const API_URL = `${API_BASE_URL}/api/v1`;

console.log("API URL initialized as:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
});

// Add request interceptor for logging
api.interceptors.request.use(config => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
  return config;
}, error => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

// Add response interceptor for retries and global error handling
api.interceptors.response.use(
  response => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  async error => {
    const { config, response } = error;
    console.error(`[API Response Error] ${response?.status || 'Network Error'} ${config?.url}`, error.message);
    
    // Max 1 retry for 5xx errors or network errors
    if (!config || config._retry || (response && response.status < 500)) {
      return Promise.reject(error);
    }

    config._retry = true;
    
    // Wait 1s before retrying
    console.log(`Retrying request: ${config.url}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return api(config);
  }
);

export const chatApi = {
  sendQuery: async (query: string, sessionId?: string, verseId?: string) => {
    try {
      const fullUrl = `${API_URL}/chat`;
      console.log("Calling (POST):", fullUrl);
      const response = await api.post('/chat', {
        query,
        session_id: sessionId,
        verse_id: verseId,
      });
      return response.data;
    } catch (error) {
      console.error("Fetch error (sendQuery):", error);
      throw error;
    }
  },
  streamQuery: async (query: string, sessionId?: string, verseId?: string, language: string = 'en', signal?: AbortSignal) => {
    const fullUrl = `${API_URL}/chat`;
    console.log("Calling (Stream):", fullUrl);
    try {
      const response = await fetch(fullUrl, {
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
      
      console.log("Stream response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Stream error response:", errorText);
      }
      return response;
    } catch (error) {
      console.error("Fetch error (streamQuery):", error);
      throw error;
    }
  },
  generateTts: async (text: string, language: string = 'en') => {
    try {
      const fullUrl = `${API_URL}/tts`;
      console.log("Calling (TTS):", fullUrl);
      const response = await api.post('/tts', {
        text,
        language,
      });
      return response.data;
    } catch (error) {
      console.error("Fetch error (generateTts):", error);
      throw error;
    }
  },
};

export const gitaApi = {
  // Static content moved to local dataService
};

export default api;
