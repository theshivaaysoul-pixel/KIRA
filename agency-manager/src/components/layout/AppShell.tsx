'use client';
// src/components/layout/AppShell.tsx
// Main authenticated layout wrapper — responsive sidebar + persistent header + content area.

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageTransition } from '@/components/motion';
import { useSidebar } from '@/contexts/SidebarContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { isOpen, isMobile } = useSidebar();
  const isDesktopClosed = !isMobile && !isOpen;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden relative bg-transparent">
      {/* Main content area — smoothly adjusts width when sidebar is toggled */}
      <div className={`app-shell-main ${isDesktopClosed ? 'sidebar-closed' : ''}`}>
        <Header />
        <main className="flex-1 w-full min-w-0 flex flex-col items-center">
          <div className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
      <Sidebar />
    </div>
  );
}
