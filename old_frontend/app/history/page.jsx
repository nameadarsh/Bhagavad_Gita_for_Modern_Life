'use client';

import React from 'react';

export default function HistoryPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[--color-bg-base]">
      <h1 className="font-display text-3xl text-[--color-text-primary]">Conversations</h1>
      <p className="font-body text-[--color-text-secondary] mt-4">Past conversations will appear here.</p>
    </div>
  );
}
