'use client';
// src/components/dashboard/content-feed/ContentFeedSkeleton.tsx
// Card-based skeleton placeholder matching the card layout of ContentFeedItem

export function ContentFeedSkeleton() {
  return (
    <div
      className="card overflow-hidden p-0 h-full w-full animate-pulse flex flex-col justify-between"
      aria-label="Loading content..."
    >
      <div>
        {/* Header Skeleton */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-[rgb(var(--border))]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[rgb(var(--bg-subtle))]" />
            <div className="space-y-1">
              <div className="w-20 h-3 rounded-md bg-[rgb(var(--bg-subtle))]" />
              <div className="w-14 h-2 rounded-md bg-[rgb(var(--bg-subtle))]" />
            </div>
          </div>
          <div className="w-14 h-5 rounded-full bg-[rgb(var(--bg-subtle))]" />
        </div>

        {/* Media Skeleton */}
        <div className="w-full aspect-[16/10] bg-[rgb(var(--bg-subtle))]" />

        {/* Body Skeleton */}
        <div className="p-4 space-y-2.5">
          <div className="w-3/4 h-4 rounded-md bg-[rgb(var(--bg-subtle))]" />
          <div className="space-y-1.5">
            <div className="w-full h-3 rounded-md bg-[rgb(var(--bg-subtle))]" />
            <div className="w-5/6 h-3 rounded-md bg-[rgb(var(--bg-subtle))]" />
          </div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="p-4 pt-2 flex items-center justify-between border-t border-[rgb(var(--border))]/40">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-[rgb(var(--bg-subtle))]" />
          <div className="w-6 h-6 rounded-md bg-[rgb(var(--bg-subtle))]" />
        </div>
        <div className="w-20 h-3 rounded-md bg-[rgb(var(--bg-subtle))]" />
      </div>
    </div>
  );
}
