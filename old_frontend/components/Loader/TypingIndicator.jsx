'use client';

import React from 'react';

const TypingIndicator = () => {
  return (
    <div className="flex flex-col items-start w-full gap-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[--color-saffron] text-sm">☸</span>
        <span className="text-sm font-medium text-[--color-text-secondary] font-body">
          Gita AI
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 px-1 py-2">
        <span className="w-1.5 h-1.5 bg-[--color-saffron] rounded-full animate-pulse [animation-delay:0ms]"></span>
        <span className="w-1.5 h-1.5 bg-[--color-saffron] rounded-full animate-pulse [animation-delay:150ms]"></span>
        <span className="w-1.5 h-1.5 bg-[--color-saffron] rounded-full animate-pulse [animation-delay:300ms]"></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
