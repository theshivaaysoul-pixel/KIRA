'use client';
// src/components/dashboard/content-feed/ContentFeedEmpty.tsx
// Honest empty state when no content exists in the agency system.
// Strictly NO fake posts, demo reels, or placeholder social cards.

import Link from 'next/link';
import { Film, Plus } from 'lucide-react';

export function ContentFeedEmpty() {
  return (
    <div className="w-full max-w-xl mx-auto p-8 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-center shadow-xs">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))]">
        <Film size={26} />
      </div>
      <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
        No content available yet.
      </h3>
      <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1.5 max-w-sm mx-auto">
        Create or upload content to see it here.
      </p>
      <div className="mt-5">
        <Link
          href="/content"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[rgb(var(--primary))] text-white shadow-xs hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          <span>Go to Content Studio</span>
        </Link>
      </div>
    </div>
  );
}
