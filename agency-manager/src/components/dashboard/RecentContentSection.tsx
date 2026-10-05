'use client';
// src/components/dashboard/RecentContentSection.tsx
// Visual recent content cards in Instagram-inspired presentation.
// Displays real thumbnails from ContentAssets or clean typography placeholders.

import { Image as ImageIcon, Video, Layers, Film, FileText, Plus } from 'lucide-react';
import type { DashboardRecentContentItem, ContentType, ContentStatus } from '@/lib/types/domain';
import { EmptyState } from '@/components/ui/Loading';

interface RecentContentSectionProps {
  items: DashboardRecentContentItem[];
  canCreateContent: boolean;
  onOpenCreate?: () => void;
}

export function RecentContentSection({
  items,
  canCreateContent,
  onOpenCreate,
}: RecentContentSectionProps) {
  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'VIDEO':
        return <Video size={14} />;
      case 'CAROUSEL':
        return <Layers size={14} />;
      case 'REEL':
      case 'STORY':
        return <Film size={14} />;
      case 'TEXT':
        return <FileText size={14} />;
      case 'IMAGE':
      default:
        return <ImageIcon size={14} />;
    }
  };

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case 'APPROVED':
      case 'PUBLISHED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'SCHEDULED':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'REVIEW':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'PRODUCTION':
      case 'EDITING':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'FAILED':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'IDEA':
      case 'SCRIPT':
      case 'ARCHIVED':
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
    }
  };

  return (
    <div className="card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
            Recent Content
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Active production & editorial queue
          </p>
        </div>
        {canCreateContent && (
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--primary))] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            <span>New Post</span>
          </button>
        )}
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          icon="🖼️"
          title="No content yet"
          description="Create your first piece of content to start building your media library and publishing schedule."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item) => (
            <div
              key={item.id}
              className="card group p-4 sm:p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--primary))]/30 transition-all flex flex-col justify-between"
            >
              {/* Top media placeholder or preview */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center mb-3">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[rgb(var(--text-muted))]">
                    {getContentTypeIcon(item.contentType)}
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      {item.contentType}
                    </span>
                  </div>
                )}
                {/* Status chip over media */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              {/* Title & metadata */}
              <div>
                <h3 className="text-xs font-semibold text-[rgb(var(--text-primary))] line-clamp-1 mb-1">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-[rgb(var(--text-muted))]">
                  <span>By {item.creatorName}</span>
                  <span className="font-mono text-[10px]">{item.id}</span>
                </div>
              </div>

              {/* Platform indicators */}
              {item.platformNames.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[rgb(var(--border))] flex items-center gap-1 flex-wrap">
                  {item.platformNames.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
