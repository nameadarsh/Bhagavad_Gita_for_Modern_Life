'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Clock, 
  BookOpen, 
  Settings,
  Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Chat', icon: MessageSquare, href: '/chat' },
    { label: 'History', icon: Clock, href: '/history' },
    { label: 'Explore', icon: BookOpen, href: '/explore' },
  ];

  const recentConversations = [
    // Placeholder for now
    { id: '1', preview: 'What is dharma?' },
    { id: '2', preview: 'How to handle stress?' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 h-full overflow-y-auto bg-[--color-bg-panel] border-r border-[--color-border] flex flex-col hidden md:flex">
      {/* Logo Row */}
      <div className="px-6 py-6 flex items-center gap-2">
        <span className="text-[--color-saffron] text-2xl">☸</span>
        <h1 className="font-display text-xl font-semibold text-[--color-text-primary] tracking-wide">
          Gita AI
        </h1>
      </div>

      <div className="flex-1 flex flex-col px-3">
        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-colors",
                  isActive 
                    ? "bg-[--color-bg-subtle] text-[--color-text-primary] font-medium" 
                    : "text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-subtle]"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="h-px bg-[--color-border] my-6 mx-4" />

        {/* Recent Conversations */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-[--color-text-muted] px-4 py-2">
            Recent
          </h3>
          <div className="space-y-0.5 mt-1">
            {recentConversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat?id=${conv.id}`}
                className="block text-sm text-[--color-text-secondary] px-4 py-2 truncate hover:text-[--color-text-primary] hover:bg-[--color-bg-subtle] rounded-sm cursor-pointer transition-colors"
              >
                {conv.preview}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 mt-auto">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-colors",
            pathname === '/profile'
              ? "bg-[--color-bg-subtle] text-[--color-text-primary] font-medium"
              : "text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-subtle]"
          )}
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
