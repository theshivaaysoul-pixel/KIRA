'use client';
// src/components/dashboard/content-feed/ContentFeedImage.tsx
// High-fidelity image renderer for dashboard vertical content feed:
// - Real GCS-backed media through the secure server-side streaming route
// - Preserves aspect ratio with graceful backdrop styling
// - Native lazy-loading with subtle shimmer placeholder
// - Honest error handling if real image fails to load (no fake images)

import { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import type { ContentAsset } from '@/lib/types/domain';

interface ContentFeedImageProps {
  contentId: string;
  asset: ContentAsset;
  altText?: string;
}

export function ContentFeedImage({ contentId, asset, altText }: ContentFeedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageSrc = `/api/content/${contentId}/assets/${asset.id}/file`;

  return (
    <div className="relative w-full h-full min-h-[220px] bg-[rgb(var(--card-bg))] flex items-center justify-center overflow-hidden select-none">
      {/* Loading Skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgb(var(--bg-subtle))] animate-pulse z-10">
          <Loader2 size={28} className="animate-spin text-[rgb(var(--text-muted))]" />
        </div>
      )}

      {/* Real Error State (Never fake images) */}
      {hasError ? (
        <div className="flex flex-col items-center justify-center p-6 text-center text-[rgb(var(--text-muted))] gap-2">
          <ImageOff size={36} className="text-red-400/80 stroke-1" />
          <p className="text-xs font-medium">Unable to load media</p>
          <span className="text-[10px] text-[rgb(var(--text-muted))]/80 truncate max-w-xs">
            {asset.fileName}
          </span>
        </div>
      ) : (
        /* Native Lazy-loaded Image */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={altText || asset.fileName || 'Content image'}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
    </div>
  );
}
