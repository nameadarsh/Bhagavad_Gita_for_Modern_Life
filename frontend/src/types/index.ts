export interface Verse {
  id: string;
  chapter: number;
  verse: number;
  speaker: string;
  sanskrit: string;
  english: string;
  brief_explanation: string;
  themes: string[];
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  verse?: Verse;
  meta?: any;
}

export interface ChapterInfo {
  chapter: number;
  verse_count: number;
  speakers: string[];
  themes_top: string[];
}

export interface ChapterDetail {
  info: ChapterInfo;
  verses: Verse[];
}
