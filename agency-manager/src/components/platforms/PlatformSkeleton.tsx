'use client';
// src/components/platforms/PlatformSkeleton.tsx
// Shimmer loading skeletons for platform grid and statistics.

import React from 'react';

export function PlatformSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats bar skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card flex flex-col justify-between"
            style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
          >
            <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
            <div className="h-6 w-12 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="h-10 w-full sm:w-72 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-10 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-24 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
              </div>
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-[rgb(var(--border))] flex justify-between items-center">
              <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
