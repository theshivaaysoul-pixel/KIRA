'use client';
// src/components/content/ContentCard.tsx
// Clean, media-focused content card for the /content grid view.

import type { ContentWithRelations } from '@/lib/types/domain';
import { ContentTypeBadge } from './ContentBadges';
import { Edit3, Trash2, Eye, FileText, MoreVertical, RotateCcw, Clock, Archive } from 'lucide-react';
import { useState } from 'react';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface ContentCardProps {
  content: ContentWithRelations;
  onView: (content: ContentWithRelations) => void;
  onEdit: (content: ContentWithRelations) => void;
  onDelete: (content: ContentWithRelations) => void;
  onRestore?: (content: ContentWithRelations) => void;
  viewMode?: 'active' | 'archived' | 'bin';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ContentCard({
  content,
  onView,
  onEdit,
  onDelete,
  onRestore,
  viewMode = 'active',
}: ContentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isInBin = Boolean(content.deletedAt) || viewMode === 'bin';
  const isArchived = (content.status === 'ARCHIVED' && !isInBin) || viewMode === 'archived';

  const [nowTimestamp] = useState(() => Date.now());
  const daysLeft = content.deletedAt
    ? Math.max(0, Math.ceil((new Date(content.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - nowTimestamp) / (1000 * 60 * 60 * 24)))
    : 30;

  return (
    <article
      className={`card card-hover group relative flex flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden transition-all duration-200 hover:border-[rgb(var(--primary))]/30 hover:shadow-xl hover:-translate-y-1 ${isArchived ? 'opacity-60' : ''}`}
      aria-label={`Content: ${content.title}`}
    >
      {/* Media Placeholder */}
      <div
        className="relative h-44 bg-gradient-to-br from-[rgb(var(--muted))] to-[rgb(var(--card))] flex items-center justify-center cursor-pointer select-none overflow-hidden"
        onClick={() => onView(content)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onView(content)}
        aria-label={`View ${content.title}`}
      >
        {/* Soft overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none z-[1]" />

        {(() => {
          const firstImage = content.assets?.find((a) => a.type === 'IMAGE');
          const firstVideo = content.assets?.find((a) => a.type === 'VIDEO');

          if (firstImage) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/content/${content.id}/assets/${firstImage.id}/file`}
                alt={firstImage.fileName}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                loading="lazy"
              />
            );
          }

          if (firstVideo) {
            return (
              <video
                src={`/api/content/${content.id}/assets/${firstVideo.id}/file`}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                preload="metadata"
                playsInline
                muted
              />
            );
          }

          if (content.assetCount > 0) {
            return (
              <div className="flex flex-col items-center gap-2 text-[rgb(var(--muted-foreground))]">
                <FileText size={32} />
                <span className="text-xs font-medium">{content.assetCount} asset{content.assetCount !== 1 ? 's' : ''}</span>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center gap-2 text-[rgb(var(--muted-foreground))]">
              <div className="text-4xl opacity-50 select-none">
                {content.contentType === 'VIDEO' || content.contentType === 'REEL' || content.contentType === 'SHORT' ? '🎬' :
                  content.contentType === 'IMAGE' ? '🖼️' :
                    content.contentType === 'CAROUSEL' ? '🎠' :
                      content.contentType === 'STORY' ? '📖' :
                        content.contentType === 'LIVE' ? '🔴' : '📝'}
              </div>
              <span className="text-xs opacity-60">No media yet</span>
            </div>
          );
        })()}

        {/* Multi-asset count indicator */}
        {content.assetCount > 1 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium shadow-sm">
              📁 {content.assetCount}
            </span>
          </div>
        )}

        {/* Type badge top-left */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
            <ContentTypeBadge type={content.contentType} />
          </span>
        </div>

        {/* Publication count top-right */}
        {content.publicationCount > 0 && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-sm text-white text-xs">
              📤 {content.publicationCount}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-5 flex-1" style={{ padding: '1.25rem' }}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-semibold text-[rgb(var(--foreground))] leading-snug line-clamp-2 cursor-pointer hover:text-[rgb(var(--primary))] transition-colors flex-1"
            onClick={() => onView(content)}
          >
            {content.title}
          </h3>

          {/* Actions menu */}
          <div className="relative shrink-0">
            <button
              className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] transition-colors"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Content actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              id={`content-menu-${content.id}`}
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  className="absolute right-0 top-8 z-20 min-w-[140px] rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--popover,var(--card)))] shadow-xl py-1"
                  role="menu"
                  aria-labelledby={`content-menu-${content.id}`}
                >
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
                    onClick={() => { setMenuOpen(false); onView(content); }}
                    role="menuitem"
                  >
                    <Eye size={14} /> View
                  </button>

                  {/* Restore option if in Bin or Archived */}
                  {(isInBin || isArchived) && onRestore && (
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      onClick={() => { setMenuOpen(false); onRestore(content); }}
                      role="menuitem"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  )}

                  {!isArchived && !isInBin && (
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
                      onClick={() => { setMenuOpen(false); onEdit(content); }}
                      role="menuitem"
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                  )}

                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={() => { setMenuOpen(false); onDelete(content); }}
                    role="menuitem"
                  >
                    <Trash2 size={14} /> {isInBin ? 'Delete Permanently' : 'Move to Bin'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 30-Day Bin Countdown Alert Banner */}
        {isInBin && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-500">
              <Clock size={13} className="shrink-0" />
              <span>{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining</span>
            </span>
            <span className="text-[10px] text-[rgb(var(--muted-foreground))]">
              Auto-purges
            </span>
          </div>
        )}

        {/* Archived Banner */}
        {isArchived && !isInBin && (
          <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs text-blue-500 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Archive size={13} />
              <span>Archived</span>
            </span>
            <span className="text-[10px] text-[rgb(var(--muted-foreground))]">
              Preserved indefinitely
            </span>
          </div>
        )}

        {/* Target Platforms */}
        {content.targetPlatforms && content.targetPlatforms.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap" title="Target Platforms">
            {content.targetPlatforms.map((plt) => (
              <span
                key={plt.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgb(var(--muted))] text-[10px] font-medium text-[rgb(var(--foreground))]"
              >
                <PlatformIcon icon={plt.icon} name={plt.name} size={11} className="shrink-0" />
                <span>{plt.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Caption preview */}
        {content.caption && (
          <p className="text-xs text-[rgb(var(--muted-foreground))] line-clamp-2 leading-relaxed">
            {content.caption}
          </p>
        )}

        {/* Hashtags */}
        {content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {content.hashtags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-mono"
              >
                {tag}
              </span>
            ))}
            {content.hashtags.length > 4 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] text-xs">
                +{content.hashtags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Quick action buttons for Bin / Archived */}
        {(isInBin || isArchived) && (
          <div className="pt-2 border-t border-[rgb(var(--border))] flex items-center justify-between gap-2">
            {onRestore && (
              <button
                type="button"
                onClick={() => onRestore(content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors"
                title="Restore this content piece"
              >
                <RotateCcw size={13} />
                <span>Restore</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(content)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold transition-colors"
              title={isInBin ? "Permanently remove from everywhere" : "Move to Bin"}
            >
              <Trash2 size={13} />
              <span>{isInBin ? 'Delete Permanently' : 'Delete'}</span>
            </button>
          </div>
        )}

        {/* Footer meta */}
        <div className="mt-auto pt-2 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
          <span>{content.creator?.name || 'Unknown'}</span>
          <span title={new Date(content.updatedAt).toLocaleString()}>
            {formatDate(content.updatedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function ContentCardSkeleton() {
  return (
    <div className="card flex flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden animate-pulse">
      <div className="h-44 bg-[rgb(var(--muted))]" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-[rgb(var(--muted))] rounded-lg w-3/4" />
        <div className="h-6 bg-[rgb(var(--muted))] rounded-full w-1/3" />
        <div className="h-3 bg-[rgb(var(--muted))] rounded w-full" />
        <div className="h-3 bg-[rgb(var(--muted))] rounded w-2/3" />
        <div className="h-1.5 bg-[rgb(var(--muted))] rounded-full mt-4" />
      </div>
    </div>
  );
}
