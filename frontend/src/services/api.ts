import axios from 'axios';
import type { Verse, ChapterInfo, ChapterDetail } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
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
