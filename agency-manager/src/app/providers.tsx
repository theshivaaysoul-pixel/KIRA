'use client';
// src/app/providers.tsx
// All client-side providers in one place — keeps layout.tsx a Server Component.

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { MotionProvider } from '@/components/motion';

import { SidebarProvider } from '@/contexts/SidebarContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <SidebarProvider>
          <ToastProvider>
            <MotionProvider>
              {children}
            </MotionProvider>
          </ToastProvider>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
