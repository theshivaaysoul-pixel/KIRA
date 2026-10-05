'use client';
// src/components/tasks/TaskBadges.tsx
// Status pills, priority badges, and overdue/due-soon indicators for Task Management.

import type { TaskPriority, TaskStatus } from '@/lib/types/domain';
import { AlertCircle, Clock, CheckCircle2, PlayCircle, Eye, XCircle, ListTodo } from 'lucide-react';

// ─── Status Configuration ──────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  TODO: {
    label: 'To Do',
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    Icon: ListTodo,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-500/30',
    dot: 'bg-blue-500',
    Icon: PlayCircle,
  },
  REVIEW: {
    label: 'Review',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-500/30',
    dot: 'bg-purple-500',
    Icon: Eye,
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/15',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-300 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    Icon: XCircle,
  },
};

export function TaskStatusBadge({
  status,
  showIcon = false,
  className = '',
}: {
  status: TaskStatus;
  showIcon?: boolean;
  className?: string;
}) {
  const cfg = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.TODO;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
      aria-label={`Status: ${cfg.label}`}
    >
      {showIcon ? (
        <Icon size={12} className="shrink-0" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      )}
      {cfg.label}
    </span>
  );
}

// ─── Priority Configuration ───────────────────────────────────────────────────

interface PriorityConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, PriorityConfig> = {
  LOW: {
    label: 'Low',
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-800',
  },
  MEDIUM: {
    label: 'Medium',
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-500/30',
  },
  HIGH: {
    label: 'High',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-500/30',
  },
  URGENT: {
    label: 'Urgent',
    bg: 'bg-rose-500/15 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300 font-semibold',
    border: 'border-rose-300 dark:border-rose-500/40',
  },
};

export function TaskPriorityBadge({
  priority,
  className = '',
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const cfg = TASK_PRIORITY_CONFIG[priority] || TASK_PRIORITY_CONFIG.MEDIUM;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
      aria-label={`Priority: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Derived Overdue & Due Soon Badges ─────────────────────────────────────────

export function TaskOverdueBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 ${className}`}
      title="This task is overdue"
    >
      <AlertCircle size={11} className="shrink-0" />
      Overdue
    </span>
  );
}

export function TaskDueSoonBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ${className}`}
      title="This task is due within the next 24 hours"
    >
      <Clock size={11} className="shrink-0" />
      Due Soon
    </span>
  );
}
