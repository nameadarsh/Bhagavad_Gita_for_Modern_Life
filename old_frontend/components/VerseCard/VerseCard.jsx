'use client';

import React from 'react';

const VerseCard = ({ chapter, verse, text, translation }) => {
  return (
    <div className="border-l-4 border-[--color-saffron] bg-[--color-saffron-subtle] rounded-r-md p-5 shadow-sm transition-all hover:shadow-md">
      <div className="text-xs font-semibold uppercase tracking-widest text-[--color-saffron] mb-3 font-body">
        Chapter {chapter}, Verse {verse}
      </div>

      {text && (
        <>
          <p className="font-devanagari text-lg md:text-xl text-[--color-text-primary] leading-loose mb-3">
            {text}
          </p>
          <div className="border-t border-[--color-border] mb-3 opacity-50" />
        </>
      )}

      <p className="font-verse text-base md:text-lg italic text-[--color-text-primary] leading-relaxed">
        "{translation}"
      </p>
    </div>
  );
};

export default VerseCard;
