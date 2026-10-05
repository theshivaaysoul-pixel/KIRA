'use client';
// src/components/content/ContentDetailsModal.tsx
// Full content detail view with workflow actions, publication records, and assets.

import { useState, useId } from 'react';
import { X, Edit3, Send } from 'lucide-react';
import type { ContentWithRelations, ContentStatus, TeamMember } from '@/lib/types/domain';
import { ContentTypeBadge } from './ContentBadges';
import { getAllowedTransitions } from '@/lib/content/workflow-transitions';
import { MediaManager } from './MediaManager';
import { ContentPlatformToggles } from './ContentPlatformToggles';

interface ContentDetailsModalProps {
  open: boolean;
  content: ContentWithRelations | null;
  actor: Pick<TeamMember, 'role' | 'id' | 'name' | 'authUid'> | null;
  onClose: () => void;
  onEdit: (content: ContentWithRelations) => void;
  onTransition: (id: string, status: ContentStatus) => Promise<void>;
  onContentUpdated?: () => void;
  onContentArchived?: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


export function ContentDetailsModal({
  open,
  content,
  actor,
  onClose,
  onEdit,
  onTransition,
  onContentUpdated,
  onContentArchived,
}: ContentDetailsModalProps) {
  const uid = useId();
  const [transitioning, setTransitioning] = useState<ContentStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  if (!open || !content) return null;

  const allowedTransitions = actor ? getAllowedTransitions(content.status, actor) : [];
  // Archive transition available at bottom
  const canArchive = allowedTransitions.includes('ARCHIVED') && content.status !== 'ARCHIVED';

  const handleTransition = async (status: ContentStatus) => {
    setTransitioning(status);
    setTransitionError(null);
    try {
      await onTransition(content.id, status);
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : 'Transition failed');
    } finally {
      setTransitioning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl border border-[rgb(var(--border))] bg-white dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 opacity-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))] shrink-0 bg-white dark:bg-[#18181b]">
          <div className="flex items-center gap-3 min-w-0">
            <ContentTypeBadge type={content.contentType} />
            <h2 id={`${uid}-title`} className="text-base font-semibold text-[rgb(var(--foreground))] truncate">
              {content.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {content.status !== 'ARCHIVED' && (
              <button
                onClick={() => onEdit(content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] text-sm hover:bg-[rgb(var(--border))] transition-colors"
                aria-label="Edit content"
              >
                <Edit3 size={13} /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-6 flex flex-col gap-6">
            {/* Content ID */}
            <div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">
                ID: <code className="font-mono">{content.id}</code>
              </span>
            </div>

            {/* Platform Targets & Completion */}
            <div className="p-4 rounded-2xl bg-[rgb(var(--card))] border border-[rgb(var(--border))]">
              <ContentPlatformToggles
                contentId={content.id}
                assets={content.assets || []}
                canEdit={content.status !== 'ARCHIVED'}
                onTargetsUpdated={onContentUpdated}
                onArchived={() => {
                  onContentArchived?.();
                  onClose();
                }}
              />
            </div>

            {/* Publishing note */}
            {(content.status === 'APPROVED' || content.status === 'SCHEDULED') && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
                <Send size={16} className="shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm">
                  Publishing destinations will be available once the publishing engine is integrated in a future phase.
                </p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-5 sm:gap-6 text-sm">
              <div>
                <span className="text-[rgb(var(--muted-foreground))] text-xs uppercase tracking-wide">Created by</span>
                <p className="mt-0.5 font-medium text-[rgb(var(--foreground))]">{content.creator?.name || content.createdBy}</p>
              </div>
              <div>
                <span className="text-[rgb(var(--muted-foreground))] text-xs uppercase tracking-wide">Content type</span>
                <p className="mt-0.5 font-medium text-[rgb(var(--foreground))]">{content.contentType}</p>
              </div>
              <div>
                <span className="text-[rgb(var(--muted-foreground))] text-xs uppercase tracking-wide">Created</span>
                <p className="mt-0.5 text-[rgb(var(--foreground))]">{formatDateTime(content.createdAt)}</p>
              </div>
              <div>
                <span className="text-[rgb(var(--muted-foreground))] text-xs uppercase tracking-wide">Last updated</span>
                <p className="mt-0.5 text-[rgb(var(--foreground))]">{formatDateTime(content.updatedAt)}</p>
              </div>
            </div>

            {/* Caption */}
            {content.caption && (
              <div>
                <h3 className="text-sm font-semibold text-[rgb(var(--foreground))] mb-2">Caption</h3>
                <div className="p-4 rounded-xl bg-[rgb(var(--muted))] text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-wrap">
                  {content.caption}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {content.hashtags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[rgb(var(--foreground))] mb-2">Hashtags ({content.hashtags.length})</h3>
                <div className="flex flex-wrap gap-1.5" role="list" aria-label="Hashtags">
                  {content.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-mono"
                      role="listitem"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Media Assets (Phase 8 GCS Media Manager) */}
            <div className="pt-2 border-t border-[rgb(var(--border))]">
              <MediaManager
                contentId={content.id}
                isArchived={content.status === 'ARCHIVED'}
                canManage={!!actor}
              />
            </div>

            {/* Publications */}
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--foreground))] mb-2">
                Publication Records <span className="text-[rgb(var(--muted-foreground))] font-normal">({content.publicationCount})</span>
              </h3>
              {content.publicationCount === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))]">
                  <Send size={16} aria-hidden />
                  <p className="text-sm">No publishing destinations. Publishing workflow coming in a future phase.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {content.publications.map((pub) => (
                    <div key={pub.id} className="flex items-center justify-between p-3 rounded-xl border border-[rgb(var(--border))] text-sm">
                      <code className="text-xs text-[rgb(var(--muted-foreground))]">{pub.id}</code>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        pub.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' :
                        pub.status === 'FAILED' ? 'bg-red-500/15 text-red-400' :
                        'bg-neutral-500/15 text-neutral-400'
                      }`}>
                        {pub.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Archive */}
            {canArchive && (
              <div className="pt-2 border-t border-[rgb(var(--border))]">
                {transitionError && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mb-2" role="alert">{transitionError}</p>
                )}
                <button
                  onClick={() => handleTransition('ARCHIVED')}
                  disabled={transitioning !== null}
                  className="text-sm text-[rgb(var(--muted-foreground))] hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Archive this content
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
