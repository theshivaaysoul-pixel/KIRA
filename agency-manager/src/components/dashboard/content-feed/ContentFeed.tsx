'use client';
// src/components/dashboard/content-feed/ContentFeed.tsx
// Dashboard Content Feed Add-On:
// - Appended to the bottom of the KIRA Dashboard
// - Fetches strictly real agency content via /api/content?view=feed
// - Coordinated video playback manager ensuring only one active video plays at a time
// - Native infinite scrolling / load more pagination
// - Full responsiveness, dark mode compliance, and honest empty/error states

import { useState, useEffect, useCallback, useRef } from 'react';
import { Film, Loader2, Shuffle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentWithRelations, ContentQueryResult } from '@/lib/types/domain';
import { ContentFeedItem } from './ContentFeedItem';
import { ContentFeedSkeleton } from './ContentFeedSkeleton';
import { ContentFeedEmpty } from './ContentFeedEmpty';
import { ContentFeedError } from './ContentFeedError';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ContentFeed() {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ContentWithRelations[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coordinated video playback: at most ONE video plays at any given moment
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Sentinel ref for infinite scroll detection
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch feed content from existing KIRA Content API with authorized credentials
  const fetchFeed = useCallback(
    async (pageNum: number, isInitial = false) => {
      if (isInitial) {
        setIsLoadingInitial(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const token = await getIdToken();
        if (!token) {
          // If auth token is not yet ready, defer quietly without false error
          setIsLoadingInitial(false);
          setIsLoadingMore(false);
          return;
        }

        const res = await fetch(`/api/content?view=feed&page=${pageNum}&pageSize=50&shuffle=true`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`API returned HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message || 'Failed to load content');
        }

        const data: ContentQueryResult = json.data;
        const shuffledBatch = shuffleArray(data.items);

        setItems((prev) => (pageNum === 1 ? shuffledBatch : [...prev, ...shuffledBatch]));
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotalCount(data.total);
      } catch (err) {
        console.error('[ContentFeed] Error loading feed:', err);
        setError('Unable to retrieve the agency content feed. Please check connection and try again.');
      } finally {
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
      }
    },
    [getIdToken]
  );

  const handleShuffle = useCallback(() => {
    setItems((prev) => shuffleArray(prev));
  }, []);

  // Initial load once auth state is settled
  useEffect(() => {
    if (!authLoading && user) {
      fetchFeed(1, true);
    }
  }, [authLoading, user, fetchFeed]);

  // Video visibility coordinator callback
  const handleVideoVisibilityChange = useCallback((contentId: string, isVisible: boolean) => {
    setActiveVideoId((current) => {
      if (isVisible) {
        return contentId;
      }
      if (current === contentId) {
        return null;
      }
      return current;
    });
  }, []);

  // Infinite scroll trigger via IntersectionObserver on the bottom sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || isLoadingInitial || isLoadingMore || page >= totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && page < totalPages) {
          fetchFeed(page + 1, false);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchFeed, isLoadingInitial, isLoadingMore, page, totalPages]);

  return (
    <section
      className="mt-10 sm:mt-12 space-y-6"
      aria-label="Content Feed"
    >
      {/* 1. Feed Section Header Card */}
      <div className="card p-4 sm:p-5 flex items-center justify-between gap-3 border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))] shrink-0 border border-[rgb(var(--primary))]/20 shadow-xs">
            <Film size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))] tracking-tight truncate">
                Content Feed
              </h3>
              {totalCount > 0 && (
                <span className="shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                  {totalCount} {totalCount === 1 ? 'post' : 'posts'}
                </span>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5 truncate">
              Live stream of active, archived, and recoverable media
            </p>
          </div>
        </div>

        {/* Shuffle Button */}
        <button
          type="button"
          onClick={handleShuffle}
          disabled={isLoadingInitial || items.length === 0}
          title="Shuffle feed content"
          aria-label="Shuffle feed content"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:border-[rgb(var(--primary))]/40 hover:bg-[rgb(var(--card-bg))] transition-all shrink-0 cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
        >
          <Shuffle size={14} className="text-[rgb(var(--primary))]" />
          <span className="hidden sm:inline">Shuffle</span>
        </button>
      </div>

      {/* 2. Feed Cards Grid Container */}
      <div role="feed" aria-busy={isLoadingInitial} className="space-y-6">
        {/* Loading Initial Skeletons in Card Grid */}
        {isLoadingInitial && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <ContentFeedSkeleton key={n} />
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoadingInitial && error && (
          <ContentFeedError
            message={error}
            onRetry={() => fetchFeed(1, true)}
          />
        )}

        {/* Honest Empty State */}
        {!isLoadingInitial && !error && items.length === 0 && (
          <ContentFeedEmpty />
        )}

        {/* Content Stream: Card Grid */}
        {!isLoadingInitial && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {items.map((item) => (
                <ContentFeedItem
                  key={item.id}
                  content={item}
                  isActiveVideo={activeVideoId === item.id}
                  onVideoVisibilityChange={handleVideoVisibilityChange}
                />
              ))}
            </div>

            {/* Pagination / Infinite Scroll Bottom Sentinel */}
            <div ref={sentinelRef} className="py-4 flex flex-col items-center justify-center gap-3">
              {isLoadingMore && (
                <div className="flex items-center gap-2 py-4 text-xs text-[rgb(var(--text-muted))]">
                  <Loader2 size={16} className="animate-spin text-[rgb(var(--primary))]" />
                  <span>Loading more content...</span>
                </div>
              )}
              {!isLoadingMore && page < totalPages && (
                <button
                  type="button"
                  onClick={() => fetchFeed(page + 1, false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--primary))]/40 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  Load More Content ({totalCount - items.length} remaining)
                </button>
              )}
            </div>

            {/* End of Feed Message */}
            {page >= totalPages && items.length > 0 && (
              <div className="text-center py-6 border-t border-[rgb(var(--border))]/40">
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  You&apos;ve reached the end of the feed.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
