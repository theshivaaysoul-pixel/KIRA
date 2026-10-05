'use client';
// src/components/calendar/CalendarView.tsx
// Full month-view Content Calendar. Real events from persisted ContentPublication records.
// Supports scheduling, rescheduling, cancelling, and status filtering.

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Globe,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { useCalendar } from '@/hooks/useCalendar';
import { usePermission } from '@/hooks/usePermission';
import { ScheduleModal } from './ScheduleModal';
import { RescheduleModal } from './RescheduleModal';
import type { CalendarEvent } from '@/lib/services/calendar-service';
import type { ContentPublication } from '@/lib/types/domain';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { MagneticButton } from '@/components/motion';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  QUEUED:     { label: 'Queued',     className: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' },
  PROCESSING: { label: 'Processing', className: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  PUBLISHED:  { label: 'Published',  className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  FAILED:     { label: 'Failed',     className: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  RETRYING:   { label: 'Retrying',   className: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  CANCELLED:  { label: 'Cancelled',  className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
};

// ─── Cell Event Chip ───────────────────────────────────────────────────────────

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (ev: CalendarEvent) => void;
}) {
  const badge = STATUS_BADGE[event.publication.status] || STATUS_BADGE['QUEUED'];
  const time = event.publication.scheduledAt
    ? new Date(event.publication.scheduledAt).toISOString().slice(11, 16) + ' UTC'
    : '';

  return (
    <button
      className={`w-full text-left text-[10px] rounded-md px-1.5 py-1 mb-0.5 truncate transition-all hover:scale-[1.02] ${badge.className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      title={`${event.content.title} @ ${event.account.username} — ${event.publication.status}`}
    >
      <span className="font-medium">{time}</span>{' '}
      <PlatformIcon icon={event.platformIcon} name={event.platformName} size={11} className="inline mr-1 align-middle shrink-0" />
      <span className="truncate">{event.content.title}</span>
    </button>
  );
}

// ─── Calendar Grid ─────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  eventsByDate: Record<string, CalendarEvent[]>;
  onDayClick: (dateStr: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const startDow = firstDayOfMonth.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: (string | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[rgb(var(--border))]">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-[rgb(var(--border))]" style={{ minHeight: 0 }}>
        {cells.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="bg-[rgb(var(--bg-subtle))]/40 min-h-[90px]" />;
          }

          const isToday = dateStr === todayStr;
          const dayEvents = eventsByDate[dateStr] || [];
          const dayNum = parseInt(dateStr.split('-')[2], 10);

          return (
            <div
              key={dateStr}
              className={`min-h-[90px] p-1.5 flex flex-col cursor-pointer transition-colors
                ${isToday ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/20' : 'hover:bg-[rgb(var(--bg-subtle))]/60'}
              `}
              onClick={() => onDayClick(dateStr)}
              role="gridcell"
              aria-label={`${dateStr}, ${dayEvents.length} events`}
            >
              <span
                className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-indigo-500 text-white' : 'text-[rgb(var(--text-secondary))]'}
                `}
              >
                {dayNum}
              </span>

              <div className="flex-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.publication.id} event={ev} onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-[rgb(var(--text-muted))] pl-1">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarView ─────────────────────────────────────────────────────────

export function CalendarView() {
  const {
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
  } = useCalendar();

  const { hasPermission } = usePermission();
  const canCreate = hasPermission('calendar.create');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [clickedDate, setClickedDate] = useState<string | null>(null);

  const handleEventClick = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setRescheduleOpen(true);
  };

  const handleDayClick = (dateStr: string) => {
    if (!canCreate) return;
    setClickedDate(dateStr);
    setScheduleOpen(true);
  };

  const handleRescheduled = (_pub: ContentPublication) => {
    refresh();
  };

  const handleCancelled = (_pub: ContentPublication) => {
    refresh();
  };

  // Stats
  const queued = events.filter((e) => e.publication.status === 'QUEUED').length;
  const published = events.filter((e) => e.publication.status === 'PUBLISHED').length;
  const failed = events.filter((e) => e.publication.status === 'FAILED').length;

  return (
    <div className="flex flex-col h-full gap-8" style={{ minHeight: 0 }}>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <CalendarIcon size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[rgb(var(--text-primary))]">Content Calendar</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--text-muted))]">
              <Globe size={11} />
              <span>Agency timezone: <strong className="text-[rgb(var(--text-secondary))]">{timezone}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as typeof filters.status)}
            className="input py-1.5 text-xs w-36"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="PUBLISHED">Published</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            onClick={refresh}
            disabled={loading}
            className="w-11 h-11 rounded-full border border-[rgb(var(--border))] flex items-center justify-center text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] hover:text-[rgb(var(--text-primary))] transition-colors shrink-0 disabled:opacity-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <button
              id="schedule-publication-btn"
              onClick={() => { setClickedDate(null); setScheduleOpen(true); }}
              className="btn-primary inline-flex items-center justify-center gap-2.5 px-6 py-2.5 text-sm font-semibold rounded-full shadow-md min-h-[46px] whitespace-nowrap shrink-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={18} className="shrink-0" />
              <span>Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
        {[
          { label: 'Queued this month', value: queued, color: 'text-indigo-400' },
          { label: 'Published this month', value: published, color: 'text-green-400' },
          { label: 'Failed this month', value: failed, color: 'text-red-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card p-5 flex flex-col justify-between"
            style={{ padding: '1.5rem', minHeight: '110px' }}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] text-[rgb(var(--text-muted))]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between card px-4 py-3">
        <button
          onClick={goToPrevMonth}
          className="w-10 h-10 rounded-full border border-[rgb(var(--border))] flex items-center justify-center hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[rgb(var(--text-primary))]">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={goToToday}
            className="text-xs px-4 py-1.5 rounded-full bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] border border-[rgb(var(--border))] font-semibold transition-colors min-h-[34px]"
          >
            Today
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="w-10 h-10 rounded-full border border-[rgb(var(--border))] flex items-center justify-center hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && events.length === 0 && (
        <div className="card flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-indigo-400" />
            <p className="text-sm text-[rgb(var(--text-muted))]">Loading calendar…</p>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && events.length === 0 && !error && (
        <div className="card flex-1 flex flex-col items-center justify-center gap-4 py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <CalendarIcon size={32} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-[rgb(var(--text-primary))]">No publications this month</p>
            <p className="text-sm text-[rgb(var(--text-muted))] mt-1">
              {canCreate
                ? 'Schedule APPROVED content to see events on the calendar.'
                : 'No scheduled publications for this month.'}
            </p>
          </div>
          {canCreate && (
            <MagneticButton>
              <button
                onClick={() => setScheduleOpen(true)}
                className="btn-primary inline-flex items-center justify-center gap-2.5 px-7 py-3 text-sm sm:text-base font-semibold rounded-full shadow-lg min-h-[48px] whitespace-nowrap transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Plus size={19} className="shrink-0" />
                <span>Schedule Publication</span>
              </button>
            </MagneticButton>
          )}
        </div>
      )}

      {/* ── Calendar Grid ── */}
      {!loading && (events.length > 0 || !error) && (
        <div className="card flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          <CalendarGrid
            year={currentYear}
            month={currentMonth}
            eventsByDate={eventsByDate}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        </div>
      )}

      {/* ── Modals ── */}
      <ScheduleModal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => { setScheduleOpen(false); refresh(); }}
        schedulePublication={schedulePublication}
      />

      <RescheduleModal
        isOpen={rescheduleOpen}
        event={selectedEvent}
        onClose={() => { setRescheduleOpen(false); setSelectedEvent(null); }}
        onRescheduled={handleRescheduled}
        onCancelled={handleCancelled}
        reschedulePublication={reschedulePublication}
        cancelPublication={cancelPublication}
      />
    </div>
  );
}
