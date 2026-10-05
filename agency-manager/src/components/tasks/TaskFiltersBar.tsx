'use client';
// src/components/tasks/TaskFiltersBar.tsx
// Filter, Search, Sort, and View switcher bar for Task Management.

import { Search, RotateCcw, ArrowUpDown, User } from 'lucide-react';
import type { TaskPriority, TaskStatus, TeamMember } from '@/lib/types/domain';
import type { TaskFilterState } from '@/hooks/useTasks';

interface TaskFiltersBarProps {
  filters: TaskFilterState;
  onFilterChange: (updates: Partial<TaskFilterState>) => void;
  onReset: () => void;
  viewMode?: 'list' | 'board';
  onViewModeChange?: (mode: 'list' | 'board') => void;
  teamMembers: TeamMember[];
}

export function TaskFiltersBar({
  filters,
  onFilterChange,
  onReset,
  viewMode = 'list',
  onViewModeChange,
  teamMembers,
}: TaskFiltersBarProps) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'ALL' ||
    filters.priority !== 'ALL' ||
    filters.assignedTo !== 'ALL' ||
    filters.dueState !== 'ALL' ||
    filters.sort !== 'dueDate' ||
    filters.order !== 'asc';

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Row: Search, View Mode, Due State shortcuts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex items-center flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
          />
        </div>

        {/* Due State Quick Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs">
            <button
              onClick={() => onFilterChange({ dueState: 'ALL' })}
              className={`px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition min-h-[38px] ${
                filters.dueState === 'ALL'
                  ? 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-xs'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onFilterChange({ dueState: 'OVERDUE' })}
              className={`px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition min-h-[38px] ${
                filters.dueState === 'OVERDUE'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Overdue
            </button>
            <button
              onClick={() => onFilterChange({ dueState: 'DUE_SOON' })}
              className={`px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition min-h-[38px] ${
                filters.dueState === 'DUE_SOON'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-xs'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Due Soon
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Row: Status, Priority, Assignee, Sort Dropdowns */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
        {/* Status Dropdown (relevant mainly for list view) */}
        {viewMode === 'list' && (
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value as TaskStatus | 'ALL' })}
            className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        )}

        {/* Priority Dropdown */}
        <select
          value={filters.priority}
          onChange={(e) => onFilterChange({ priority: e.target.value as TaskPriority | 'ALL' })}
          className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
        >
          <option value="ALL">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Assignee Dropdown */}
        <select
          value={filters.assignedTo}
          onChange={(e) => onFilterChange({ assignedTo: e.target.value })}
          className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition max-w-[180px] truncate"
        >
          <option value="ALL">All Assignees</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Sort Field Dropdown */}
        <select
          value={filters.sort}
          onChange={(e) =>
            onFilterChange({
              sort: e.target.value as 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title',
            })
          }
          className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
        >
          <option value="dueDate">Sort by Due Date</option>
          <option value="priority">Sort by Priority</option>
          <option value="createdAt">Sort by Created Date</option>
          <option value="updatedAt">Sort by Updated Date</option>
          <option value="title">Sort by Title</option>
        </select>

        {/* Sort Order Toggle */}
        <button
          onClick={() => onFilterChange({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
          className="p-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition flex items-center gap-1"
          title={`Order: ${filters.order.toUpperCase()}`}
          aria-label="Toggle sort order"
        >
          <ArrowUpDown size={14} />
          <span className="text-[11px] font-mono uppercase">{filters.order}</span>
        </button>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="px-2.5 py-1.5 rounded-xl text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition flex items-center gap-1 text-[11px]"
            title="Reset filters"
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
