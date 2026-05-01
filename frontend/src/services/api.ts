import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Remove trailing slash to avoid //chat urls
export const API_BASE_URL = (rawBaseUrl || '').endsWith('/') ? rawBaseUrl.slice(0, -1) : (rawBaseUrl || '');

// Add API prefix if needed (e.g., /api/v1)
export const API_URL = `${API_BASE_URL}/api/v1`;

if (!rawBaseUrl) {
  console.error('CRITICAL: VITE_API_BASE_URL is not defined in the environment variables. Backend communication will fail.');
}
export const STATIC_AUDIO_BASE_URL = 'https://fshfxtshvffidmuevofm.supabase.co/storage/v1/object/public/rag_gita_static_audio';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
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
    try {
      const response = await api.post('/chat', {
        query,
        session_id: sessionId,
        verse_id: verseId,
      });
      return response.data;
    } catch (error) {
      console.error('API sendQuery error:', error);
      throw error;
    }
  },
  streamQuery: async (query: string, sessionId?: string, verseId?: string, language: string = 'en', signal?: AbortSignal) => {
    const fetchWithTimeout = async (resource: string, options: any) => {
      const { timeout = 8000 } = options;
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      const combinedSignal = signal 
        ? (signal.addEventListener('abort', () => controller.abort()), controller.signal)
        : controller.signal;

      try {
        const fullUrl = resource.startsWith('http') ? resource : `${window.location.origin}${resource}`;
        console.log("Fetching from:", fullUrl);
        console.log("Sending payload:", { query, session_id: sessionId, verse_id: verseId, language });
        
        const response = await fetch(resource, {
          ...options,
          signal: combinedSignal,
        });
        clearTimeout(id);
        
        if (!response.ok) {
          const text = await response.text();
          console.error("HTTP ERROR:", response.status, text);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
      } catch (err) {
        console.error("FETCH FAILED:", err);
        throw err;
      }
    };

    return fetchWithTimeout(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        session_id: sessionId,
        verse_id: verseId,
        language,
      }),
      timeout: 6000, // 6 seconds timeout for stream initiation
    });
  },
  generateTts: async (text: string, language: string = 'en') => {
    try {
      const response = await api.post('/tts', {
        text,
        language,
      });
      return response.data;
    } catch (error) {
      console.error('API generateTts error:', error);
      throw error;
    }
  },
  submitFeedback: async (rating: number, name?: string, feedback?: string) => {
    try {
      if (feedback && feedback.length > 500) {
        throw new Error('Feedback is too long (max 500 characters)');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await api.post('/feedback', {
        rating,
        name: name?.trim() || undefined,
        feedback: feedback?.trim() || undefined,
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.data;
    } catch (error: any) {
      console.error('API submitFeedback error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Connection timed out. Please try again.');
      }
      throw error;
    }
  },
};

export const gitaApi = {
  // Static content moved to local dataService
};

export default api;
