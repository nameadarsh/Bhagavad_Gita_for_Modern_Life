'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ChatWindow from '../../components/Chat/ChatWindow';
import InputBox from '../../components/InputBox/InputBox';
import { useChat } from '../../hooks/useChat';
import useChatStore from '../../store/chatStore';

export default function ChatPage() {
  const { messages, isLoading, sendMessage, streamMessage } = useChat();
  const { resetChat, error } = useChatStore();
  const [prefillValue, setPrefillValue] = useState('');

  const handleSend = (text) => {
    // You can toggle between sendMessage (non-streaming) and streamMessage (streaming)
    // For now, let's use streamMessage as it's more interactive
    streamMessage(text);
    setPrefillValue('');
  };

  const handleSuggestionClick = (text) => {
    setPrefillValue(text);
  };

  const handleNewChat = () => {
    resetChat();
    setPrefillValue('');
  };

  return (
    <div className="flex flex-col h-full bg-[--color-bg-base]">
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-[--color-border] flex-shrink-0 bg-white/30 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <span className="text-[--color-saffron] text-xl">☸</span>
          <span className="font-display text-xl md:text-2xl font-semibold text-[--color-text-primary]">
            Gita AI
          </span>
        </div>
        
        <button 
          onClick={handleNewChat}
          className="flex items-center gap-2 text-sm text-[--color-text-secondary] border border-[--color-border] rounded-sm px-3 py-1.5 hover:bg-[--color-bg-subtle] transition-colors"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </header>

      {/* Chat Window */}
      <ChatWindow 
        messages={messages} 
        isLoading={isLoading} 
        onSuggestionClick={handleSuggestionClick}
      />

      {/* Error Display */}
      {error && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-4">
          <div className="text-sm text-[--color-text-secondary] border border-[--color-border] rounded-sm p-4 flex items-center justify-between gap-3 bg-red-50/30">
            <div className="flex items-center gap-3">
              <span className="text-red-500">⚠</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={() => handleSend(messages[messages.length - 1]?.content)}
              className="text-[--color-saffron] font-medium hover:underline"
            >
              Retry ↺
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-[--color-border] bg-[--color-bg-base] px-4 py-6 md:px-12 pb-8">
        <InputBox 
          onSend={handleSend} 
          isLoading={isLoading} 
          prefillValue={prefillValue}
        />
      </div>
    </div>
  );
}
