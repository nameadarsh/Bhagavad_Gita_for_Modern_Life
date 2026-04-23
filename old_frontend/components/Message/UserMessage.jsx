'use client';

import React from 'react';

const UserMessage = ({ message }) => {
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex justify-end w-full">
      <div className="flex flex-col items-end max-w-[75%] md:max-w-[70%]">
        <div className="bg-[--color-user-bubble] px-5 py-3.5 rounded-md shadow-sm">
          <p className="font-body text-base text-[--color-text-primary] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        <span className="text-[11px] text-[--color-text-muted] mt-1.5 px-1 font-body">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};

export default UserMessage;
