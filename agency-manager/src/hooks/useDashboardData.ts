'use client';
// src/hooks/useDashboardData.ts
// Hook to fetch and manage real aggregated dashboard overview data from /api/dashboard/overview.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { DashboardOverviewData } from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';

export interface UseDashboardDataReturn {
  data: DashboardOverviewData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useDashboardData(): UseDashboardDataReturn {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    async function fetchDashboard() {
      await Promise.resolve();
      if (!active) return;

      if (!user) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        const token = await getIdToken();
        if (!active || !token) {
          if (active) setLoading(false);
          return;
        }

        const res = await fetch('/api/dashboard/overview', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = (await res.json()) as ApiResponse<DashboardOverviewData>;

        if (!active) return;

        if (!res.ok || !json.success || !json.data) {
          const errorMsg =
            typeof json.error === 'string'
              ? json.error
              : json.error?.message || `HTTP ${res.status}: Failed to load dashboard data`;
          setError(errorMsg);
        } else {
          setData(json.data);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Error loading dashboard');
      } finally {
        if (active) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      active = false;
    };
  }, [user, authLoading, getIdToken, refreshTrigger]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    data,
    loading: authLoading || loading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  };
}
