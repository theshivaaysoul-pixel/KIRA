'use client';
// src/components/content/ContentBadges.tsx
// Status pills, content type badges, and workflow step labels for Content Management.

import type { ContentStatus, ContentType } from '@/lib/types/domain';

// ─── Status Config ────────────────────────────────────────────────────────────
interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

export const STATUS_CONFIG: Record<ContentStatus, StatusConfig> = {
  IDEA:       { label: 'Idea',       bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-400' },
  SCRIPT:     { label: 'Script',     bg: 'bg-blue-500/15',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  PRODUCTION: { label: 'Production', bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   dot: 'bg-cyan-400' },
  EDITING:    { label: 'Editing',    bg: 'bg-amber-500/15',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  REVIEW:     { label: 'Review',     bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400' },
  APPROVED:   { label: 'Approved',   bg: 'bg-green-500/15',  text: 'text-green-400',  dot: 'bg-green-400' },
  SCHEDULED:  { label: 'Scheduled',  bg: 'bg-teal-500/15',   text: 'text-teal-400',   dot: 'bg-teal-400' },
  PUBLISHED:  { label: 'Published',  bg: 'bg-emerald-500/15',text: 'text-emerald-400',dot: 'bg-emerald-400' },
  FAILED:     { label: 'Failed',     bg: 'bg-red-500/15',    text: 'text-red-400',    dot: 'bg-red-400' },
  ARCHIVED:   { label: 'Archived',   bg: 'bg-neutral-500/15',text: 'text-neutral-400',dot: 'bg-neutral-400' },
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.IDEA;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
      aria-label={`Status: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

// ─── Content Type Config ──────────────────────────────────────────────────────
interface TypeConfig { label: string; icon: string; color: string }

export const TYPE_CONFIG: Record<ContentType, TypeConfig> = {
  POST:     { label: 'Post',     icon: '📝', color: 'text-blue-400' },
  REEL:     { label: 'Reel',     icon: '🎬', color: 'text-pink-400' },
  SHORT:    { label: 'Short',    icon: '⚡', color: 'text-yellow-400' },
  VIDEO:    { label: 'Video',    icon: '🎥', color: 'text-red-400' },
  IMAGE:    { label: 'Image',    icon: '🖼️', color: 'text-green-400' },
  CAROUSEL: { label: 'Carousel', icon: '🎠', color: 'text-purple-400' },
  STORY:    { label: 'Story',    icon: '📖', color: 'text-orange-400' },
  TEXT:     { label: 'Text',     icon: '💬', color: 'text-cyan-400' },
  LIVE:     { label: 'Live',     icon: '🔴', color: 'text-red-500' },
  OTHER:    { label: 'Other',    icon: '📦', color: 'text-neutral-400' },
};

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.OTHER;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}
      aria-label={`Type: ${cfg.label}`}
    >
      <span aria-hidden>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── Workflow Step Label ──────────────────────────────────────────────────────
const WORKFLOW_STEPS: ContentStatus[] = [
  'IDEA', 'SCRIPT', 'PRODUCTION', 'EDITING', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED',
];

export function WorkflowProgress({ status }: { status: ContentStatus }) {
  if (status === 'ARCHIVED' || status === 'FAILED') {
    return (
      <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
        <span>{status === 'ARCHIVED' ? '🗄️ Archived' : '❌ Failed'}</span>
      </div>
    );
  }

  const currentIdx = WORKFLOW_STEPS.indexOf(status);
  const pct = currentIdx >= 0 ? Math.round(((currentIdx + 1) / WORKFLOW_STEPS.length) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-[rgb(var(--muted-foreground))]">
        <span>Workflow</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-[rgb(var(--border))] rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Workflow progress: ${pct}%`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
