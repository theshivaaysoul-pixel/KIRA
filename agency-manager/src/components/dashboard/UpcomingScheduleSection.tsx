'use client';
// src/components/dashboard/UpcomingScheduleSection.tsx
// Displays real scheduled content publications sorted chronologically.

import { Calendar, Clock, Globe } from 'lucide-react';
import type { DashboardUpcomingPublicationItem } from '@/lib/types/domain';
import { EmptyState } from '@/components/ui/Loading';

interface UpcomingScheduleSectionProps {
  items: DashboardUpcomingPublicationItem[];
  timezone?: string;
}

export function UpcomingScheduleSection({
  items,
  timezone = 'UTC',
}: UpcomingScheduleSectionProps) {
  const formatScheduledDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
            Upcoming Schedule
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Automated calendar & queued publishing ({timezone})
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Calendar size={16} />
        </div>
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Nothing scheduled yet"
          description="Schedule posts or stories to see your chronological publishing timeline here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 flex items-center justify-between gap-3 text-xs rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[rgb(var(--text-primary))] truncate">
                  {item.contentTitle}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[rgb(var(--text-secondary))]">
                  <span className="flex items-center gap-1 font-medium text-[rgb(var(--primary))]">
                    <Globe size={11} />
                    {item.platformName}
                  </span>
                  <span>·</span>
                  <span className="truncate">@{item.accountHandle}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-[rgb(var(--text-primary))]">
                  <Clock size={11} className="text-[rgb(var(--text-muted))]" />
                  <span>{formatScheduledDate(item.scheduledAt)}</span>
                </div>
                <span
                  className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    item.status === 'QUEUED'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
