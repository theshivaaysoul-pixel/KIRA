'use client';
// src/contexts/SidebarContext.tsx
// Unified responsive sidebar/slidebar state management across desktop and mobile.

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Default open on desktop, closed on mobile
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      } else {
        const saved = localStorage.getItem('kira_sidebar_desktop_open');
        setIsOpen(saved !== null ? saved === 'true' : true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
        localStorage.setItem('kira_sidebar_desktop_open', String(next));
      }
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      localStorage.setItem('kira_sidebar_desktop_open', 'true');
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      localStorage.setItem('kira_sidebar_desktop_open', 'false');
    }
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isOpen: mounted ? isOpen : true,
        toggle,
        open,
        close,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
