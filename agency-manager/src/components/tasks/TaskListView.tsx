'use client';
// src/components/tasks/TaskListView.tsx
// Table/list view for tasks with quick actions, pagination, and empty/loading states.

import { useState } from 'react';
import {
  Calendar,
  User,
  FileText,
  Share2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  Eye,
  Trash2,
  Edit2,
  Inbox,
  PlayCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { TaskWithRelations } from '@/lib/services/task-service';
import type { TaskStatus } from '@/lib/types/domain';
import { TaskStatusBadge, TaskPriorityBadge, TaskOverdueBadge, TaskDueSoonBadge } from './TaskBadges';
import { usePermission } from '@/hooks/usePermission';

interface TaskListViewProps {
  tasks: TaskWithRelations[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onTaskSelect: (task: TaskWithRelations) => void;
  onEdit: (task: TaskWithRelations) => void;
  onStatusChange: (id: string, status: TaskStatus) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onCreateClick?: () => void;
}

export function TaskListView({
  tasks,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onTaskSelect,
  onEdit,
  onStatusChange,
  onDelete,
  onCreateClick,
}: TaskListViewProps) {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission('tasks.update');
  const canDelete = hasPermission('tasks.delete');
  const canCreate = hasPermission('tasks.create');

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const formatDueDate = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-4 sm:gap-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-[rgb(var(--bg-subtle))] animate-pulse border border-[rgb(var(--border))]"
          />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className="card text-center py-16 px-6 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl"
        style={{ padding: '3rem 1.5rem' }}
      >
        <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] flex items-center justify-center mx-auto mb-3">
          <Inbox size={24} />
        </div>
        <h3 className="text-base font-semibold text-[rgb(var(--text-primary))] mb-1">
          No tasks found
        </h3>
        <p className="text-xs text-[rgb(var(--text-secondary))] max-w-sm mx-auto mb-5">
          There are no tasks matching your selected filters. Create your first task to start organizing agency work.
        </p>
        {canCreate && onCreateClick && (
          <button
            onClick={onCreateClick}
            className="px-4 py-2 text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:opacity-90 transition shadow-xs"
          >
            Create Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Task List: Each task as an individual card with generous gap */}
      <div className="flex flex-col gap-4 sm:gap-5">
        {tasks.map((task) => {
          const dueDateFormatted = formatDueDate(task.dueDate);

          return (
            <div
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className="card rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xs hover:border-[rgb(var(--kira-purple))]/40 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              style={{ padding: '1.25rem 1.75rem' }}
            >
              {/* Left Column: ID, Title, Badges, preview */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] font-semibold text-[rgb(var(--text-muted))]">
                    {task.id}
                  </span>
                  <TaskPriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                  {task.isOverdue && <TaskOverdueBadge />}
                  {task.isDueSoon && <TaskDueSoonBadge />}
                </div>

                <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))] group-hover:text-[rgb(var(--kira-purple))] transition truncate">
                  {task.title}
                </h3>

                {task.description && (
                  <p className="text-xs text-[rgb(var(--text-secondary))] line-clamp-1">
                    {task.description}
                  </p>
                )}

                {/* Chips for linked Content & Account */}
                {(task.relatedContent || task.relatedAccount) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                    {task.relatedContent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]">
                        <FileText size={11} />
                        <span className="truncate max-w-[140px]">{task.relatedContent.title}</span>
                      </span>
                    )}
                    {task.relatedAccount && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]">
                        <Share2 size={11} />
                        <span>@{task.relatedAccount.username}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Assignee, Due Date, Actions */}
              <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[rgb(var(--border))]">
                {/* Assignee */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center text-[10px] font-bold text-[rgb(var(--text-primary))] overflow-hidden shrink-0">
                    {task.assignedToMember?.avatarUrl ? (
                      <img
                        src={task.assignedToMember.avatarUrl}
                        alt={task.assignedToMember.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      task.assignedToMember?.name.slice(0, 2).toUpperCase() || <User size={13} />
                    )}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-[rgb(var(--text-primary))] truncate max-w-[110px]">
                      {task.assignedToMember?.name || 'Unassigned'}
                    </div>
                  </div>
                </div>

                {/* Due Date */}
                <div className="text-right min-w-[70px]">
                  {dueDateFormatted ? (
                    <div className="text-xs font-medium text-[rgb(var(--text-secondary))] flex items-center gap-1 justify-end">
                      <Calendar size={12} className="text-[rgb(var(--text-muted))]" />
                      <span>{dueDateFormatted}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[rgb(var(--text-muted))]">No due date</span>
                  )}
                </div>

                {/* Context Action Menu */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === task.id ? null : task.id)}
                    className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] rounded-lg hover:bg-[rgb(var(--bg-subtle))] transition"
                    aria-label="Task options"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenuId === task.id && (
                    <div
                      className="absolute right-0 top-8 z-30 w-44 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
                      onMouseLeave={() => setActiveMenuId(null)}
                    >
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onTaskSelect(task);
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] flex items-center gap-2"
                      >
                        <Eye size={13} /> View Details
                      </button>

                      {canUpdate && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            onEdit(task);
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] flex items-center gap-2"
                        >
                          <Edit2 size={13} /> Edit Task
                        </button>
                      )}

                      {/* Quick Status Transitions */}
                      {canUpdate && task.status === 'TODO' && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            onStatusChange(task.id, 'IN_PROGRESS');
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-[rgb(var(--bg-subtle))] flex items-center gap-2"
                        >
                          <PlayCircle size={13} /> Start Progress
                        </button>
                      )}

                      {canUpdate && task.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            onStatusChange(task.id, 'REVIEW');
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-purple-600 dark:text-purple-400 hover:bg-[rgb(var(--bg-subtle))] flex items-center gap-2"
                        >
                          <Eye size={13} /> Submit for Review
                        </button>
                      )}

                      {canUpdate && task.status === 'REVIEW' && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            onStatusChange(task.id, 'COMPLETED');
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-[rgb(var(--bg-subtle))] flex items-center gap-2"
                        >
                          <CheckCircle2 size={13} /> Mark Completed
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            if (confirm(`Delete task "${task.title}"?`)) {
                              onDelete(task.id);
                            }
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-[rgb(var(--border))] mt-1"
                        >
                          <Trash2 size={13} /> Delete Task
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-[rgb(var(--text-secondary))]">
          <div>
            Showing <span className="font-semibold text-[rgb(var(--text-primary))]">{tasks.length}</span> of{' '}
            <span className="font-semibold text-[rgb(var(--text-primary))]">{total}</span> tasks
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] disabled:opacity-40 hover:bg-[rgb(var(--bg-subtle))] transition"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] disabled:opacity-40 hover:bg-[rgb(var(--bg-subtle))] transition"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
