import versesData from './gita.json';
import type { Verse, ChapterInfo, ChapterDetail } from '../types';

const verses: Verse[] = versesData as Verse[];

const versesById: Record<string, Verse> = {};
verses.forEach((v) => {
  versesById[v.id] = v;
});

const chapters: Record<number, any> = {};
verses.forEach((v) => {
  const ch = v.chapter;
  if (!chapters[ch]) {
    chapters[ch] = {
      chapter: ch,
      verses: [],
      speakers: {} as Record<string, number>,
      themes: {} as Record<string, number>,
    };
  }
  chapters[ch].verses.push(v);
  const speaker = (v.speaker || 'Unknown').trim();
  chapters[ch].speakers[speaker] = (chapters[ch].speakers[speaker] || 0) + 1;
  (v.themes || []).forEach((t) => {
    const theme = (t || '').trim().toLowerCase();
    if (theme) {
      chapters[ch].themes[theme] = (chapters[ch].themes[theme] || 0) + 1;
    }
  });
});

const chaptersInfo: ChapterInfo[] = Object.keys(chapters)
  .map(Number)
  .sort((a, b) => a - b)
  .map((ch) => {
    const obj = chapters[ch];
    const speakers = Object.entries(obj.speakers)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);
    const themes_top = Object.entries(obj.themes)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);
    return {
      chapter: ch,
      verse_count: obj.verses.length,
      speakers,
      themes_top,
    };
  });

export const dataService = {
  getAllVerses: () => verses,
  getVerseById: (id: string) => versesById[id] || null,
  getChapters: () => chaptersInfo,
  getChapterDetail: (chapterNumber: number): ChapterDetail | null => {
    const obj = chapters[chapterNumber];
    if (!obj) return null;
    return {
      info: {
        chapter: chapterNumber,
        verse_count: obj.verses.length,
        speakers: Object.entries(obj.speakers)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 10)
          .map((e) => e[0]),
        themes_top: Object.entries(obj.themes)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 10)
          .map((e) => e[0]),
      },
      verses: obj.verses,
    };
  },
  getDailyShlok: () => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // Simple hash function for the date string
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      const char = dateString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    
    const index = Math.abs(hash) % verses.length;
    return verses[index];
  },
};
