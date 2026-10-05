'use client';
// src/app/(dashboard)/activity/page.tsx
// Phase 12 — Real Activity Log
// Displays real ACT records with actor resolution, filters, search, and pagination.
// Sensitive metadata is redacted server-side — never displayed in the UI.

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { AccessRestrictedCard } from '@/components/auth/AccessRestrictedCard';
import type { ActivityLogWithActor } from '@/lib/services/activity-log-service';
import type { ActivityAction } from '@/lib/types/domain';

// ─── Action badge colours ─────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  LOGIN:                   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  LOGOUT:                  'bg-slate-500/10 text-slate-400 border-slate-500/20',
  CREATE:                  'bg-green-500/10 text-green-400 border-green-500/20',
  UPDATE:                  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE:                  'bg-red-500/10 text-red-400 border-red-500/20',
  ARCHIVE:                 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SCHEDULE:                'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  PUBLISH_ATTEMPT:         'bg-purple-500/10 text-purple-400 border-purple-500/20',
  PUBLISH_SUCCESS:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PUBLISH_FAILED:          'bg-red-500/10 text-red-400 border-red-500/20',
  SETTINGS_UPDATED:        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  ROLE_CHANGED:            'bg-violet-500/10 text-violet-400 border-violet-500/20',
  ACCESS_DENIED:           'bg-red-500/10 text-red-500 border-red-500/20',
  TEAM_MEMBER_SUSPENDED:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
  TEAM_MEMBER_REACTIVATED: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
};

const ALL_ACTIONS: ActivityAction[] = [
  'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE',
  'SCHEDULE', 'PUBLISH_ATTEMPT', 'PUBLISH_SUCCESS', 'PUBLISH_FAILED',
  'SETTINGS_UPDATED', 'ROLE_CHANGED', 'ACCESS_DENIED',
  'TEAM_MEMBER_SUSPENDED', 'TEAM_MEMBER_REACTIVATED',
];

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] border-[rgb(var(--border))]';
  return (
    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const [rel, setRel] = useState<string>('');

  useEffect(() => {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) setRel('just now');
    else if (mins < 60) setRel(`${mins}m ago`);
    else if (hours < 24) setRel(`${hours}h ago`);
    else setRel(`${days}d ago`);
  }, [iso]);

  return (
    <span title={iso} className="text-xs text-[rgb(var(--text-muted))] cursor-default">
      {rel || iso.split('T')[0]}
    </span>
  );
}

interface LogResult {
  items: ActivityLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ActivityPage() {
  const { getIdToken } = useAuth();
  const { role, hasPermission, loading: permissionLoading } = usePermission();
  const [logs, setLogs] = useState<LogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActivityAction | 'ALL'>('ALL');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter !== 'ALL') params.set('action', actionFilter);
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      params.set('page', String(page));
      params.set('limit', '50');
      params.set('order', 'desc');

      const res = await fetch(`/api/activity?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      } else {
        setError(json.error?.message || 'Failed to load activity log.');
      }
    } catch {
      setError('Network error loading activity log.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, search, actionFilter, entityTypeFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const isAuthorized = role === 'OWNER' || role === 'MANAGER' || hasPermission('activity.read');

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-[rgb(var(--primary))]" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <AccessRestrictedCard
        featureName="Activity Logs"
        description="Only the Owner and Manager can access the agency activity log."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[rgb(var(--text-primary))] flex items-center gap-2">
            <Activity size={20} />
            Activity Log
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Real audit trail. Sensitive metadata is redacted. Logs are never deleted.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="btn-ghost p-2 rounded-lg"
          disabled={loading}
          aria-label="Refresh activity log"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-10 pr-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Search
          </button>
        </form>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value as ActivityAction | 'ALL'); setPage(1); }}
          className="input py-2 text-sm"
        >
          <option value="ALL">All Actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Entity type filter */}
        <input
          type="text"
          placeholder="Entity type..."
          value={entityTypeFilter}
          onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
          className="input py-2 text-sm w-40"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={18} className="animate-spin text-[rgb(var(--text-muted))]" />
          </div>
        ) : !logs || logs.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--bg-subtle))] flex items-center justify-center">
              <Activity size={22} className="text-[rgb(var(--text-muted))]" />
            </div>
            <p className="text-sm text-[rgb(var(--text-secondary))]">No activity records found</p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Activity logs are generated automatically when users interact with the system.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]">
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Time</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Actor</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Action</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Entity</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Entity ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <RelativeTime iso={log.createdAt} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center shrink-0">
                            <User size={11} className="text-[rgb(var(--text-muted))]" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[rgb(var(--text-primary))]">
                              {log.actorName ?? 'Unknown system actor'}
                            </p>
                            {log.actorRole && (
                              <p className="text-[10px] text-[rgb(var(--text-muted))]">{log.actorRole}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="py-3 px-4 text-sm text-[rgb(var(--text-secondary))]">
                        {log.entityType}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-[rgb(var(--text-muted))]">{log.entityId}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
              <span>{logs.total} total entries</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={logs.page <= 1}
                  className="p-1.5 rounded-lg hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  Page {logs.page} of {logs.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(logs.totalPages, p + 1))}
                  disabled={logs.page >= logs.totalPages}
                  className="p-1.5 rounded-lg hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
