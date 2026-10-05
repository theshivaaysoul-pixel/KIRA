'use client';
// src/components/tasks/TargetConfigModal.tsx
// Modal for configuring platform content targets for a specific calendar date and upcoming days.
// Dynamically presents active platforms with checkboxes, steppers, date switching, and bulk upcoming days support.

import { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Loader2, Target, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { useAuth } from '@/contexts/AuthContext';
import type { PlatformTargetDetail } from '@/lib/types/domain';

interface TargetConfigModalProps {
  open: boolean;
  date: string;
  platforms: PlatformTargetDetail[];
  onClose: () => void;
  onSaved: () => void;
  onDateChange?: (newDate: string) => void;
}

interface PlatformConfigState {
  platformId: string;
  name: string;
  icon: string;
  isSelected: boolean;
  targetCount: number;
  completedCount: number;
}

type UpcomingMode = 'NONE' | 'TOMORROW' | 'NEXT_3_DAYS' | 'NEXT_7_DAYS';

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

function getUpcomingDates(baseDateStr: string, count: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= count; i++) {
    dates.push(shiftDateStr(baseDateStr, i));
  }
  return dates;
}

export function TargetConfigModal({
  open,
  date,
  platforms,
  onClose,
  onSaved,
  onDateChange,
}: TargetConfigModalProps) {
  const { getIdToken } = useAuth();
  const [activeDate, setActiveDate] = useState(date);
  const [config, setConfig] = useState<PlatformConfigState[]>([]);
  const [applyUpcomingMode, setApplyUpcomingMode] = useState<UpcomingMode>('NONE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = formatToLocalDateStr();
  const tomorrowStr = shiftDateStr(todayStr, 1);

  useEffect(() => {
    if (open) {
      setActiveDate(date);
      setApplyUpcomingMode('NONE');
      setConfig(
        platforms.map((p) => ({
          platformId: p.platform.id,
          name: p.platform.name,
          icon: p.platform.icon,
          isSelected: p.targetCount > 0,
          targetCount: p.targetCount,
          completedCount: p.completedCount,
        }))
      );
      setError(null);
    }
  }, [open, date, platforms]);

  if (!open) return null;

  const handleDateSelect = (newDate: string) => {
    if (!newDate) return;
    setActiveDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  const toggleSelect = (platformId: string) => {
    setConfig((prev) =>
      prev.map((item) => {
        if (item.platformId !== platformId) return item;
        const nextSelected = !item.isSelected;
        return {
          ...item,
          isSelected: nextSelected,
          targetCount: nextSelected ? (item.targetCount > 0 ? item.targetCount : 1) : 0,
        };
      })
    );
  };

  const updateCount = (platformId: string, delta: number) => {
    setConfig((prev) =>
      prev.map((item) => {
        if (item.platformId !== platformId) return item;
        const nextVal = Math.max(0, Math.floor(item.targetCount + delta));
        return {
          ...item,
          targetCount: nextVal,
          isSelected: nextVal > 0 ? true : item.isSelected,
        };
      })
    );
  };

  const handleDirectInput = (platformId: string, valStr: string) => {
    const parsed = parseInt(valStr, 10);
    const safeVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setConfig((prev) =>
      prev.map((item) => {
        if (item.platformId !== platformId) return item;
        return {
          ...item,
          targetCount: safeVal,
          isSelected: safeVal > 0 ? true : item.isSelected,
        };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const platformTargets = config.map((c) => ({
      platformId: c.platformId,
      targetCount: c.isSelected ? c.targetCount : 0,
    }));

    let additionalDates: string[] = [];
    if (applyUpcomingMode === 'TOMORROW') {
      additionalDates = getUpcomingDates(activeDate, 1);
    } else if (applyUpcomingMode === 'NEXT_3_DAYS') {
      additionalDates = getUpcomingDates(activeDate, 3);
    } else if (applyUpcomingMode === 'NEXT_7_DAYS') {
      additionalDates = getUpcomingDates(activeDate, 7);
    }

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
          date: activeDate,
          platformTargets,
          additionalDates: additionalDates.length > 0 ? additionalDates : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        onSaved();
        onClose();
      } else {
        setError(json.error?.message || 'Failed to save daily targets.');
      }
    } catch {
      setError('Network error saving daily targets.');
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = new Date(activeDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isToday = activeDate === todayStr;
  const isTomorrow = activeDate === tomorrowStr;
  const isUpcoming = activeDate > todayStr;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))] shrink-0 bg-[rgb(var(--card))]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Target size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[rgb(var(--foreground))]">
                  Configure Targets
                </h2>
                {isUpcoming && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {isTomorrow ? 'Tomorrow' : 'Upcoming Day'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Date Selector Row */}
        <div className="px-6 py-3 bg-[rgb(var(--muted))]/20 border-b border-[rgb(var(--border))] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted-foreground))] font-semibold">
            <Calendar size={14} className="text-[rgb(var(--primary))]" />
            <span>Target Date:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleDateSelect(todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                isToday
                  ? 'bg-[rgb(var(--primary))] text-white border-[rgb(var(--primary))]'
                  : 'bg-[rgb(var(--card))] border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDateSelect(tomorrowStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                isTomorrow
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-[rgb(var(--card))] border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              Tomorrow
            </button>
            <div className="relative inline-flex items-center">
              <input
                type="date"
                value={activeDate}
                onChange={(e) => handleDateSelect(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-medium border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] focus:outline-none focus:border-[rgb(var(--primary))]"
                aria-label="Select target date"
              />
            </div>
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            Select platforms and set how many content items should be completed for{' '}
            <strong className="text-[rgb(var(--foreground))]">
              {isToday ? 'today' : isTomorrow ? 'tomorrow' : formattedDate}
            </strong>.
          </p>

          <div className="space-y-2.5">
            {config.map((item) => (
              <div
                key={item.platformId}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  item.isSelected
                    ? 'border-[rgb(var(--primary))]/40 bg-[rgb(var(--primary))]/5 shadow-sm'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 opacity-70'
                }`}
              >
                {/* Platform Checkbox & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.platformId)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      item.isSelected
                        ? 'bg-[rgb(var(--primary))] border-[rgb(var(--primary))] text-white'
                        : 'border-[rgb(var(--border))] bg-[rgb(var(--background))] hover:border-[rgb(var(--muted-foreground))]'
                    }`}
                    aria-label={`Toggle ${item.name}`}
                  >
                    {item.isSelected && <Check size={13} strokeWidth={3} />}
                  </button>

                  <div
                    className="w-7 h-7 rounded-lg bg-[rgb(var(--muted))] flex items-center justify-center shrink-0 border border-[rgb(var(--border))] cursor-pointer"
                    onClick={() => toggleSelect(item.platformId)}
                  >
                    <PlatformIcon icon={item.icon} name={item.name} size={16} />
                  </div>

                  <div className="min-w-0 cursor-pointer" onClick={() => toggleSelect(item.platformId)}>
                    <div className="text-sm font-semibold text-[rgb(var(--foreground))] truncate">
                      {item.name}
                    </div>
                    {item.completedCount > 0 && (
                      <div className="text-[10px] text-emerald-500 font-medium">
                        {item.completedCount} completed so far
                      </div>
                    )}
                  </div>
                </div>

                {/* Numeric Stepper [ - ] count [ + ] */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCount(item.platformId, -1)}
                    disabled={!item.isSelected || item.targetCount <= 0}
                    className="w-8 h-8 rounded-lg bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-[rgb(var(--foreground))] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    aria-label={`Decrease target for ${item.name}`}
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!item.isSelected}
                    value={item.isSelected ? item.targetCount : 0}
                    onChange={(e) => handleDirectInput(item.platformId, e.target.value)}
                    className="w-12 h-8 text-center font-bold text-sm rounded-lg bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[rgb(var(--foreground))] focus:outline-none focus:border-[rgb(var(--primary))] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={`Target count for ${item.name}`}
                  />

                  <button
                    type="button"
                    onClick={() => updateCount(item.platformId, 1)}
                    disabled={!item.isSelected}
                    className="w-8 h-8 rounded-lg bg-[rgb(var(--muted))] hover:bg-[rgb(var(--border))] text-[rgb(var(--foreground))] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    aria-label={`Increase target for ${item.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Apply to Upcoming Days Bulk Option ────────────────────────── */}
          <div className="p-3.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[rgb(var(--foreground))] flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Also Apply to Upcoming Days
              </span>
              <span className="text-[10px] text-[rgb(var(--muted-foreground))]">
                Quick bulk scheduling
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'NONE' as const, label: 'Only This Day' },
                { id: 'TOMORROW' as const, label: '+ Tomorrow' },
                { id: 'NEXT_3_DAYS' as const, label: '+ Next 3 Days' },
                { id: 'NEXT_7_DAYS' as const, label: '+ Next 7 Days' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApplyUpcomingMode(opt.id)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                    applyUpcomingMode === opt.id
                      ? 'bg-[rgb(var(--primary))]/10 border-[rgb(var(--primary))] text-[rgb(var(--primary))]'
                      : 'border-[rgb(var(--border))] bg-[rgb(var(--muted))]/20 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {applyUpcomingMode !== 'NONE' && (
              <p className="text-[11px] text-[rgb(var(--primary))] flex items-center gap-1 font-medium">
                <Sparkles size={11} />
                These targets will be saved for {activeDate} and also automatically configured for{' '}
                {applyUpcomingMode === 'TOMORROW'
                  ? 'tomorrow'
                  : applyUpcomingMode === 'NEXT_3_DAYS'
                  ? 'the next 3 days'
                  : 'the upcoming week (next 7 days)'}
                .
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[rgb(var(--border))] shrink-0 bg-[rgb(var(--card))]">
          <div className="text-xs text-[rgb(var(--muted-foreground))]">
            {applyUpcomingMode !== 'NONE' && (
              <span className="text-indigo-400 font-semibold">
                Multi-day target active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[rgb(var(--primary))] text-white hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              <span>
                {applyUpcomingMode === 'NONE'
                  ? 'Save Targets'
                  : `Save for ${applyUpcomingMode === 'TOMORROW' ? 'Today & Tomorrow' : 'Upcoming Days'}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
