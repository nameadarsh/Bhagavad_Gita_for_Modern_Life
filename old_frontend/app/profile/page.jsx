'use client';

import React from 'react';

export default function ProfilePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[--color-bg-base]">
      <h1 className="font-display text-3xl text-[--color-text-primary]">User Settings</h1>
      <p className="font-body text-[--color-text-secondary] mt-4">Manage your preferences here.</p>
    </div>
  );
}
