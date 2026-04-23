'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';
import SectionLabel from '../UI/SectionLabel';

const AnswerSection = ({ content }) => {
  if (!content) return null;

  return (
    <div className="flex flex-col">
      <SectionLabel label="Answer" icon={Lightbulb} />
      <p className="text-lg md:text-xl text-[--color-text-primary] leading-relaxed font-body">
        {content}
      </p>
    </div>
  );
};

export default AnswerSection;
