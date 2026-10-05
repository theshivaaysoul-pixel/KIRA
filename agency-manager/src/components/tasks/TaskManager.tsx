'use client';
// src/components/tasks/TaskManager.tsx
// Master coordinator component for Task Management (Phase 10).
// Seamlessly brings together stats, search/filters, list/board views, and modals.

import { useState, useEffect } from 'react';
import {
  Plus,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { TaskFiltersBar } from './TaskFiltersBar';
import { TaskListView } from './TaskListView';
import { TaskBoardView } from './TaskBoardView';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import type { TaskWithRelations } from '@/lib/services/task-service';
import type { TaskStatus, TeamMember } from '@/lib/types/domain';

export function TaskManager() {
  const { getIdToken } = useAuth();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission('tasks.create');

  const {
    tasks,
    total,
    totalPages,
    metrics,
    filters,
    loading,
    error,
    updateFilters,
    resetFilters,
    refresh,
    changeStatus,
    deleteTask,
  } = useTasks();

  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithRelations | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

  // Fetch active team members for filters
  useEffect(() => {
    let isMounted = true;
    async function loadMembers() {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch('/api/team', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && isMounted) {
            setTeamMembers(json.data || []);
          }
        }
      } catch (err) {
        console.warn('[TaskManager] Failed to load team members:', err);
      }
    }
    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [getIdToken]);

  // Handlers
  const handleOpenCreate = (initialStatus?: TaskStatus) => {
    setTaskToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: TaskWithRelations) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  const handleTaskSuccess = () => {
    refresh();
    // Update selectedTask if detail modal is open
    if (selectedTask) {
      // It will refresh on next render or close
    }
  };

  const pendingCount = metrics.todo + metrics.inProgress + metrics.review;

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))] flex items-center gap-2.5">
            <CheckSquare className="text-[rgb(var(--primary))]" size={24} />
            Task Management
          </h1>
          <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">
            Organize operational workflows, assign team deliverables, and link tasks directly to agency content.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="w-11 h-11 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition disabled:opacity-50 flex items-center justify-center shrink-0"
            title="Refresh tasks"
            aria-label="Refresh tasks"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <button
              onClick={() => handleOpenCreate()}
              className="px-6 py-2.5 text-sm font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 rounded-full transition flex items-center gap-2 shadow-xs min-h-[44px]"
            >
              <Plus size={18} /> <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 lg:gap-8">
        {/* Pending Tasks */}
        <div
          className="card p-6 sm:p-7 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xs flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))]">
              Pending Tasks
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[rgb(var(--text-primary))]">
              {pendingCount}
            </div>
            <div className="text-xs text-[rgb(var(--text-muted))] mt-1.5 truncate">
              {metrics.todo} to do · {metrics.inProgress} in progress · {metrics.review} review
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div
          className="card p-6 sm:p-7 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xs flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))]">
              Overdue
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <AlertCircle size={16} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-bold font-mono ${metrics.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[rgb(var(--text-primary))]'}`}>
              {metrics.overdue}
            </div>
            <div className="text-xs text-[rgb(var(--text-muted))] mt-1.5 truncate">
              Missed target deadlines
            </div>
          </div>
        </div>

        {/* Due Soon */}
        <div
          className="card p-6 sm:p-7 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xs flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))]">
              Due Soon
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-bold font-mono ${metrics.dueSoon > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[rgb(var(--text-primary))]'}`}>
              {metrics.dueSoon}
            </div>
            <div className="text-xs text-[rgb(var(--text-muted))] mt-1.5 truncate">
              Due in next 24 hours
            </div>
          </div>
        </div>

        {/* Completed */}
        <div
          className="card p-6 sm:p-7 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xs flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))]">
              Completed
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[rgb(var(--text-primary))]">
              {metrics.completed}
            </div>
            <div className="text-xs text-[rgb(var(--text-muted))] mt-1.5 truncate">
              Resolved deliverables
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and View Switcher Bar */}
      <TaskFiltersBar
        filters={filters}
        onFilterChange={updateFilters}
        onReset={resetFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        teamMembers={teamMembers}
      />

      {/* Primary View */}
      {viewMode === 'list' ? (
        <TaskListView
          tasks={tasks}
          loading={loading}
          total={total}
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => updateFilters({ page: p })}
          onTaskSelect={(task) => setSelectedTask(task)}
          onEdit={handleOpenEdit}
          onStatusChange={changeStatus}
          onDelete={deleteTask}
          onCreateClick={() => handleOpenCreate()}
        />
      ) : (
        <TaskBoardView
          tasks={tasks}
          loading={loading}
          onTaskSelect={(task) => setSelectedTask(task)}
          onStatusChange={changeStatus}
          onCreateInColumn={(colStatus) => handleOpenCreate(colStatus)}
        />
      )}

      {/* Create / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        onSuccess={handleTaskSuccess}
      />

      {/* Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onEdit={(task) => {
          setSelectedTask(null);
          handleOpenEdit(task);
        }}
        onStatusChange={async (id, status) => {
          await changeStatus(id, status);
          refresh();
        }}
        onDelete={async (id) => {
          await deleteTask(id);
          refresh();
        }}
      />
    </div>
  );
}
