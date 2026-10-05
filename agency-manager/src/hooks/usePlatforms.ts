// src/hooks/usePlatforms.ts
// Client hook for managing social platform list, filtering, creation, updates, and seeding.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Platform,
  PlatformWithStats,
  PlatformQueryResult,
  PlatformSeedResult,
} from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';
import type { CreatePlatformInput, UpdatePlatformInput } from '@/lib/services/platform-service';

function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function usePlatforms() {
  const { user, getIdToken } = useAuth();
  const [platforms, setPlatforms] = useState<PlatformWithStats[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalAccounts: 0,
    bin: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [view, setView] = useState<'active' | 'bin'>('active');
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | 'all'>('all');
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'updatedAt' | 'isActive'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const activeRef = useRef(true);

  const fetchPlatforms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const params = new URLSearchParams();
      params.set('view', view);
      if (search.trim()) params.set('search', search.trim());
      if (isActiveFilter !== 'all') params.set('isActive', String(isActiveFilter));
      params.set('sort', sortField);
      params.set('order', sortOrder);
      params.set('page', String(page));
      params.set('limit', '50');

      const res = await fetch(`/api/platforms?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<PlatformQueryResult> = await res.json();
      if (!activeRef.current) return;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to retrieve social platforms'));
      }

      setPlatforms(json.data.platforms);
      setStats(json.data.stats);
      setTotalPages(json.data.totalPages);
    } catch (err: unknown) {
      if (activeRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred loading platforms');
      }
    } finally {
      if (activeRef.current) {
        setLoading(false);
      }
    }
  }, [user, getIdToken, view, search, isActiveFilter, sortField, sortOrder, page]);

  useEffect(() => {
    activeRef.current = true;
    const timer = setTimeout(() => {
      fetchPlatforms();
    }, 150); // slight debounce for search / filter changes

    return () => {
      activeRef.current = false;
      clearTimeout(timer);
    };
  }, [fetchPlatforms]);

  const createPlatform = async (payload: CreatePlatformInput): Promise<Platform> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/platforms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<Platform> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to create platform'));
      }

      await fetchPlatforms();
      return json.data;
    } finally {
      setIsMutating(false);
    }
  };

  const updatePlatform = async (id: string, payload: UpdatePlatformInput): Promise<Platform> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/platforms/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<Platform> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to update platform'));
      }

      await fetchPlatforms();
      return json.data;
    } finally {
      setIsMutating(false);
    }
  };

  const deactivatePlatform = async (id: string): Promise<Platform> => {
    return updatePlatform(id, { isActive: false });
  };

  const deletePlatform = async (
    id: string,
    forcePermanent = false
  ): Promise<{ movedToBin: boolean }> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/platforms/${id}?permanent=${Boolean(forcePermanent)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }> =
        await res.json();
      if (!res.ok || !json.success || !json.data) {
        const errorMsg = formatApiErrorMessage(json.error, 'Failed to delete platform');
        const err = new Error(errorMsg) as Error & { code?: string; accountCount?: number };
        if (json.error && typeof json.error === 'object') {
          err.code = json.error.code;
          if (
            json.error.details &&
            typeof json.error.details === 'object' &&
            'accountCount' in json.error.details
          ) {
            err.accountCount = (json.error.details as { accountCount: number }).accountCount;
          }
        }
        throw err;
      }

      await fetchPlatforms();
      return { movedToBin: json.data.movedToBin };
    } finally {
      setIsMutating(false);
    }
  };

  const restorePlatform = async (id: string): Promise<Platform> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/platforms/${id}/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<Platform> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to restore platform'));
      }

      await fetchPlatforms();
      return json.data;
    } finally {
      setIsMutating(false);
    }
  };

  const emptyBin = async (): Promise<{ deletedCount: number; blockedCount: number }> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/platforms/bin', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<{ deletedCount: number; blockedCount: number }> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to empty recycle bin'));
      }

      await fetchPlatforms();
      return json.data;
    } finally {
      setIsMutating(false);
    }
  };

  const seedPlatforms = async (): Promise<PlatformSeedResult> => {
    if (!user) throw new Error('Authentication required');
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/platforms/seed', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<PlatformSeedResult> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(formatApiErrorMessage(json.error, 'Failed to seed default platforms'));
      }

      await fetchPlatforms();
      return json.data;
    } finally {
      setIsMutating(false);
    }
  };

  return {
    platforms,
    stats,
    loading,
    isMutating,
    error,
    view,
    setView,
    search,
    setSearch,
    isActiveFilter,
    setIsActiveFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    totalPages,
    refresh: fetchPlatforms,
    createPlatform,
    updatePlatform,
    deactivatePlatform,
    deletePlatform,
    restorePlatform,
    emptyBin,
    seedPlatforms,
  };
}
