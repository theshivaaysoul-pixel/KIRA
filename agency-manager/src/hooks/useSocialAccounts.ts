// src/hooks/useSocialAccounts.ts
// Client hook for managing social accounts list, filtering, creation, updates, archiving, and deletion.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  SocialAccountWithRelations,
  SocialAccountQueryResult,
  SocialAccountStatus,
} from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';
import type { CreateSocialAccountInput, UpdateSocialAccountInput } from '@/lib/services/social-account-service';

function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

function getApiError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function useSocialAccounts() {
  const { user, getIdToken } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccountWithRelations[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    archived: 0,
    connectionError: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<SocialAccountStatus | 'ALL'>('ALL');
  const [managerFilter, setManagerFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'accountName' | 'username' | 'createdAt' | 'updatedAt' | 'status'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const activeRef = useRef(true);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (platformFilter !== 'ALL') params.set('platformId', platformFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (managerFilter !== 'ALL') params.set('assignedManagerId', managerFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/social-accounts?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<SocialAccountQueryResult> = await res.json();
      if (!activeRef.current) return;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          getApiError(json.error, `Failed to fetch accounts (status ${res.status})`)
        );
      }

      setAccounts(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);

      // Compute status counts across current batch or from query total
      let activeCount = 0;
      let inactiveCount = 0;
      let archivedCount = 0;
      let errorCount = 0;
      for (const item of json.data.items) {
        if (item.status === 'ACTIVE') activeCount++;
        else if (item.status === 'INACTIVE') inactiveCount++;
        else if (item.status === 'ARCHIVED') archivedCount++;
        else if (item.status === 'CONNECTION_ERROR') errorCount++;
      }
      setStats({
        total: json.data.total,
        active: activeCount,
        inactive: inactiveCount,
        archived: archivedCount,
        connectionError: errorCount,
      });
    } catch (err) {
      if (!activeRef.current) return;
      const msg = formatApiErrorMessage(err, 'Failed to load social accounts.');
      setError(msg);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [user, getIdToken, search, platformFilter, statusFilter, managerFilter, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    activeRef.current = true;
    const timer = setTimeout(() => {
      fetchAccounts();
    }, 150);

    return () => {
      activeRef.current = false;
      clearTimeout(timer);
    };
  }, [fetchAccounts]);

  const createAccount = async (
    input: CreateSocialAccountInput
  ): Promise<{ success: boolean; data?: SocialAccountWithRelations; error?: string }> => {
    if (!user) return { success: false, error: 'User not authenticated' };
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      const json: ApiResponse<SocialAccountWithRelations> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(getApiError(json.error, 'Failed to create social account'));
      }

      await fetchAccounts();
      return { success: true, data: json.data };
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to create social account.');
      return { success: false, error: msg };
    } finally {
      setIsMutating(false);
    }
  };

  const updateAccount = async (
    id: string,
    input: UpdateSocialAccountInput
  ): Promise<{ success: boolean; data?: SocialAccountWithRelations; error?: string }> => {
    if (!user) return { success: false, error: 'User not authenticated' };
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/social-accounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      const json: ApiResponse<SocialAccountWithRelations> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(getApiError(json.error, 'Failed to update social account'));
      }

      await fetchAccounts();
      return { success: true, data: json.data };
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to update social account.');
      return { success: false, error: msg };
    } finally {
      setIsMutating(false);
    }
  };

  const archiveAccount = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    return updateAccount(id, { status: 'ARCHIVED' });
  };

  const restoreAccount = async (
    id: string,
    targetStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'
  ): Promise<{ success: boolean; error?: string }> => {
    return updateAccount(id, { status: targetStatus });
  };

  const deleteAccount = async (
    id: string,
    forcePermanent = false
  ): Promise<{
    success: boolean;
    archived?: boolean;
    deleted?: boolean;
    error?: string;
    message?: string;
  }> => {
    if (!user) return { success: false, error: 'User not authenticated' };
    setIsMutating(true);
    try {
      const token = await getIdToken();
      const url = `/api/social-accounts/${id}${forcePermanent ? '?forcePermanent=true' : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to delete/archive social account');
      }

      await fetchAccounts();
      return {
        success: true,
        archived: json.data?.archived,
        deleted: json.data?.deleted,
        message: json.message || json.data?.message,
      };
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to delete social account.');
      return { success: false, error: msg };
    } finally {
      setIsMutating(false);
    }
  };

  return {
    accounts,
    stats,
    loading,
    isMutating,
    error,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    search,
    setSearch,
    platformFilter,
    setPlatformFilter,
    statusFilter,
    setStatusFilter,
    managerFilter,
    setManagerFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    fetchAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    restoreAccount,
    deleteAccount,
  };
}
