'use client';
// src/components/dashboard/RecentActivitySection.tsx
// Displays real ActivityLog entries with human-readable labels and timestamps.

import {
  Activity,
  PlusCircle,
  Edit3,
  Trash2,
  Calendar,
  Send,
  Shield,
  LogIn,
  LogOut,
  AlertOctagon,
  Settings,
} from 'lucide-react';
import type { DashboardActivityItem, ActivityAction } from '@/lib/types/domain';
import { EmptyState } from '@/components/ui/Loading';

interface RecentActivitySectionProps {
  activity: DashboardActivityItem[];
}

export function RecentActivitySection({ activity }: RecentActivitySectionProps) {
  const getActionIcon = (action: ActivityAction) => {
    switch (action) {
      case 'CREATE':
        return <PlusCircle size={14} className="text-emerald-500" />;
      case 'UPDATE':
        return <Edit3 size={14} className="text-blue-500" />;
      case 'DELETE':
        return <Trash2 size={14} className="text-red-500" />;
      case 'SCHEDULE':
        return <Calendar size={14} className="text-purple-500" />;
      case 'PUBLISH_SUCCESS':
      case 'PUBLISH_ATTEMPT':
        return <Send size={14} className="text-emerald-500" />;
      case 'ROLE_CHANGED':
      case 'TEAM_MEMBER_REACTIVATED':
      case 'TEAM_MEMBER_SUSPENDED':
        return <Shield size={14} className="text-violet-500" />;
      case 'ACCESS_DENIED':
      case 'PUBLISH_FAILED':
        return <AlertOctagon size={14} className="text-red-500" />;
      case 'LOGIN':
        return <LogIn size={14} className="text-emerald-500" />;
      case 'LOGOUT':
        return <LogOut size={14} className="text-neutral-500" />;
      case 'SETTINGS_UPDATED':
        return <Settings size={14} className="text-cyan-500" />;
      default:
        return <Activity size={14} className="text-[rgb(var(--text-muted))]" />;
    }
  };

  const formatActivityTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
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
            Recent Activity
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Live audit log of operational and administrative actions
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))]">
          <Activity size={16} />
        </div>
      </div>

      {!activity || activity.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No recent activity"
          description="Activity events will appear here as team members publish content, schedule posts, and manage agency operations."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {activity.map((item) => (
            <div
              key={item.id}
              className="p-3 flex items-center justify-between gap-3 text-xs rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-full bg-[rgb(var(--bg-subtle))] flex items-center justify-center shrink-0">
                  {getActionIcon(item.action)}
                </div>
                <div className="truncate">
                  <span className="font-semibold text-[rgb(var(--text-primary))]">
                    {item.userName}
                  </span>
                  <span className="text-[rgb(var(--text-secondary))] ml-1.5">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-[rgb(var(--text-muted))] font-mono ml-1.5">
                    ({item.entityId})
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-[rgb(var(--text-muted))] shrink-0 font-mono">
                {formatActivityTime(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
