// src/hooks/usePlatformAudit.ts
// Phase 20 — Client hook for running and displaying the Dynamic Platform Audit

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { PlatformAuditReport } from '@/lib/services/platform-audit-service';
import type { ApiResponse } from '@/lib/types';

export function usePlatformAudit() {
  const { user, getIdToken } = useAuth();
  const [report, setReport] = useState<PlatformAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/platform-audit', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<PlatformAuditReport> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        const msg =
          typeof json.error === 'string'
            ? json.error
            : json.error?.message || `Failed to fetch platform audit (${res.status})`;
        throw new Error(msg);
      }

      setReport(json.data);
    } catch (err) {
      console.error('[usePlatformAudit] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load platform audit');
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  const runAudit = async (): Promise<PlatformAuditReport> => {
    setIsRunning(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/platform-audit/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<PlatformAuditReport> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        const msg =
          typeof json.error === 'string'
            ? json.error
            : json.error?.message || `Failed to run platform audit (${res.status})`;
        throw new Error(msg);
      }

      setReport(json.data);
      return json.data;
    } catch (err) {
      console.error('[usePlatformAudit.runAudit] Error:', err);
      const msg = err instanceof Error ? err.message : 'Audit execution failed';
      setError(msg);
      throw err;
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return {
    report,
    loading,
    isRunning,
    error,
    runAudit,
    refresh: fetchAudit,
  };
}
