'use client';

import React from 'react';

const EmptyState = ({ onSuggestionClick }) => {
  const suggestions = [
    "What is dharma?",
    "I feel lost in life",
    "Explain karma yoga"
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="mb-6">
        <span className="text-[--color-saffron] text-6xl">☸</span>
      </div>
      
      <h2 className="font-display text-3xl md:text-4xl text-[--color-text-primary] mb-3">
        Begin your inquiry
      </h2>
      
      <p className="font-body text-base md:text-lg text-[--color-text-secondary] max-w-md mb-10 leading-relaxed">
        Ask anything about dharma, karma, purpose, or the Gita.
      </p>

      <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="border border-[--color-border] rounded-sm text-sm px-4 py-2.5 text-[--color-text-secondary] hover:bg-[--color-bg-subtle] hover:text-[--color-text-primary] transition-all cursor-pointer bg-white/50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmptyState;
