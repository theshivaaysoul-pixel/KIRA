'use client';
// src/hooks/useTasks.ts
// Client-side state management for Tasks module (Phase 10).

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskPriority, TaskStatus } from '@/lib/types/domain';
import type { TaskWithRelations, TaskQueryResult } from '@/lib/services/task-service';

export interface TaskFilterState {
  search: string;
  status: TaskStatus | 'ALL';
  priority: TaskPriority | 'ALL';
  assignedTo: string | 'ALL';
  relatedContentId?: string;
  relatedAccountId?: string;
  dueState: 'ALL' | 'OVERDUE' | 'DUE_SOON';
  sort: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

const DEFAULT_FILTERS: TaskFilterState = {
  search: '',
  status: 'ALL',
  priority: 'ALL',
  assignedTo: 'ALL',
  dueState: 'ALL',
  sort: 'dueDate',
  order: 'asc',
  page: 1,
  limit: 20,
};

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success) {
    const msg = typeof json.error === 'object' && json.error?.message ? json.error.message : (json.error || 'Request failed');
    throw new Error(msg);
  }
  return json.data as T;
}

export function useTasks() {
  const { user, getIdToken } = useAuth();

  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_FILTERS);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState({
    total: 0,
    todo: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    dueSoon: 0,
  });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(
    async (currentFilters: TaskFilterState) => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        if (!token) return;

        const sp = new URLSearchParams();
        if (currentFilters.search.trim()) sp.set('search', currentFilters.search.trim());
        if (currentFilters.status !== 'ALL') sp.set('status', currentFilters.status);
        if (currentFilters.priority !== 'ALL') sp.set('priority', currentFilters.priority);
        if (currentFilters.assignedTo !== 'ALL') sp.set('assignedTo', currentFilters.assignedTo);
        if (currentFilters.relatedContentId) sp.set('relatedContentId', currentFilters.relatedContentId);
        if (currentFilters.relatedAccountId) sp.set('relatedAccountId', currentFilters.relatedAccountId);
        if (currentFilters.dueState === 'OVERDUE') sp.set('overdue', 'true');
        if (currentFilters.dueState === 'DUE_SOON') sp.set('dueSoon', 'true');
        sp.set('sort', currentFilters.sort);
        sp.set('order', currentFilters.order);
        sp.set('page', String(currentFilters.page));
        sp.set('limit', String(currentFilters.limit));

        const result = await apiFetch<TaskQueryResult>(`/api/tasks?${sp.toString()}`, token);
        setTasks(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setMetrics(result.metrics);
      } catch (err) {
        console.error('[useTasks fetchTasks]', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch tasks.');
      } finally {
        setLoading(false);
      }
    },
    [user, getIdToken]
  );

  useEffect(() => {
    fetchTasks(filters);
  }, [fetchTasks, filters]);

  const updateFilters = useCallback((updates: Partial<TaskFilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
      // Reset page to 1 on filter criteria change unless page was explicitly updated
      page: updates.page !== undefined ? updates.page : 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const createTask = useCallback(
    async (payload: {
      title: string;
      description?: string;
      assignedTo?: string;
      relatedContentId?: string;
      relatedAccountId?: string;
      priority: TaskPriority;
      status?: TaskStatus;
      dueDate?: string;
    }): Promise<TaskWithRelations> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      setActionLoading(true);
      try {
        const created = await apiFetch<TaskWithRelations>('/api/tasks', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await fetchTasks(filters);
        return created;
      } finally {
        setActionLoading(false);
      }
    },
    [getIdToken, fetchTasks, filters]
  );

  const updateTask = useCallback(
    async (
      id: string,
      payload: Partial<{
        title: string;
        description?: string;
        assignedTo?: string;
        relatedContentId?: string;
        relatedAccountId?: string;
        priority: TaskPriority;
        status: TaskStatus;
        dueDate?: string;
      }>
    ): Promise<TaskWithRelations> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      setActionLoading(true);
      try {
        const updated = await apiFetch<TaskWithRelations>(`/api/tasks/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await fetchTasks(filters);
        return updated;
      } finally {
        setActionLoading(false);
      }
    },
    [getIdToken, fetchTasks, filters]
  );

  const changeStatus = useCallback(
    async (id: string, status: TaskStatus): Promise<TaskWithRelations> => {
      return updateTask(id, { status });
    },
    [updateTask]
  );

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      setActionLoading(true);
      try {
        await apiFetch<{ deleted: boolean }>(`/api/tasks/${id}`, token, {
          method: 'DELETE',
        });
        await fetchTasks(filters);
        return true;
      } finally {
        setActionLoading(false);
      }
    },
    [getIdToken, fetchTasks, filters]
  );

  return {
    tasks,
    total,
    totalPages,
    metrics,
    filters,
    loading,
    actionLoading,
    error,
    updateFilters,
    resetFilters,
    refresh: () => fetchTasks(filters),
    createTask,
    updateTask,
    changeStatus,
    deleteTask,
  };
}
