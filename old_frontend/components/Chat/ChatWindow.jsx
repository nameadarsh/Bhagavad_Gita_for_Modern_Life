'use client';

import React, { useEffect, useRef } from 'react';
import UserMessage from '../Message/UserMessage';
import AIMessage from '../Message/AIMessage';
import EmptyState from '../UI/EmptyState';
import TypingIndicator from '../Loader/TypingIndicator';

const ChatWindow = ({ messages, isLoading, onSuggestionClick }) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Auto-scroll logic: only if near bottom
    const container = containerRef.current;
    if (container) {
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      
      if (isNearBottom || messages.length > 0) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <EmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <div 
      className="flex-1 overflow-y-auto scroll-smooth" 
      ref={containerRef}
    >
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-y-12 py-10 px-4 md:px-6">
        {messages.map((msg) => (
          msg.role === 'user' ? (
            <UserMessage key={msg.id} message={msg} />
          ) : (
            <AIMessage key={msg.id} message={msg} />
          )
        ))}
        
        {isLoading && <TypingIndicator />}
        
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default ChatWindow;
