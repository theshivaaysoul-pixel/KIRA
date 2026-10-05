'use client';
// src/components/tasks/TaskDetailModal.tsx
// Comprehensive Task Detail Modal with workflow action transitions and relations.

import { useState } from 'react';
import {
  X,
  Calendar,
  User,
  FileText,
  Share2,
  Clock,
  Edit2,
  Trash2,
  PlayCircle,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { TaskWithRelations } from '@/lib/services/task-service';
import type { TaskStatus } from '@/lib/types/domain';
import { TaskStatusBadge, TaskPriorityBadge, TaskOverdueBadge, TaskDueSoonBadge } from './TaskBadges';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { usePermission } from '@/hooks/usePermission';

interface TaskDetailModalProps {
  task: TaskWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: TaskWithRelations) => void;
  onStatusChange: (id: string, status: TaskStatus) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onStatusChange,
  onDelete,
}: TaskDetailModalProps) {
  const { hasPermission } = usePermission();
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const canUpdate = hasPermission('tasks.update');
  const canDelete = hasPermission('tasks.delete');

  const handleStatusTransition = async (targetStatus: TaskStatus) => {
    setActionError(null);
    setTransitioning(true);
    try {
      await onStatusChange(task.id, targetStatus);
      onClose();
    } catch (err) {
      console.error('[TaskDetailModal handleStatusTransition]', err);
      setActionError(err instanceof Error ? err.message : 'Status transition failed.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete task "${task.title}"?`)) {
      return;
    }

    setActionError(null);
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      console.error('[TaskDetailModal handleDelete]', err);
      setActionError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  // Format dates
  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Not set';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="task-detail-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[rgb(var(--border))]">
          <div className="space-y-1.5 pr-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))]">
                {task.id}
              </span>
              <TaskPriorityBadge priority={task.priority} />
              <TaskStatusBadge status={task.status} showIcon />
              {task.isOverdue && <TaskOverdueBadge />}
              {task.isDueSoon && <TaskDueSoonBadge />}
            </div>
            <h2 id="task-detail-title" className="text-lg font-bold text-[rgb(var(--text-primary))] leading-snug">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] rounded-lg hover:bg-[rgb(var(--bg-subtle))] transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2">
              Description
            </h3>
            <div
              className="card rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-sm text-[rgb(var(--text-primary))] leading-relaxed whitespace-pre-wrap"
              style={{ padding: '1.25rem' }}
            >
              {task.description || 'No description provided.'}
            </div>
          </div>

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignee Card */}
            <div
              className="card rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]"
              style={{ padding: '1.25rem' }}
            >
              <div className="text-xs font-semibold text-[rgb(var(--text-muted))] flex items-center gap-1.5 mb-2">
                <User size={13} /> Assigned Team Member
              </div>
              {task.assignedToMember ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] flex items-center justify-center text-sm font-bold text-[rgb(var(--text-primary))] overflow-hidden shrink-0">
                    {task.assignedToMember.avatarUrl ? (
                      <img src={task.assignedToMember.avatarUrl} alt={task.assignedToMember.name} className="w-full h-full object-cover" />
                    ) : (
                      task.assignedToMember.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                      {task.assignedToMember.name}
                    </div>
                    <div className="text-xs text-[rgb(var(--text-secondary))]">
                      {task.assignedToMember.role} · {task.assignedToMember.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[rgb(var(--text-muted))] italic">Unassigned</div>
              )}
            </div>

            {/* Due Date Card */}
            <div
              className="card rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]"
              style={{ padding: '1.25rem' }}
            >
              <div className="text-xs font-semibold text-[rgb(var(--text-muted))] flex items-center gap-1.5 mb-2">
                <Calendar size={13} /> Due Date
              </div>
              {task.dueDate ? (
                <div>
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))] flex items-center gap-2">
                    {formatTimestamp(task.dueDate)}
                  </div>
                  <div className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">
                    {task.isOverdue ? 'Passed due date' : task.isDueSoon ? 'Due in less than 24 hours' : 'Upcoming deadline'}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[rgb(var(--text-muted))] italic">No deadline set</div>
              )}
            </div>
          </div>

          {/* Relationships Grid */}
          {(task.relatedContent || task.relatedAccount) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {task.relatedContent && (
                <div
                  className="card rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]"
                  style={{ padding: '1.25rem' }}
                >
                  <div className="text-xs font-semibold text-[rgb(var(--text-muted))] flex items-center gap-1.5 mb-2">
                    <FileText size={13} /> Related Content
                  </div>
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {task.relatedContent.title}
                  </div>
                  <div className="text-xs text-[rgb(var(--text-secondary))] mt-1 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] font-mono text-[10px]">
                      {task.relatedContent.contentType}
                    </span>
                    <span>Status: {task.relatedContent.status}</span>
                  </div>
                </div>
              )}

              {task.relatedAccount && (
                <div
                  className="card rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]"
                  style={{ padding: '1.25rem' }}
                >
                  <div className="text-xs font-semibold text-[rgb(var(--text-muted))] flex items-center gap-1.5 mb-2">
                    <Share2 size={13} /> Related Social Account
                  </div>
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {task.relatedAccount.accountName}
                  </div>
                  <div className="text-xs text-[rgb(var(--text-secondary))] mt-1 flex items-center gap-1.5">
                    <span>@{task.relatedAccount.username}</span>
                    <span className="text-[rgb(var(--text-muted))]">·</span>
                    <PlatformIcon name={task.relatedAccount.platformName} size={12} className="shrink-0" />
                    <span>{task.relatedAccount.platformName}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workflow Status Actions */}
          {canUpdate && (
            <div className="p-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-3">
                Workflow Actions
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {task.status === 'TODO' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <PlayCircle size={14} /> Start Progress
                    </button>
                    <button
                      onClick={() => handleStatusTransition('CANCELLED')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={14} /> Cancel Task
                    </button>
                  </>
                )}

                {task.status === 'IN_PROGRESS' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('REVIEW')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Eye size={14} /> Submit for Review
                    </button>
                    <button
                      onClick={() => handleStatusTransition('TODO')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw size={14} /> Move back to Todo
                    </button>
                    <button
                      onClick={() => handleStatusTransition('CANCELLED')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  </>
                )}

                {task.status === 'REVIEW' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('COMPLETED')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> Mark Completed
                    </button>
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw size={14} /> Request Rework
                    </button>
                    <button
                      onClick={() => handleStatusTransition('CANCELLED')}
                      disabled={transitioning}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  </>
                )}

                {task.status === 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusTransition('IN_PROGRESS')}
                    disabled={transitioning}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Reopen Task
                  </button>
                )}

                {task.status === 'CANCELLED' && (
                  <button
                    onClick={() => handleStatusTransition('TODO')}
                    disabled={transitioning}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Restore to Todo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 text-[11px] text-[rgb(var(--text-muted))] flex items-center gap-4">
            <span>Created: {formatTimestamp(task.createdAt)}</span>
            <span>Updated: {formatTimestamp(task.updatedAt)}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))]">
          <div>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete Task
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {canUpdate && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
                className="px-4 py-2 text-xs font-semibold text-[rgb(var(--text-primary))] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))] rounded-xl transition flex items-center gap-1.5"
              >
                <Edit2 size={13} /> Edit Task
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
