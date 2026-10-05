'use client';
// src/hooks/useStorageHealth.ts
// Hook for triggering and tracking the GCS storage health check from the frontend.

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { StorageCheckResult } from '@/lib/types';

type CheckState = 'idle' | 'checking' | 'done' | 'error';

interface UseStorageHealthReturn {
  result: StorageCheckResult | null;
  state: CheckState;
  error: string | null;
  runCheck: () => Promise<void>;
}

export function useStorageHealth(): UseStorageHealthReturn {
  const { getIdToken } = useAuth();
  const [result, setResult] = useState<StorageCheckResult | null>(null);
  const [state, setState] = useState<CheckState>('idle');
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setState('checking');
    setError(null);
    setResult(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        setState('error');
        return;
      }

      const res = await fetch('/api/health/storage', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (json.data) {
        setResult(json.data as StorageCheckResult);
        setState('done');
      } else {
        setError(json.error ?? 'Unknown error');
        setState('error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      setState('error');
    }
  }, [getIdToken]);

  return { result, state, error, runCheck };
}
