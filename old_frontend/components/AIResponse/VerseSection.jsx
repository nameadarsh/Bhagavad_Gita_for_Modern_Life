'use client';

import React from 'react';
import { Quote } from 'lucide-react';
import SectionLabel from '../UI/SectionLabel';
import VerseCard from '../VerseCard/VerseCard';

const VerseSection = ({ verses }) => {
  if (!verses || verses.length === 0) return null;

  return (
    <div className="flex flex-col">
      <SectionLabel label="From the Gita" icon={Quote} />
      <div className="flex flex-col gap-y-4">
        {verses.map((v, i) => (
          <VerseCard 
            key={`${v.chapter}-${v.verse}-${i}`}
            chapter={v.chapter}
            verse={v.verse}
            text={v.text}
            translation={v.translation}
          />
        ))}
      </div>
    </div>
  );
};

export default VerseSection;
