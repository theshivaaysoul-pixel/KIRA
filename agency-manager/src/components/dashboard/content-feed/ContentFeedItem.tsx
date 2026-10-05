'use client';
// src/components/dashboard/content-feed/ContentFeedItem.tsx
// Modern media card presentation for dashboard content feed.
// Displays real GCS media, creator avatar "Ryuk", live status badges,
// platform indicators, and direct studio navigation.

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, Archive, ExternalLink, FileText } from 'lucide-react';
import type { ContentWithRelations } from '@/lib/types/domain';
import { StatusBadge, ContentTypeBadge } from '@/components/content/ContentBadges';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { ContentFeedVideo } from './ContentFeedVideo';
import { ContentFeedImage } from './ContentFeedImage';

interface ContentFeedItemProps {
  content: ContentWithRelations;
  isActiveVideo: boolean;
  onVideoVisibilityChange: (contentId: string, isVisible: boolean) => void;
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export function ContentFeedItem({
  content,
  isActiveVideo,
  onVideoVisibilityChange,
}: ContentFeedItemProps) {
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const isDeleted = Boolean(content.deletedAt);
  const isArchived = content.status === 'ARCHIVED' && !isDeleted;

  // Identify real media assets
  const videoAsset = content.assets?.find((a) => a.type === 'VIDEO');
  const imageAsset = content.assets?.find((a) => a.type === 'IMAGE');

  const captionText = content.caption?.trim() || content.description?.trim() || '';
  const isLongCaption = captionText.length > 110;

  return (
    <article
      className={`card card-hover w-full h-full flex flex-col justify-between overflow-hidden p-0 transition-all duration-300 border ${
        isDeleted
          ? 'border-amber-500/40 bg-[rgb(var(--card-bg))]/90 opacity-85'
          : isArchived
          ? 'border-[rgb(var(--border))]/80 bg-[rgb(var(--card-bg))] opacity-90'
          : 'border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--primary))]/40'
      }`}
      aria-label={`Feed item: ${content.title}`}
    >
      <div className="flex-1 flex flex-col">
        {/* 1. Card Header: Creator Info, Date, Status Badges */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-[rgb(var(--border))]/40 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-red-500/30 ring-1 ring-red-500/20 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ryuk.jpg"
                alt="Ryuk"
                className="w-full h-full object-cover object-[center_38%]"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[rgb(var(--text-primary))] truncate">
                  Ryuk
                </span>
                <span className="text-[10px] text-[rgb(var(--text-muted))] shrink-0">•</span>
                <time
                  dateTime={content.updatedAt || content.createdAt}
                  className="text-[11px] text-[rgb(var(--text-muted))] shrink-0"
                >
                  {formatRelativeDate(content.updatedAt || content.createdAt)}
                </time>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <ContentTypeBadge type={content.contentType} />
              </div>
            </div>
          </div>

          {/* Status / Trash Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isDeleted ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30"
                title={`Soft-deleted on ${new Date(content.deletedAt!).toLocaleDateString()}`}
              >
                <Trash2 size={12} />
                <span>In Trash</span>
              </span>
            ) : isArchived ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
                <Archive size={12} />
                <span>Archived</span>
              </span>
            ) : (
              <StatusBadge status={content.status} />
            )}
          </div>
        </div>

        {/* 2. Media Presentation (Real GCS video or image) */}
        <div className="relative w-full aspect-[16/10] bg-black/5 dark:bg-black/40 overflow-hidden flex items-center justify-center">
          {videoAsset ? (
            <ContentFeedVideo
              contentId={content.id}
              asset={videoAsset}
              isActive={isActiveVideo}
              isDeleted={isDeleted}
              onVisibilityChange={onVideoVisibilityChange}
            />
          ) : imageAsset ? (
            <ContentFeedImage
              contentId={content.id}
              asset={imageAsset}
              altText={content.title}
            />
          ) : (
            /* Text-only or document content */
            <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-[rgb(var(--bg-subtle))] to-[rgb(var(--card-bg))]">
              <div className="w-10 h-10 rounded-xl bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))] mb-2 shadow-xs">
                <FileText size={20} />
              </div>
              <p className="text-xs font-semibold text-[rgb(var(--text-primary))] line-clamp-2">
                {content.title}
              </p>
              {content.assetCount > 0 && (
                <span className="text-[10px] text-[rgb(var(--text-muted))] mt-1">
                  {content.assetCount} asset{content.assetCount !== 1 ? 's' : ''} attached
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. Card Body: Title, Caption, Hashtags */}
        <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-start">
          {/* Title */}
          <h4 className="text-sm font-bold text-[rgb(var(--text-primary))] leading-snug line-clamp-2">
            {content.title}
          </h4>

          {/* Caption */}
          {captionText && (
            <div className="text-xs text-[rgb(var(--text-muted))] leading-relaxed">
              <p className={!captionExpanded && isLongCaption ? 'line-clamp-2' : ''}>
                {captionText}
              </p>
              {isLongCaption && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded((prev) => !prev)}
                  className="text-xs font-semibold text-[rgb(var(--primary))] hover:underline mt-1 cursor-pointer"
                >
                  {captionExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Hashtags */}
          {content.hashtags && content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5 mt-auto">
              {content.hashtags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-[11px] font-medium text-[rgb(var(--primary))] hover:underline cursor-default"
                >
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
              {content.hashtags.length > 3 && (
                <span className="text-[10px] text-[rgb(var(--text-muted))] self-center">
                  +{content.hashtags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Footer: Target Platforms & Studio Link */}
      <div className="p-4 pt-2.5 flex items-center justify-between border-t border-[rgb(var(--border))]/40 gap-2 mt-auto">
        {/* Target Platforms */}
        <div className="flex items-center gap-1.5">
          {content.targetPlatforms && content.targetPlatforms.length > 0 ? (
            content.targetPlatforms.map((plt) => (
              <div
                key={plt.id}
                className="w-6 h-6 rounded-md bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center p-0.5"
                title={plt.name}
              >
                <PlatformIcon
                  icon={plt.icon}
                  name={plt.name}
                  platformName={plt.slug}
                  size={14}
                  className="w-3.5 h-3.5"
                />
              </div>
            ))
          ) : (
            <span className="text-[11px] text-[rgb(var(--text-muted))]">
              No platform
            </span>
          )}
        </div>

        {/* Action Link */}
        <Link
          href="/content"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--text-muted))] hover:text-[rgb(var(--primary))] transition-colors"
          title="Open in Content Studio"
        >
          <span>View in Studio</span>
          <ExternalLink size={13} />
        </Link>
      </div>
    </article>
  );
}
