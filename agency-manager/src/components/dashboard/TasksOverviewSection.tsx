'use client';
// src/components/dashboard/TasksOverviewSection.tsx
// Displays pending agency tasks with real priority weights and overdue highlights.

import { CheckSquare, AlertCircle, Clock, User as UserIcon } from 'lucide-react';
import type { DashboardTaskItem, TaskPriority, TaskStatus } from '@/lib/types/domain';
import { EmptyState } from '@/components/ui/Loading';

interface TasksOverviewSectionProps {
  tasks: DashboardTaskItem[];
  timezone?: string;
}

export function TasksOverviewSection({
  tasks,
  timezone = 'UTC',
}: TasksOverviewSectionProps) {
  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'LOW':
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'REVIEW':
        return 'bg-purple-500/10 text-purple-600';
      case 'IN_PROGRESS':
        return 'bg-amber-500/10 text-amber-600';
      case 'TODO':
      default:
        return 'bg-neutral-500/10 text-neutral-600';
    }
  };

  const formatDueDate = (isoString?: string) => {
    if (!isoString) return 'No due date';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
            Pending Tasks
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Operational action items & review queue
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <CheckSquare size={16} />
        </div>
      </div>

      {!tasks || tasks.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No pending tasks"
          description="You're all caught up! No operational tasks currently require action."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] ${
                task.isOverdue ? 'border-red-500/30 bg-red-500/5' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[rgb(var(--text-primary))] truncate">
                    {task.title}
                  </h3>
                  {task.isOverdue && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded">
                      <AlertCircle size={10} /> Overdue
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[rgb(var(--text-secondary))]">
                  {task.assignedToName ? (
                    <span className="flex items-center gap-1 truncate">
                      <UserIcon size={11} className="text-[rgb(var(--text-muted))]" />
                      {task.assignedToName}
                    </span>
                  ) : (
                    <span className="text-[rgb(var(--text-muted))] italic">Unassigned</span>
                  )}

                  {task.relatedContentTitle && (
                    <>
                      <span>·</span>
                      <span className="truncate text-[rgb(var(--text-muted))]">
                        Ref: {task.relatedContentTitle}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityBadge(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusBadge(
                      task.status
                    )}`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {task.dueDate && (
                  <span className="text-[10px] text-[rgb(var(--text-muted))] font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {formatDueDate(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
