'use client';
// src/components/accounts/AccountSkeleton.tsx
// Shimmer skeleton loading cards matching AccountCard layout.

import React from 'react';

export function AccountSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] p-5 shadow-xs flex flex-col justify-between animate-pulse"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[rgb(var(--bg-subtle))]" />
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded-md bg-[rgb(var(--bg-subtle))]" />
                  <div className="h-3 w-20 rounded-md bg-[rgb(var(--bg-subtle))]" />
                </div>
              </div>
              <div className="h-5 w-16 rounded-full bg-[rgb(var(--bg-subtle))]" />
            </div>

            <div className="mt-3.5 space-y-1.5">
              <div className="h-3 w-full rounded-md bg-[rgb(var(--bg-subtle))]" />
              <div className="h-3 w-4/5 rounded-md bg-[rgb(var(--bg-subtle))]" />
            </div>

            <div className="mt-4 pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[rgb(var(--bg-subtle))]" />
                <div className="h-3 w-20 rounded-md bg-[rgb(var(--bg-subtle))]" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-8 rounded-md bg-[rgb(var(--bg-subtle))]" />
                <div className="h-3 w-8 rounded-md bg-[rgb(var(--bg-subtle))]" />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between">
            <div className="h-6 w-16 rounded-lg bg-[rgb(var(--bg-subtle))]" />
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-lg bg-[rgb(var(--bg-subtle))]" />
              <div className="h-6 w-6 rounded-lg bg-[rgb(var(--bg-subtle))]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
