'use client';

import React from 'react';
import { Compass } from 'lucide-react';
import SectionLabel from '../UI/SectionLabel';

const GuidanceSection = ({ content }) => {
  if (!content) return null;

  const items = Array.isArray(content) 
    ? content 
    : content.split('\n').filter(line => line.trim());

  return (
    <div className="flex flex-col">
      <SectionLabel label="Practical Guidance" icon={Compass} />
      <div className="flex flex-col gap-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-[--color-saffron] mt-1.5 flex-shrink-0">•</span>
            <p className="text-base text-[--color-text-secondary] leading-relaxed font-body">
              {item.replace(/^[•\-\*]\s*/, '')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuidanceSection;
