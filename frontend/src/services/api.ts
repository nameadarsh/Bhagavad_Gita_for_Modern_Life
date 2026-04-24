import axios from 'axios';
import type { Verse, ChapterInfo, ChapterDetail } from '../types';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// Remove trailing slash to avoid //chat urls
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Add API prefix if needed (e.g., /api/v1)
const API_URL = `${API_BASE_URL}/api/v1`;

console.log("Initializing API with BASE_URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for logging
api.interceptors.request.use(config => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
  return config;
}, error => {
  console.error("API Request Error:", error);
  return Promise.reject(error);
});

// Add response interceptor for logging
api.interceptors.response.use(response => {
  console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
  return response;
}, error => {
  console.error(`API Error: ${error.response?.status || 'Network Error'} ${error.config?.url}`, error.response?.data || error.message);
  return Promise.reject(error);
});

export const chatApi = {
  sendQuery: async (query: string, sessionId?: string, verseId?: string) => {
    const response = await api.post('/chat', {
      query,
      session_id: sessionId,
      verse_id: verseId,
    });
    return response.data;
  },
};

export const gitaApi = {
  getDaily: async (): Promise<Verse> => {
    const response = await api.get('/daily');
    return response.data;
  },
  getAllVerses: async (): Promise<Verse[]> => {
    const response = await api.get('/verses');
    return response.data;
  },
  getChapters: async (): Promise<ChapterInfo[]> => {
    const response = await api.get('/chapters');
    return response.data;
  },
  getChapter: async (chapterNumber: number): Promise<ChapterDetail> => {
    const response = await api.get(`/chapter/${chapterNumber}`);
    return response.data;
  },
  getVerse: async (id: string): Promise<Verse> => {
    const response = await api.get(`/verse/${id}`);
    return response.data;
  },
};

export default api;
