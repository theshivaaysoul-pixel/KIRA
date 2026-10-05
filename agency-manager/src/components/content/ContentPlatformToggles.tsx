'use client';
// src/components/content/ContentPlatformToggles.tsx
// Platform Content Target Toggles for KIRA Agency Manager (Phase 19).
//
// Displays real platform targets for a content item with:
// - Targeted ON/OFF toggle
// - Verified Completion indicator (✓ Completed)
// - Platform icon and dynamic platform list from PlatformRepository
// - Verified download action with platform context

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Loader2, Download, AlertCircle, Sparkles } from 'lucide-react';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentPlatformTargetWithPlatform, ContentAsset } from '@/lib/types/domain';

interface ContentPlatformTogglesProps {
  contentId: string;
  assets?: ContentAsset[];
  canEdit?: boolean;
  onTargetsUpdated?: () => void;
  onArchived?: () => void;
}

export function ContentPlatformToggles({
  contentId,
  assets = [],
  canEdit = true,
  onTargetsUpdated,
  onArchived,
}: ContentPlatformTogglesProps) {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [targets, setTargets] = useState<ContentPlatformTargetWithPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingCompletionId, setUpdatingCompletionId] = useState<string | null>(null);
  const [isTogglingAll, setIsTogglingAll] = useState(false);
  const [downloadingPlatformId, setDownloadingPlatformId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTargets = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/content/${contentId}/platform-targets`, { headers });
      const json = await res.json();
      if (json.success) {
        setTargets(json.data || []);
      } else {
        setError(json.error?.message || 'Failed to load platform targets.');
      }
    } catch {
      setError('Network error loading platform targets.');
    } finally {
      setLoading(false);
    }
  }, [contentId, authLoading, user, getIdToken]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTargets();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [fetchTargets, authLoading, user]);

  const handleToggle = async (platformId: string, currentEnabled: boolean) => {
    if (!canEdit || updatingId) return;
    setUpdatingId(platformId);
    setError(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/content/${contentId}/platform-targets`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          platformId,
          enabled: !currentEnabled,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTargets((prev) =>
          prev.map((t) => (t.platformId === platformId ? { ...t, enabled: !currentEnabled } : t))
        );
        onTargetsUpdated?.();
      } else {
        setError(json.error?.message || 'Failed to update target status.');
      }
    } catch {
      setError('Network error updating target status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Master Task Toggle Switch: toggles 1 task completion across targeted platforms
  const targetedPlatforms = targets.filter((t) => t.enabled);
  const isTaskCompleted =
    targetedPlatforms.length > 0 && targetedPlatforms.every((t) => t.completed);

  const handleToggleAllTaskCompletion = async () => {
    if (!canEdit || isTogglingAll) return;
    setIsTogglingAll(true);
    setError(null);

    const nextCompleted = !isTaskCompleted;

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/content/${contentId}/complete-platform`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          allTargeted: true,
          completed: nextCompleted,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchTargets();
        onTargetsUpdated?.();
        if (json.data?.archived) {
          onArchived?.();
        }
      } else {
        setError(json.error?.message || 'Failed to update task completion.');
      }
    } catch {
      setError('Network error updating task completion.');
    } finally {
      setIsTogglingAll(false);
    }
  };

  // Toggle completion for a single platform
  const handleTogglePlatformCompletion = async (platformId: string, currentCompleted: boolean) => {
    if (!canEdit || updatingCompletionId) return;
    setUpdatingCompletionId(platformId);
    setError(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/content/${contentId}/complete-platform`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platformId,
          completed: !currentCompleted,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchTargets();
        onTargetsUpdated?.();
        if (json.data?.archived) {
          onArchived?.();
        }
      } else {
        setError(json.error?.message || 'Failed to update platform completion.');
      }
    } catch {
      setError('Network error updating platform completion.');
    } finally {
      setUpdatingCompletionId(null);
    }
  };

  const handleDownloadForPlatform = async (platformId: string) => {
    if (!assets || assets.length === 0) return;
    const targetAsset = assets[0]; // Primary asset
    setDownloadingPlatformId(platformId);
    setError(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const downloadUrl = `/api/content/${contentId}/assets/${targetAsset.id}/file?download=true&platformId=${platformId}`;
      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const wasArchived = response.headers.get('x-content-archived') === 'true';

      // Genuine blob download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetAsset.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Re-fetch targets to reflect real server-side completion
      await fetchTargets();
      onTargetsUpdated?.();
      if (wasArchived) {
        onArchived?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download operation failed.';
      setError(msg);
    } finally {
      setDownloadingPlatformId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-[rgb(var(--muted-foreground))]">
        <Loader2 size={14} className="animate-spin text-[rgb(var(--primary))]" />
        <span>Loading platform targets...</span>
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="text-xs text-[rgb(var(--muted-foreground))] italic py-2">
        No active platforms configured.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[rgb(var(--foreground))] uppercase tracking-wider">
          Platform Targets & Completion
        </h3>
        {error && (
          <span className="flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle size={12} />
            {error}
          </span>
        )}
      </div>

      {/* ─── Task On/Off Toggle Switch ────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/25">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
              isTaskCompleted
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border-[rgb(var(--border))]'
            }`}
          >
            {isTogglingAll ? (
              <Loader2 size={16} className="animate-spin text-[rgb(var(--primary))]" />
            ) : isTaskCompleted ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <Sparkles size={16} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[rgb(var(--foreground))]">
                Daily Task Target
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isTaskCompleted
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30'
                }`}
              >
                {isTaskCompleted ? 'COMPLETED' : 'INCOMPLETE'}
              </span>
            </div>
            <p className="text-[11px] text-[rgb(var(--muted-foreground))] mt-0.5">
              {isTaskCompleted
                ? '1 task completed in targeted platforms for today'
                : 'Toggle ON to mark 1 task completed in targeted platforms today'}
            </p>
          </div>
        </div>

        {/* The Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isTaskCompleted}
          disabled={!canEdit || isTogglingAll}
          onClick={handleToggleAllTaskCompletion}
          title={
            isTaskCompleted
              ? 'Click to turn off task completion'
              : 'Click to mark 1 task completed in targeted platforms'
          }
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 ${
            isTaskCompleted ? 'bg-emerald-500' : 'bg-neutral-600 dark:bg-neutral-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isTaskCompleted ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* ─── Platform Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {targets.map((item) => {
          const isUpdating = updatingId === item.platformId;
          const isUpdatingComp = updatingCompletionId === item.platformId;
          const isDownloading = downloadingPlatformId === item.platformId;
          const hasAsset = assets.length > 0;

          return (
            <div
              key={item.platformId}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                item.enabled
                  ? 'border-[rgb(var(--primary))]/30 bg-[rgb(var(--primary))]/5 dark:bg-[rgb(var(--primary))]/10'
                  : 'border-[rgb(var(--border))] bg-[rgb(var(--muted))]/40 opacity-70'
              }`}
            >
              {/* Platform info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[rgb(var(--muted))] flex items-center justify-center shrink-0 border border-[rgb(var(--border))]">
                  <PlatformIcon
                    icon={item.platform.icon}
                    name={item.platform.name}
                    size={16}
                    className="shrink-0"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[rgb(var(--foreground))] truncate">
                    {item.platform.name}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {item.completed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                        <CheckCircle2 size={11} />
                        Completed
                      </span>
                    ) : item.enabled ? (
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <Circle size={9} />
                        Targeted
                      </span>
                    ) : (
                      <span className="text-[rgb(var(--muted-foreground))]">Not targeted</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions: Platform Toggle + Optional Single-Platform Check + Download */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Single-platform completion toggle */}
                {item.enabled && (
                  <button
                    type="button"
                    onClick={() => handleTogglePlatformCompletion(item.platformId, item.completed)}
                    disabled={!canEdit || isUpdatingComp}
                    title={
                      item.completed
                        ? `Click to unmark completion for ${item.platform.name}`
                        : `Click to mark completed for ${item.platform.name}`
                    }
                    className={`p-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      item.completed
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border-[rgb(var(--border))] hover:text-[rgb(var(--foreground))] hover:border-[rgb(var(--border-strong))]'
                    }`}
                  >
                    {isUpdatingComp ? (
                      <Loader2 size={13} className="animate-spin text-emerald-400" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                  </button>
                )}

                {/* Download button */}
                {hasAsset && item.enabled && (
                  <button
                    type="button"
                    onClick={() => handleDownloadForPlatform(item.platformId)}
                    disabled={isDownloading}
                    title={`Download media for ${item.platform.name} to complete target`}
                    className="p-1.5 rounded-lg text-xs font-medium text-[rgb(var(--foreground))] bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 size={13} className="animate-spin text-[rgb(var(--primary))]" />
                    ) : (
                      <Download size={13} />
                    )}
                  </button>
                )}

                {/* Platform Targeted ON / OFF button */}
                <button
                  type="button"
                  onClick={() => handleToggle(item.platformId, item.enabled)}
                  disabled={!canEdit || isUpdating}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    item.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border border-[rgb(var(--border))] hover:bg-[rgb(var(--border))]'
                  }`}
                  aria-label={`Toggle target for ${item.platform.name}`}
                >
                  {isUpdating ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : item.enabled ? (
                    'ON'
                  ) : (
                    'OFF'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
