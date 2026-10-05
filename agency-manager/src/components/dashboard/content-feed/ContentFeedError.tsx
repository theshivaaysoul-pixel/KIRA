'use client';
// src/components/dashboard/content-feed/ContentFeedError.tsx
// Honest error state with a real retry trigger when the Content API fails.

import { AlertCircle, RefreshCw } from 'lucide-react';

interface ContentFeedErrorProps {
  onRetry: () => void;
  message?: string;
}

export function ContentFeedError({ onRetry, message }: ContentFeedErrorProps) {
  return (
    <div className="w-full max-w-xl mx-auto p-8 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
        <AlertCircle size={24} />
      </div>
      <h3 className="text-base font-semibold text-[rgb(var(--text-primary))]">
        Unable to load content.
      </h3>
      {message && (
        <p className="text-xs text-[rgb(var(--text-muted))] mt-1 max-w-sm mx-auto">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors shadow-xs"
      >
        <RefreshCw size={14} />
        <span>Try again</span>
      </button>
    </div>
  );
}
