'use client';

import React from 'react';

const SectionLabel = ({ label, icon: Icon }) => {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={14} className="text-[--color-saffron]" />}
      <span className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em] text-[--color-saffron] font-body">
        {label}
      </span>
    </div>
  );
};

export default SectionLabel;
