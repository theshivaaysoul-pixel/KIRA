'use client';
// src/hooks/useMediaAssets.ts
// Client hook for managing Content Media Assets in Phase 8.

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentAsset } from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function useMediaAssets(contentId: string | null) {
  const { user, getIdToken } = useAuth();
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!contentId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/content/${contentId}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: ApiResponse<ContentAsset[]> = await res.json();
      if (!json.success) {
        throw new Error(extractErrorMessage(json.error, 'Failed to load assets'));
      }
      setAssets(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching assets');
    } finally {
      setLoading(false);
    }
  }, [contentId, user, getIdToken]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const uploadAsset = useCallback(
    async (file: File): Promise<ContentAsset> => {
      if (!contentId || !user) throw new Error('Not authenticated or no content selected');
      setUploading(true);
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Not authenticated');

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/content/${contentId}/assets`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const json: ApiResponse<ContentAsset> = await res.json();
        if (!json.success) {
          throw new Error(extractErrorMessage(json.error, 'Upload failed'));
        }

        await fetchAssets();
        return json.data!;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [contentId, user, getIdToken, fetchAssets]
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      if (!contentId || !user) throw new Error('Not authenticated');
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`/api/content/${contentId}/assets/${assetId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json: ApiResponse<never> = await res.json();
        if (!json.success) {
          throw new Error(extractErrorMessage(json.error, 'Failed to delete asset'));
        }

        await fetchAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete asset';
        setError(message);
        throw err;
      }
    },
    [contentId, user, getIdToken, fetchAssets]
  );

  return {
    assets,
    loading,
    uploading,
    error,
    refresh: fetchAssets,
    uploadAsset,
    deleteAsset,
  };
}
