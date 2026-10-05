'use client';
// src/hooks/useAnalytics.ts
// Client-side analytics state hook for Phase 11.
// Fetches real snapshot data from the API — never generates fake numbers.

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AnalyticsListResult, AccountAnalyticsSummary, SnapshotWithRelations } from '@/lib/services/analytics-service';

interface AnalyticsFilters {
  socialAccountId?: string;
  platformId?: string;
  contentId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface UseAnalyticsReturn {
  snapshots: AnalyticsListResult | null;
  accountSummaries: AccountAnalyticsSummary[];
  loading: boolean;
  error: string | null;
  fetchSnapshots: (filters?: AnalyticsFilters) => Promise<void>;
  fetchAccountSummary: (accountId: string, from?: string, to?: string) => Promise<AccountAnalyticsSummary | null>;
  recordSnapshot: (data: Record<string, unknown>) => Promise<SnapshotWithRelations | null>;
  deleteSnapshot: (id: string) => Promise<boolean>;
  refreshAll: () => void;
}

export function useAnalytics(): UseAnalyticsReturn {
  const { getIdToken } = useAuth();
  const [snapshots, setSnapshots] = useState<AnalyticsListResult | null>(null);
  const [accountSummaries, setAccountSummaries] = useState<AccountAnalyticsSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getIdToken]);

  const fetchSnapshots = useCallback(
    async (filters: AnalyticsFilters = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.socialAccountId) params.set('socialAccountId', filters.socialAccountId);
        if (filters.platformId) params.set('platformId', filters.platformId);
        if (filters.contentId) params.set('contentId', filters.contentId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.page) params.set('page', String(filters.page));
        if (filters.limit) params.set('limit', String(filters.limit));

        const headers = await authHeaders();
        const res = await fetch(`/api/analytics?${params.toString()}`, { headers });
        const json = await res.json();

        if (json.success) {
          setSnapshots(json.data);
        } else {
          setError(json.error?.message || 'Failed to load analytics.');
        }
      } catch (e) {
        setError('Network error loading analytics.');
      } finally {
        setLoading(false);
      }
    },
    [authHeaders]
  );

  const fetchAccountSummary = useCallback(
    async (accountId: string, from?: string, to?: string): Promise<AccountAnalyticsSummary | null> => {
      try {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const headers = await authHeaders();
        const res = await fetch(`/api/analytics/accounts/${accountId}?${params.toString()}`, { headers });
        const json = await res.json();
        if (json.success) return json.data as AccountAnalyticsSummary;
        return null;
      } catch {
        return null;
      }
    },
    [authHeaders]
  );

  const recordSnapshot = useCallback(
    async (data: Record<string, unknown>): Promise<SnapshotWithRelations | null> => {
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/analytics', {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
          await fetchSnapshots();
          return json.data as SnapshotWithRelations;
        }
        setError(json.error?.message || 'Failed to record snapshot.');
        return null;
      } catch {
        setError('Network error recording snapshot.');
        return null;
      }
    },
    [authHeaders, fetchSnapshots]
  );

  const deleteSnapshot = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/analytics/${id}`, { method: 'DELETE', headers });
        const json = await res.json();
        if (json.success) {
          await fetchSnapshots();
          return true;
        }
        setError(json.error?.message || 'Failed to delete snapshot.');
        return false;
      } catch {
        setError('Network error deleting snapshot.');
        return false;
      }
    },
    [authHeaders, fetchSnapshots]
  );

  const refreshAll = useCallback(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  return {
    snapshots,
    accountSummaries,
    loading,
    error,
    fetchSnapshots,
    fetchAccountSummary,
    recordSnapshot,
    deleteSnapshot,
    refreshAll,
  };
}
