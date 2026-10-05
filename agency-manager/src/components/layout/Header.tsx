'use client';
// src/components/layout/Header.tsx
// Persistent top header for KIRA dashboard:
// - Left: KIRA Agency brand identity, role badge, and workflow tagline
// - Upper Right: Search bar, user profile capsule, and Slidebar toggle button

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Avatar } from '@/components/ui/Avatar';

interface HeaderProps {
  rightSlot?: React.ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const { isOpen, toggle } = useSidebar();
  const { user } = useAuth();
  const { role, teamMember } = usePermission();

  const userName = teamMember?.name || user?.displayName || 'User';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-base))]/80 backdrop-blur-md">
      <div className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* 1. Brand identity, Role Badge & Tagline */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] rounded-xl"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-neutral-800 bg-black shadow-sm ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105">
            <img src="/logo.png" alt="KIRA Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-bold text-[rgb(var(--text-primary))] leading-tight truncate">
                KIRA Agency
              </span>
              {role && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgb(var(--primary-light))] text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20">
                  {role}
                </span>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5 truncate hidden sm:block">
              Live operational dashboard & social workflow
            </p>
          </div>
        </Link>

        {/* 2. Upper Right: Search Bar, Profile Capsule & Slidebar Toggle Button */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          {/* Global Search Bar */}
          <div className="w-36 xs:w-48 sm:w-56 md:w-64 lg:w-72">
            <GlobalSearch />
          </div>

          {/* User profile capsule */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-xs">
            <Avatar
              src={user?.photoURL}
              name={userName}
              size="sm"
            />
            <div className="text-left">
              <p className="text-xs font-semibold text-[rgb(var(--text-primary))] leading-tight truncate max-w-[80px] md:max-w-[120px]">
                {userName}
              </p>
            </div>
          </div>

          {rightSlot}

          {/* Slidebar toggle button (next to searchbar in upper right corner) */}
          <button
            type="button"
            onClick={toggle}
            className="w-10 h-10 flex items-center justify-center shrink-0 rounded-xl card shadow-xs
                       text-[rgb(var(--text-primary))] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))]
                       hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Toggle sidebar"
            aria-expanded={isOpen}
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span
              className={`inline-flex items-center justify-center transition-transform duration-300 ${
                isOpen ? 'rotate-90' : 'rotate-0'
              }`}
            >
              <Menu size={18} />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
