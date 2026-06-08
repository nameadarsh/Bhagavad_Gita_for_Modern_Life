import axios, { type AxiosRequestConfig } from 'axios';
import { API_URL, buildApiUrl } from './apiBase';

export { API_BASE_URL, API_URL, HAS_API_CONFIG, USE_RELATIVE_API, buildApiUrl, HEALTH_CHECK_URL } from './apiBase';

export const STATIC_AUDIO_BASE_URL = 'https://fshfxtshvffidmuevofm.supabase.co/storage/v1/object/public/rag_gita_static_audio';

/** Time until first byte of the chat response. Backend completes RAG + full LLM before streaming begins. */
const CHAT_CONNECT_TIMEOUT_MS = 180000;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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
  streamQuery: async (
    query: string,
    sessionId?: string,
    verseId?: string,
    language: string = 'en',
    signal?: AbortSignal
  ) => {
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
      const response = await api.post('/tts', { text, language });
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

      const response = await api.post(
        '/feedback',
        {
          rating,
          name: name?.trim() || undefined,
          feedback: feedback?.trim() || undefined,
        },
        {
          signal: controller.signal,
          skipRetry: true,
        } as AxiosRequestConfig & { skipRetry?: boolean }
      );

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

export async function requestWarmupRetry(): Promise<void> {
  await fetch(buildApiUrl('/api/v1/warmup/retry'), { method: 'POST' });
}

export default api;
