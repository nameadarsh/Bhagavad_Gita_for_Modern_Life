'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const InputBox = ({ onSend, isLoading, prefillValue = '' }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (prefillValue) {
      setInput(prefillValue);
      // Focus and adjust height
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight();
      }
    }
  }, [prefillValue]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '44px';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, 44), 160)}px`;
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
      }
    }
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto">
      <div className="flex flex-row items-end gap-3 w-full bg-white/50 p-1.5 rounded-md border border-[--color-border] focus-within:ring-2 focus-within:ring-[--color-focus-ring] focus-within:ring-offset-1 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about dharma, karma, purpose..."
          rows={1}
          className="flex-1 resize-none bg-transparent border-none px-3 py-2.5 text-base text-[--color-text-primary] placeholder:text-[--color-text-muted] font-body leading-relaxed focus:outline-none min-h-[44px]"
        />
        
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className={cn(
            "h-10 w-10 flex items-center justify-center rounded-sm flex-shrink-0 transition-colors mb-0.5",
            input.trim() && !isLoading
              ? "bg-[--color-saffron] text-white hover:bg-[#A85E20]"
              : "bg-[--color-border] text-[--color-text-muted] cursor-not-allowed"
          )}
        >
          <ArrowUp size={20} />
        </button>
      </div>
      
      <p className="hidden md:block text-[11px] text-[--color-text-muted] text-center mt-3 font-body">
        Gita AI may reflect interpretations. Always consult a teacher for deeper guidance.
      </p>
    </div>
  );
};

export default InputBox;
