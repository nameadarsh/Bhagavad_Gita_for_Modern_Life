'use client';

import React from 'react';
import AnswerSection from '../AIResponse/AnswerSection';
import ExplanationSection from '../AIResponse/ExplanationSection';
import VerseSection from '../AIResponse/VerseSection';
import GuidanceSection from '../AIResponse/GuidanceSection';

const AIMessage = ({ message }) => {
  const { sections, verses, timestamp, isStreaming } = message;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasContent = sections.answer || sections.explanation || sections.guidance || (verses && verses.length > 0);

  if (!hasContent && !isStreaming) return null;

  return (
    <div className="flex flex-col items-start w-full gap-y-6">
      {/* Sender Row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[--color-saffron] text-sm">☸</span>
        <span className="text-sm font-medium text-[--color-text-secondary] font-body">
          Gita AI
        </span>
      </div>

      {/* Sections Container */}
      <div className="flex flex-col gap-y-10 w-full">
        {sections.answer && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <AnswerSection content={sections.answer} />
            {isStreaming && sections.answer && !sections.explanation && (
              <span className="inline-block w-2 h-5 ml-1 bg-[--color-saffron] animate-pulse">▌</span>
            )}
          </div>
        )}

        {sections.explanation && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-px bg-[--color-border] opacity-50 mb-8" />
            <ExplanationSection content={sections.explanation} />
            {isStreaming && sections.explanation && !sections.guidance && (
              <span className="inline-block w-2 h-5 ml-1 bg-[--color-saffron] animate-pulse">▌</span>
            )}
          </div>
        )}

        {verses && verses.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-px bg-[--color-border] opacity-50 mb-8" />
            <VerseSection verses={verses} />
          </div>
        )}

        {sections.guidance && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-px bg-[--color-border] opacity-50 mb-8" />
            <GuidanceSection content={sections.guidance} />
            {isStreaming && sections.guidance && (
              <span className="inline-block w-2 h-5 ml-1 bg-[--color-saffron] animate-pulse">▌</span>
            )}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[11px] text-[--color-text-muted] mt-4 px-1 font-body">
        {formatTime(timestamp)}
      </span>
    </div>
  );
};

export default AIMessage;
