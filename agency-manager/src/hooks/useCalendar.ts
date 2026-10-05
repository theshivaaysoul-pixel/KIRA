'use client';
// src/hooks/useCalendar.ts
// Client-side state management for Content Calendar & Scheduling (Phase 9).

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentPublication, PublicationStatus } from '@/lib/types/domain';
import type { CalendarEvent } from '@/lib/services/calendar-service';

export interface CalendarFilters {
  startDate: string;
  endDate: string;
  status: PublicationStatus | 'ALL';
  socialAccountId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1)).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();
  return { start, end };
}

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Request failed');
  return json.data as T;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendar() {
  const { user, getIdToken } = useAuth();
  const now = new Date();

  const [currentYear, setCurrentYear] = useState(now.getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getUTCMonth()); // 0-indexed

  const [filters, setFilters] = useState<CalendarFilters>(() => {
    const { start, end } = getMonthBounds(now.getUTCFullYear(), now.getUTCMonth());
    return {
      startDate: start,
      endDate: end,
      status: 'ALL',
      socialAccountId: '',
    };
  });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (f: CalendarFilters) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) return;
        const sp = new URLSearchParams();
        sp.set('startDate', f.startDate);
        sp.set('endDate', f.endDate);
        if (f.status !== 'ALL') sp.set('status', f.status);
        if (f.socialAccountId) sp.set('socialAccountId', f.socialAccountId);

        const data = await apiFetch<{ events: CalendarEvent[]; timezone: string; startDate: string; endDate: string }>(
          `/api/calendar?${sp}`,
          token
        );
        setEvents(data.events);
        setTimezone(data.timezone);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load calendar events');
      } finally {
        setLoading(false);
      }
    },
    [user, getIdToken]
  );

  useEffect(() => {
    fetchEvents(filters);
  }, [filters, fetchEvents]);

  const goToPrevMonth = useCallback(() => {
    const newMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const newYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    const { start, end } = getMonthBounds(newYear, newMonth);
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  }, [currentYear, currentMonth]);

  const goToNextMonth = useCallback(() => {
    const newMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const newYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    const { start, end } = getMonthBounds(newYear, newMonth);
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  }, [currentYear, currentMonth]);

  const goToToday = useCallback(() => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    setCurrentYear(y);
    setCurrentMonth(m);
    const { start, end } = getMonthBounds(y, m);
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  }, []);

  const updateFilter = useCallback(
    <K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const refresh = useCallback(() => fetchEvents(filters), [fetchEvents, filters]);

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const schedulePublication = useCallback(
    async (data: {
      contentId: string;
      socialAccountId: string;
      scheduledAt: string;
      platformSpecificCaption?: string;
      platformSpecificTitle?: string;
    }): Promise<ContentPublication> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const pub = await apiFetch<ContentPublication>('/api/calendar', token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await refresh();
      return pub;
    },
    [user, getIdToken, refresh]
  );

  const reschedulePublication = useCallback(
    async (
      pubId: string,
      data: {
        scheduledAt: string;
        platformSpecificCaption?: string;
        platformSpecificTitle?: string;
      }
    ): Promise<ContentPublication> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const pub = await apiFetch<ContentPublication>(`/api/calendar/${pubId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      await refresh();
      return pub;
    },
    [user, getIdToken, refresh]
  );

  const cancelPublication = useCallback(
    async (pubId: string): Promise<ContentPublication> => {
      if (!user) throw new Error('Not authenticated');
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const pub = await apiFetch<ContentPublication>(`/api/calendar/${pubId}`, token, {
        method: 'DELETE',
      });
      await refresh();
      return pub;
    },
    [user, getIdToken, refresh]
  );

  // ─── Derived ─────────────────────────────────────────────────────────────────

  /** Group events by UTC date string (YYYY-MM-DD) for the calendar grid */
  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const dateKey = ev.publication.scheduledAt!.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(ev);
    return acc;
  }, {});

  return {
    currentYear,
    currentMonth,
    events,
    eventsByDate,
    timezone,
    loading,
    error,
    filters,
    updateFilter,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    refresh,
    schedulePublication,
    reschedulePublication,
    cancelPublication,
  };
}
