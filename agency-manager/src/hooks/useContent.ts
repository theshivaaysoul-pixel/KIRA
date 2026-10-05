'use client';
// src/hooks/useContent.ts
// Client-side state management for Content Management (Phase 7).

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ContentWithRelations,
  ContentQueryResult,
  ContentType,
  ContentStatus,
} from '@/lib/types/domain';

export interface ContentFilters {
  search: string;
  contentType: ContentType | 'ALL';
  status: ContentStatus | 'ALL';
  platformId: string;
  createdBy: string;
  sortBy: 'title' | 'createdAt' | 'updatedAt' | 'status' | 'contentType';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
  view: 'active' | 'archived' | 'bin';
}

const DEFAULT_FILTERS: ContentFilters = {
  search: '',
  contentType: 'ALL',
  status: 'ALL',
  platformId: 'ALL',
  createdBy: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
  view: 'active',
};

async function apiFetch<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Request failed');
  return json.data as T;
}

export function useContent() {
  const { user, getIdToken } = useAuth();
  const [result, setResult] = useState<ContentQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ContentFilters>(DEFAULT_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContent = useCallback(
    async (f: ContentFilters) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) return;
        const sp = new URLSearchParams();
        if (f.search) sp.set('search', f.search);
        if (f.contentType !== 'ALL') sp.set('contentType', f.contentType);
        if (f.status !== 'ALL') sp.set('status', f.status);
        if (f.platformId && f.platformId !== 'ALL') sp.set('platformId', f.platformId);
        if (f.createdBy) sp.set('createdBy', f.createdBy);
        if (f.view) sp.set('view', f.view);
        sp.set('sortBy', f.sortBy);
        sp.set('sortOrder', f.sortOrder);
        sp.set('page', String(f.page));
        sp.set('pageSize', String(f.pageSize));
        const data = await apiFetch<ContentQueryResult>(
          `/api/content?${sp}`,
          token
        );
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    },
    [user, getIdToken]
  );

  // Debounce search, immediate for other filters
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchContent(filters), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchContent]);

  const updateFilter = useCallback(
    <K extends keyof ContentFilters>(key: K, value: ContentFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        page: key !== 'page' ? 1 : (value as number),
      }));
    },
    []
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const refresh = useCallback(() => fetchContent(filters), [fetchContent, filters]);

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const createContent = useCallback(
    async (data: {
      title: string;
      description?: string;
      contentType: ContentType;
      caption?: string;
      hashtags?: string[];
      targetPlatformIds?: string[];
    }): Promise<ContentWithRelations> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const content = await apiFetch<ContentWithRelations>('/api/content', token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await refresh();
      return content;
    },
    [user, getIdToken, refresh]
  );

  const updateContent = useCallback(
    async (
      id: string,
      data: {
        title?: string;
        description?: string;
        contentType?: ContentType;
        caption?: string;
        hashtags?: string[];
        targetPlatformIds?: string[];
      }
    ): Promise<ContentWithRelations> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const content = await apiFetch<ContentWithRelations>(`/api/content/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      await refresh();
      return content;
    },
    [user, getIdToken, refresh]
  );

  const transitionStatus = useCallback(
    async (id: string, status: ContentStatus): Promise<ContentWithRelations> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const content = await apiFetch<ContentWithRelations>(
        `/api/content/${id}/status`,
        token,
        { method: 'PATCH', body: JSON.stringify({ status }) }
      );
      await refresh();
      return content;
    },
    [user, getIdToken, refresh]
  );

  const deleteContent = useCallback(
    async (id: string, forcePermanent = false): Promise<{ archived: boolean; deleted: boolean; movedToBin?: boolean }> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const result = await apiFetch<{ archived: boolean; deleted: boolean; movedToBin?: boolean }>(
        `/api/content/${id}${forcePermanent ? '?forcePermanent=true' : ''}`,
        token,
        { method: 'DELETE' }
      );
      await refresh();
      return result;
    },
    [user, getIdToken, refresh]
  );

  const restoreContent = useCallback(
    async (id: string, targetStatus?: ContentStatus): Promise<ContentWithRelations> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const content = await apiFetch<ContentWithRelations>(
        `/api/content/${id}/restore`,
        token,
        {
          method: 'POST',
          body: JSON.stringify(targetStatus ? { targetStatus } : {}),
        }
      );
      await refresh();
      return content;
    },
    [user, getIdToken, refresh]
  );

  const emptyBin = useCallback(async (): Promise<{ deletedCount: number }> => {
    if (!user) throw new Error('Not authenticated');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    const result = await apiFetch<{ deletedCount: number }>(
      '/api/content/bin',
      token,
      { method: 'DELETE' }
    );
    await refresh();
    return result;
  }, [user, getIdToken, refresh]);

  const getContentById = useCallback(
    async (id: string): Promise<ContentWithRelations> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<ContentWithRelations>(`/api/content/${id}`, token);
    },
    [user, getIdToken]
  );

  return {
    result,
    loading,
    error,
    filters,
    counts: result?.counts || { active: 0, archived: 0, bin: 0 },
    updateFilter,
    resetFilters,
    refresh,
    createContent,
    updateContent,
    transitionStatus,
    deleteContent,
    restoreContent,
    emptyBin,
    getContentById,
  };
}
