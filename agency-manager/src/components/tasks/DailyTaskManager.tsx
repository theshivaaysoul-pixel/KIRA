'use client';
// src/components/tasks/DailyTaskManager.tsx
// Redesigned Daily Platform Content Target Manager (Phase 19).
//
// Key Features:
// - Exactly ONE task per calendar date.
// - Real dynamic platforms from PlatformRepository.
// - Date navigation: [ ← Previous Day ] Date [ Next Day → ].
// - Overall Daily Progress card with real calculations.
// - Platform Target Cards with steppers, completed/remaining counters, and status.
// - TargetConfigModal for multi-platform configuration.
// - Immediate UI updates with server-side validation and persistence.

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sliders,
  CheckCircle2,
  Clock,
  CircleDashed,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { TargetConfigModal } from './TargetConfigModal';
import { MagneticButton } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyContentTargetWithRelations, PlatformTargetDetail } from '@/lib/types/domain';

export type TargetStatusFilter = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'UPCOMING';

/**
 * Classifies a platform target relative to the selected date and agency current day.
 */
function getPlatformTargetCategory(
  pt: PlatformTargetDetail,
  selectedDate: string,
  todayStr: string
): 'COMPLETED' | 'IN_PROGRESS' | 'OVERDUE' | 'UPCOMING' {
  if (pt.status === 'COMPLETE' || pt.completedCount >= pt.targetCount) {
    return 'COMPLETED';
  }
  if (selectedDate < todayStr) {
    return 'OVERDUE';
  }
  if (selectedDate > todayStr) {
    return 'UPCOMING';
  }
  return 'IN_PROGRESS';
}

function formatToLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  return formatToLocalDateStr(d);
}

