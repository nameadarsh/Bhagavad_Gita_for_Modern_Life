import axios, { type AxiosRequestConfig } from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Remove trailing slash to avoid //chat urls
export const API_BASE_URL = (rawBaseUrl || '').endsWith('/') ? rawBaseUrl.slice(0, -1) : (rawBaseUrl || '');

// Add API prefix if needed (e.g., /api/v1)
export const API_URL = `${API_BASE_URL}/api/v1`;

if (!rawBaseUrl) {
  console.error('CRITICAL: VITE_API_BASE_URL is not defined in the environment variables. Backend communication will fail.');
}
export const STATIC_AUDIO_BASE_URL = 'https://fshfxtshvffidmuevofm.supabase.co/storage/v1/object/public/rag_gita_static_audio';

/** Time until first byte of the chat response. Backend completes RAG + full LLM before streaming begins. */
const CHAT_CONNECT_TIMEOUT_MS = 180000;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
});

// Max 1 retry for 5xx errors or network errors (skipped when config.skipRetry is set)
api.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error;
    if (!config) {
      return Promise.reject(error);
    }
    if ((config as { skipRetry?: boolean }).skipRetry) {
      return Promise.reject(error);
    }

    if (config._retry || (response && response.status < 500)) {
      return Promise.reject(error);
    }

    config._retry = true;

    await new Promise(resolve => setTimeout(resolve, 1000));
    return api(config);
  }
);

export const chatApi = {
  streamQuery: async (query: string, sessionId?: string, verseId?: string, language: string = 'en', signal?: AbortSignal) => {
    const deadline = new AbortController();
    const deadlineId = window.setTimeout(() => deadline.abort(), CHAT_CONNECT_TIMEOUT_MS);

    if (signal) {
      if (signal.aborted) deadline.abort();
      else signal.addEventListener('abort', () => deadline.abort(), { once: true });
    }

    try {
      const response = await fetch(`${API_URL}/chat`, {
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
        signal: deadline.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Chat stream HTTP error:', response.status, text);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } finally {
      window.clearTimeout(deadlineId);
    }
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
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    try {
      if (feedback && feedback.length > 500) {
        throw new Error('Feedback is too long (max 500 characters)');
      }

      const response = await api.post('/feedback', {
        rating,
        name: name?.trim() || undefined,
        feedback: feedback?.trim() || undefined,
      }, {
        signal: controller.signal,
        skipRetry: true,
      } as AxiosRequestConfig & { skipRetry?: boolean });

      return response.data;
    } catch (error: unknown) {
      console.error('API submitFeedback error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Connection timed out. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
};

/** Ask the server to schedule another background warmup after failure. */
export async function requestWarmupRetry(): Promise<void> {
  if (!API_BASE_URL) return;
  await fetch(`${API_BASE_URL}/api/v1/warmup/retry`, { method: 'POST' });
}

export default api;
