'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import SectionLabel from '../UI/SectionLabel';

const ExplanationSection = ({ content }) => {
  if (!content) return null;

  const paragraphs = content.split('\n\n').filter(p => p.trim());

  return (
    <div className="flex flex-col">
      <SectionLabel label="Explanation" icon={BookOpen} />
      <div className="space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-base md:text-lg text-[--color-text-primary] leading-relaxed font-body">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
};

export default ExplanationSection;
