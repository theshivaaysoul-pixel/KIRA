'use client';
// src/components/tasks/TaskBoardView.tsx
// Kanban Board View for tasks with 5 workflow columns and real status transitions.

import { useState } from 'react';
import {
  Calendar,
  User,
  FileText,
  Share2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
} from 'lucide-react';
import type { TaskWithRelations } from '@/lib/services/task-service';
import type { TaskStatus } from '@/lib/types/domain';
import {
  TaskPriorityBadge,
  TaskOverdueBadge,
  TaskDueSoonBadge,
  TASK_STATUS_CONFIG,
} from './TaskBadges';
import { usePermission } from '@/hooks/usePermission';

interface TaskBoardViewProps {
  tasks: TaskWithRelations[];
  loading: boolean;
  onTaskSelect: (task: TaskWithRelations) => void;
  onStatusChange: (id: string, status: TaskStatus) => Promise<unknown>;
  onCreateInColumn?: (status: TaskStatus) => void;
}

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'TODO', title: 'To Do' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
  { status: 'REVIEW', title: 'Review' },
  { status: 'COMPLETED', title: 'Completed' },
  { status: 'CANCELLED', title: 'Cancelled' },
];

export function TaskBoardView({
  tasks,
  loading,
  onTaskSelect,
  onStatusChange,
  onCreateInColumn,
}: TaskBoardViewProps) {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission('tasks.update');
  const canCreate = hasPermission('tasks.create');

  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const handleAdvance = async (e: React.MouseEvent, task: TaskWithRelations, nextStatus: TaskStatus) => {
    e.stopPropagation();
    setTransitioningId(task.id);
    try {
      await onStatusChange(task.id, nextStatus);
    } catch (err) {
      console.error('[TaskBoardView handleAdvance]', err);
    } finally {
      setTransitioningId(null);
    }
  };

  const formatDueDate = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex gap-6 lg:gap-8 overflow-x-auto pb-6 pt-1 select-none min-h-[550px] snap-x">
      {COLUMNS.map(({ status, title }) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        const config = TASK_STATUS_CONFIG[status];
        const Icon = config.Icon;

        return (
          <div
            key={status}
            className="flex-1 min-w-[280px] max-w-[350px] bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] rounded-2xl p-4 flex flex-col snap-start shrink-0"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 py-1.5 mb-3">
              <div className="flex items-center gap-2">
                <Icon size={14} className={config.text} />
                <span className="text-xs font-bold text-[rgb(var(--text-primary))]">
                  {title}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))]">
                  {columnTasks.length}
                </span>
              </div>

              {canCreate && onCreateInColumn && (status === 'TODO' || status === 'IN_PROGRESS') && (
                <button
                  onClick={() => onCreateInColumn(status)}
                  className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] rounded-md hover:bg-[rgb(var(--bg-surface))] transition"
                  title={`Add task to ${title}`}
                  aria-label={`Add task to ${title}`}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {/* Column Task Cards */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 sm:gap-5 pr-0.5 max-h-[calc(100vh-320px)]">
              {columnTasks.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[rgb(var(--border))] rounded-xl text-xs text-[rgb(var(--text-muted))]">
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => {
                  const dueDateStr = formatDueDate(task.dueDate);
                  const isBusy = transitioningId === task.id;

                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskSelect(task)}
                      className={`card bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col gap-3 relative group ${
                        isBusy ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-[rgb(var(--text-muted))] font-semibold">
                            {task.id}
                          </span>
                          <TaskPriorityBadge priority={task.priority} />
                        </div>
                        {task.isOverdue && <TaskOverdueBadge />}
                        {!task.isOverdue && task.isDueSoon && <TaskDueSoonBadge />}
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-[rgb(var(--text-primary))] group-hover:text-[rgb(var(--kira-purple))] transition leading-snug line-clamp-2">
                        {task.title}
                      </h4>

                      {/* Description preview */}
                      {task.description && (
                        <p className="text-[11px] text-[rgb(var(--text-secondary))] line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Chips */}
                      {(task.relatedContent || task.relatedAccount) && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                          {task.relatedContent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] truncate max-w-[150px]">
                              <FileText size={10} />
                              <span className="truncate">{task.relatedContent.title}</span>
                            </span>
                          )}
                          {task.relatedAccount && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))]">
                              <Share2 size={10} />
                              <span>@{task.relatedAccount.username}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bottom Footer: Assignee & Due Date & Advance Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-[rgb(var(--border))] text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center text-[9px] font-bold text-[rgb(var(--text-primary))] overflow-hidden shrink-0">
                            {task.assignedToMember?.avatarUrl ? (
                              <img
                                src={task.assignedToMember.avatarUrl}
                                alt={task.assignedToMember.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              task.assignedToMember?.name.slice(0, 2).toUpperCase() || <User size={10} />
                            )}
                          </div>
                          <span className="text-[rgb(var(--text-secondary))] truncate max-w-[85px]">
                            {task.assignedToMember?.name || 'Unassigned'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {dueDateStr && (
                            <span className="text-[rgb(var(--text-muted))] flex items-center gap-1">
                              <Calendar size={11} /> {dueDateStr}
                            </span>
                          )}

                          {/* Quick Workflow Action Shortcuts */}
                          {canUpdate && (
                            <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                              {status === 'TODO' && (
                                <button
                                  onClick={(e) => handleAdvance(e, task, 'IN_PROGRESS')}
                                  title="Start Progress"
                                  className="p-1 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                                </button>
                              )}
                              {status === 'IN_PROGRESS' && (
                                <>
                                  <button
                                    onClick={(e) => handleAdvance(e, task, 'TODO')}
                                    title="Move back to Todo"
                                    className="p-1 rounded-md bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--border))] transition"
                                  >
                                    <ChevronLeft size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => handleAdvance(e, task, 'REVIEW')}
                                    title="Submit for Review"
                                    className="p-1 rounded-md bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition"
                                  >
                                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                                  </button>
                                </>
                              )}
                              {status === 'REVIEW' && (
                                <button
                                  onClick={(e) => handleAdvance(e, task, 'COMPLETED')}
                                  title="Mark Completed"
                                  className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