export function DailyTaskManager() {
  const { user, getIdToken, loading: authLoading } = useAuth();

  // Current selected date in YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => formatToLocalDateStr());

  const [statusFilter, setStatusFilter] = useState<TargetStatusFilter>('ALL');

  const [data, setData] = useState<DailyContentTargetWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [updatingPlatformId, setUpdatingPlatformId] = useState<string | null>(null);

  // Fetch daily target from API
  const fetchDailyTarget = useCallback(async (date: string, isSilent = false) => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/tasks/daily?date=${date}`, { headers });
      const json = await res.json();

      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error?.message || 'Failed to load daily content target.');
      }
    } catch {
      setError('Network error fetching daily content target.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [authLoading, user, getIdToken]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDailyTarget(selectedDate);
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [selectedDate, fetchDailyTarget, authLoading, user]);

  // Date navigation handlers (pure calendar date arithmetic without timezone skew)
  const handleShiftDate = (days: number) => {
    setSelectedDate((prevDate) => shiftDateStr(prevDate, days));
  };

  const handleJumpToToday = () => {
    setSelectedDate(formatToLocalDateStr());
  };

  // Immediate stepper adjustment on a platform card
  const handleCardTargetStep = async (platformId: string, currentTarget: number, delta: number) => {
    if (!data || updatingPlatformId) return;

    const newTarget = Math.max(0, currentTarget + delta);
    if (newTarget === currentTarget) return;

    setUpdatingPlatformId(platformId);

    // Optimistically update local state
    const updatedPlatformTargets = data.platforms.map((p) => ({
      platformId: p.platform.id,
      targetCount: p.platform.id === platformId ? newTarget : p.targetCount,
    }));

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tasks/daily', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          date: selectedDate,
          platformTargets: updatedPlatformTargets,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error?.message || 'Failed to update target count.');
        // Revert on error
        await fetchDailyTarget(selectedDate, true);
      }
    } catch {
      setError('Network error updating target count.');
      await fetchDailyTarget(selectedDate, true);
    } finally {
      setUpdatingPlatformId(null);
    }
  };

  const todayStr = formatToLocalDateStr();
  const isToday = selectedDate === todayStr;
  const isUpcoming = selectedDate > todayStr;
  const isPast = selectedDate < todayStr;

  const tomorrowStr = shiftDateStr(todayStr, 1);
  const isTomorrow = selectedDate === tomorrowStr;

  const daysDifference = (() => {
    const [y1, m1, d1] = todayStr.split('-').map(Number);
    const [y2, m2, d2] = selectedDate.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
  })();

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedDateShort = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Copy today's configured targets to the selected upcoming date
  const handleCopyTodayTargets = async () => {
    if (!user || updatingPlatformId) return;
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch today's target to get its configured platforms
      const todayRes = await fetch(`/api/tasks/daily?date=${todayStr}`, { headers });
      const todayJson = await todayRes.json();
      if (!todayJson.success || !todayJson.data) {
        setError("Could not load today's targets to copy.");
        return;
      }

      const todayPlatforms: PlatformTargetDetail[] = todayJson.data.platforms;
      const targetsToCopy = todayPlatforms
        .filter((p) => p.targetCount > 0)
        .map((p) => ({
          platformId: p.platform.id,
          targetCount: p.targetCount,
        }));

      if (targetsToCopy.length === 0) {
        setError("Today does not have any active targets to copy. Configure targets manually.");
        return;
      }

      const saveRes = await fetch('/api/tasks/daily', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          date: selectedDate,
          platformTargets: targetsToCopy,
        }),
      });

      const saveJson = await saveRes.json();
      if (saveJson.success && saveJson.data) {
        setData(saveJson.data);
      } else {
        setError(saveJson.error?.message || 'Failed to copy targets.');
      }
    } catch {
      setError('Network error copying targets to upcoming date.');
    } finally {
      setLoading(false);
    }
  };

  const targetedPlatforms = data?.platforms.filter((p) => p.targetCount > 0) || [];
  const untargetedPlatforms = data?.platforms.filter((p) => p.targetCount === 0) || [];

  const inProgressCount = targetedPlatforms.filter(
    (pt) => getPlatformTargetCategory(pt, selectedDate, todayStr) === 'IN_PROGRESS'
  ).length;

  const completedCount = targetedPlatforms.filter(
    (pt) => getPlatformTargetCategory(pt, selectedDate, todayStr) === 'COMPLETED'
  ).length;

  const overdueCount = targetedPlatforms.filter(
    (pt) => getPlatformTargetCategory(pt, selectedDate, todayStr) === 'OVERDUE'
  ).length;

  const upcomingCount = targetedPlatforms.filter(
    (pt) => getPlatformTargetCategory(pt, selectedDate, todayStr) === 'UPCOMING'
  ).length;

  const filteredPlatforms = targetedPlatforms.filter((pt) => {
    if (statusFilter === 'ALL') return true;
    return getPlatformTargetCategory(pt, selectedDate, todayStr) === statusFilter;
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-full min-w-0 animate-in fade-in">
      {/* ─── Top Header & Date Navigation ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[rgb(var(--border))] pb-4 sm:pb-6 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[rgb(var(--foreground))] tracking-tight">
              Daily Content Targets
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20 shrink-0">
              <Sparkles size={11} />
              Daily System
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[rgb(var(--muted-foreground))] mt-1">
            Configure and track platform-wise content target completion for each calendar date.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              fetchDailyTarget(selectedDate, true);
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
            title="Refresh daily targets"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          <MagneticButton>
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[rgb(var(--primary))] text-white hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Sliders size={15} />
              <span>Configure Targets</span>
            </button>
          </MagneticButton>
        </div>
      </div>

      {/* ─── Calendar Date Navigator Bar ───────────────────────────────────── */}
      <div className="card p-3 sm:p-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm min-w-0">
        {/* Navigation buttons: Prev, Today, Tomorrow, Next */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => handleShiftDate(-1)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] text-xs font-semibold text-[rgb(var(--foreground))] transition-colors shrink-0"
          >
            <ChevronLeft size={15} />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleJumpToToday}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${isToday
                  ? 'bg-[rgb(var(--primary))] text-white shadow-sm'
                  : 'bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-[rgb(var(--foreground))]'
                }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowStr)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${isTomorrow
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-indigo-400'
                }`}
            >
              Tomorrow
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleShiftDate(1)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] text-xs font-semibold text-[rgb(var(--foreground))] transition-colors shrink-0"
          >
            <span>Next</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Current Date Display & Native Date Picker */}
        <div className="flex items-center gap-2 justify-between md:justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[rgb(var(--border))]/40 min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-base font-bold text-[rgb(var(--foreground))] min-w-0">
            <Calendar size={16} className="text-[rgb(var(--primary))] shrink-0" />
            <span className="sm:hidden truncate">{formattedDateShort}</span>
            <span className="hidden sm:inline truncate">{formattedDate}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isToday ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] sm:text-xs font-semibold border border-emerald-500/20">
                Today
              </span>
            ) : isTomorrow ? (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[11px] sm:text-xs font-semibold border border-indigo-500/20">
                Tomorrow
              </span>
            ) : isUpcoming ? (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[11px] sm:text-xs font-semibold border border-indigo-500/20">
                +{daysDifference}d
              </span>
            ) : isPast ? (
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 text-[11px] sm:text-xs font-semibold border border-rose-500/20">
                Past
              </span>
            ) : null}

            {/* Quick date picker input */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs font-medium border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] focus:outline-none focus:border-[rgb(var(--primary))] cursor-pointer max-w-[125px] sm:max-w-none"
              title="Pick any upcoming or past date"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-[rgb(var(--primary))]" />
          <p className="text-sm text-[rgb(var(--muted-foreground))]">Loading daily content targets...</p>
        </div>
      ) : (
        <>
          {/* ─── Other Available Platforms (Placed before Today's Overall Progress) ─ */}
          {untargetedPlatforms.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--muted-foreground))]">
                  Other Available Platforms
                </h3>
                <span className="text-[11px] text-[rgb(var(--muted-foreground))]">
                  Quick-add to daily targets
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {untargetedPlatforms.map((pt) => (
                  <button
                    key={pt.platform.id}
                    type="button"
                    onClick={() => handleCardTargetStep(pt.platform.id, 0, 1)}
                    title={`Add ${pt.platform.name} with target 1`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] hover:border-[rgb(var(--primary))] text-xs font-medium text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-all group shadow-sm"
                  >
                    <PlatformIcon icon={pt.platform.icon} name={pt.platform.name} size={15} />
                    <span>{pt.platform.name}</span>
                    <span className="text-sm font-bold text-[rgb(var(--primary))] opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                      +
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Overall Daily Progress Card ───────────────────────────────── */}
          {data && data.overallTarget > 0 ? (
            <div className="card p-4 sm:p-6 rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--card))] via-[rgb(var(--card))] to-[rgb(var(--primary))]/5 shadow-sm space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[rgb(var(--muted-foreground))]">
                    {isToday
                      ? "Today's Overall Progress"
                      : isUpcoming
                        ? `Upcoming Deliverables Target (${isTomorrow ? 'Tomorrow' : formattedDateShort})`
                        : `Past Date Targets (${formattedDateShort})`}
                  </h2>
                  <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[rgb(var(--foreground))] tracking-tight mt-0.5">
                    {data.overallCompleted}{' '}
                    <span className="text-[rgb(var(--muted-foreground))] text-sm sm:text-lg font-normal">
                      / {data.overallTarget} items completed
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgb(var(--border))]/40">
                  <div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">Remaining</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-[rgb(var(--foreground))]">
                      {data.overallRemaining}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">Completion</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-[rgb(var(--primary))]">
                      {data.overallPercentage}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[rgb(var(--muted))] rounded-full h-2.5 sm:h-3 overflow-hidden p-0.5 border border-[rgb(var(--border))]">
                <div
                  className="bg-gradient-to-r from-[rgb(var(--primary))] to-emerald-500 h-full rounded-full smooth-progress"
                  style={{ width: `${data.overallPercentage}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[rgb(var(--muted-foreground))] gap-1">
                <span>
                  {data.platforms.filter((p) => p.status === 'COMPLETE' && p.targetCount > 0).length} of{' '}
                  {targetedPlatforms.length} platform targets completed
                </span>
                <span>{data.overallRemaining === 0 ? '🎉 All targets completed!' : `${data.overallRemaining} remaining`}</span>
              </div>
            </div>
          ) : (
            <div className="card p-5 sm:p-8 rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))]/50 text-center space-y-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--muted))] flex items-center justify-center mx-auto text-[rgb(var(--muted-foreground))]">
                <CircleDashed size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-[rgb(var(--foreground))]">
                  {isToday
                    ? 'No content targets configured for today'
                    : isUpcoming
                      ? `No content targets configured for ${isTomorrow ? 'tomorrow' : formattedDate} yet`
                      : `No content targets configured for this past date`}
                </h3>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {isUpcoming
                    ? 'Plan ahead by setting platform-specific targets for this upcoming day, or copy targets directly from today.'
                    : 'Decide platform-specific download and publishing targets for your agency to begin tracking daily deliverables.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--primary))] text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Sliders size={16} />
                  <span>Configure Targets for {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formattedDate}</span>
                </button>
                {isUpcoming && (
                  <button
                    type="button"
                    onClick={handleCopyTodayTargets}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--border))] bg-[rgb(var(--card))] hover:bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] transition-colors shadow-sm"
                  >
                    <Copy size={15} className="text-indigo-400" />
                    <span>Copy Today&apos;s Targets</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── Platform Targets Grid ──────────────────────────────────────── */}
          {targetedPlatforms.length > 0 && (
            <div className="flex flex-col gap-6 sm:gap-7 min-w-0 w-full">
              {/* Header with status filter buttons to separate completed, overdue, in progress, and upcoming */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 w-full">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[rgb(var(--muted-foreground))]">
                    Platform Targets
                  </h2>
                  <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                    Showing {filteredPlatforms.length} of {targetedPlatforms.length} configured targets
                  </p>
                </div>

                {/* Filter buttons - horizontally scrollable container constrained to mobile screen */}
                <div className="w-full sm:w-auto max-w-full overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                  <div className="flex items-center gap-1.5 w-max">
                    {[
                      { id: 'ALL' as const, label: 'All', count: targetedPlatforms.length, icon: <Layers size={13} />, color: 'text-[rgb(var(--foreground))]' },
                      { id: 'IN_PROGRESS' as const, label: 'In Progress', count: inProgressCount, icon: <Clock size={13} />, color: 'text-amber-500' },
                      { id: 'COMPLETED' as const, label: 'Completed', count: completedCount, icon: <CheckCircle2 size={13} />, color: 'text-emerald-500' },
                      { id: 'OVERDUE' as const, label: 'Overdue', count: overdueCount, icon: <AlertTriangle size={13} />, color: 'text-rose-500' },
                      { id: 'UPCOMING' as const, label: 'Upcoming', count: upcomingCount, icon: <Calendar size={13} />, color: 'text-indigo-400' },
                    ].map((tab) => {
                      const isActive = statusFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${isActive
                              ? 'bg-[rgb(var(--primary))] text-white border-[rgb(var(--primary))] shadow-sm'
                              : 'bg-[rgb(var(--card))] border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:border-[rgb(var(--border-strong))]'
                            }`}
                        >
                          <span className={isActive ? 'text-white' : tab.color}>{tab.icon}</span>
                          <span>{tab.label}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]'
                              }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {filteredPlatforms.length === 0 ? (
                <div className="card p-8 rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))]/40 text-center space-y-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[rgb(var(--muted))] flex items-center justify-center mx-auto text-[rgb(var(--muted-foreground))]">
                    {statusFilter === 'OVERDUE' ? (
                      <AlertTriangle size={20} className="text-rose-500" />
                    ) : statusFilter === 'COMPLETED' ? (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : statusFilter === 'UPCOMING' ? (
                      <Calendar size={20} className="text-indigo-400" />
                    ) : (
                      <Clock size={20} className="text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[rgb(var(--foreground))]">
                      No {statusFilter.toLowerCase().replace('_', ' ')} targets
                    </h3>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                      There are no platform targets categorized as {statusFilter.toLowerCase().replace('_', ' ')} for {formattedDate}.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className="px-3.5 py-1.5 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] text-xs font-semibold text-[rgb(var(--foreground))] transition-colors"
                    >
                      Show All Targets ({targetedPlatforms.length})
                    </button>
                    {statusFilter === 'OVERDUE' && isToday && (
                      <button
                        type="button"
                        onClick={() => handleShiftDate(-1)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors"
                      >
                        View Yesterday&apos;s Targets
                      </button>
                    )}
                    {statusFilter === 'UPCOMING' && isToday && (
                      <button
                        type="button"
                        onClick={() => handleShiftDate(1)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition-colors"
                      >
                        View Tomorrow&apos;s Targets
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0 w-full">
                  {filteredPlatforms.map((pt) => {
                    const category = getPlatformTargetCategory(pt, selectedDate, todayStr);
                    const isComplete = category === 'COMPLETED';
                    const isUpdating = updatingPlatformId === pt.platform.id;

                    return (
                      <div
                        key={pt.platform.id}
                        className={`card group/pcard p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between gap-4 ${isComplete
                            ? 'border-emerald-500/30 bg-emerald-500/5 shadow-sm'
                            : category === 'OVERDUE'
                              ? 'border-rose-500/30 bg-rose-500/5 shadow-sm'
                              : category === 'UPCOMING'
                                ? 'border-indigo-500/30 bg-indigo-500/5 shadow-sm'
                                : 'border-[rgb(var(--border))] bg-[rgb(var(--card))] hover:border-[rgb(var(--primary))]/30'
                          }`}
                      >
                        {/* Card Header: Platform Info & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[rgb(var(--muted))] flex items-center justify-center shrink-0 border border-[rgb(var(--border))] transition-transform duration-200 group-hover/pcard:scale-110">
                              <PlatformIcon
                                icon={pt.platform.icon}
                                name={pt.platform.name}
                                size={20}
                                className="shrink-0"
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-[rgb(var(--foreground))] truncate">
                                {pt.platform.name}
                              </h3>
                              <span className="text-[11px] text-[rgb(var(--muted-foreground))]">
                                {pt.platform.slug}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {category === 'COMPLETED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                                <CheckCircle2 size={13} />
                                Complete
                              </span>
                            ) : category === 'OVERDUE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                                <AlertTriangle size={13} />
                                Overdue
                              </span>
                            ) : category === 'UPCOMING' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                <Calendar size={13} />
                                Upcoming
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                                <Clock size={13} />
                                In Progress
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Metrics Table: Target, Completed, Remaining */}
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[rgb(var(--muted))]/50 border border-[rgb(var(--border))]/50 text-center">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[rgb(var(--muted-foreground))]">
                              Target
                            </div>
                            <div className="text-base font-extrabold font-mono text-[rgb(var(--foreground))] mt-0.5">
                              {pt.targetCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-emerald-500">
                              Completed
                            </div>
                            <div className="text-base font-extrabold font-mono text-emerald-500 mt-0.5">
                              {pt.completedCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[rgb(var(--muted-foreground))]">
                              Remaining
                            </div>
                            <div className="text-base font-extrabold font-mono text-[rgb(var(--foreground))] mt-0.5">
                              {pt.remaining}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[rgb(var(--muted-foreground))]">Progress</span>
                            <span className="font-mono font-bold text-[rgb(var(--foreground))]">
                              {pt.percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-[rgb(var(--muted))] rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full smooth-progress ${isComplete ? 'bg-emerald-500' : 'bg-[rgb(var(--primary))]'
                                }`}
                              style={{ width: `${pt.percentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Stepper Quick-Adjustment Control */}
                        <div className="flex items-center justify-between pt-2 border-t border-[rgb(var(--border))]">
                          <span className="text-[11px] text-[rgb(var(--muted-foreground))]">
                            Adjust Target:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCardTargetStep(pt.platform.id, pt.targetCount, -1)}
                              disabled={isUpdating || pt.targetCount <= 0}
                              className="w-7 h-7 rounded-lg bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-[rgb(var(--foreground))] flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              aria-label={`Decrease target for ${pt.platform.name}`}
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono text-[rgb(var(--foreground))]">
                              {isUpdating ? <Loader2 size={12} className="animate-spin mx-auto" /> : pt.targetCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCardTargetStep(pt.platform.id, pt.targetCount, 1)}
                              disabled={isUpdating}
                              className="w-7 h-7 rounded-lg bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-[rgb(var(--foreground))] flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 cursor-pointer"
                              aria-label={`Increase target for ${pt.platform.name}`}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Target Configuration Modal ────────────────────────────────────── */}
      <TargetConfigModal
        open={configModalOpen}
        date={selectedDate}
        platforms={data?.platforms || []}
        onClose={() => setConfigModalOpen(false)}
        onSaved={() => fetchDailyTarget(selectedDate, true)}
        onDateChange={(newDate) => setSelectedDate(newDate)}
      />
    </div>
  );
}
