'use client';
// src/app/(dashboard)/analytics/page.tsx
// Phase 11 — Real Analytics Dashboard
// Shows ONLY data that exists in the database. No fabricated metrics.

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Users,
  RefreshCw,
  AlertCircle,
  Info,
  ChevronDown,
  Filter,
  Calendar,
} from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { AccountAnalyticsSummary, SnapshotWithRelations } from '@/lib/services/analytics-service';

// ─── Date Range Presets ──────────────────────────────────────────────────────

type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

function getDateRange(preset: DateRangePreset, custom?: { from: string; to: string }) {
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'custom' && custom) return custom;
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  unavailable,
}: {
  label: string;
  value?: number;
  icon: React.FC<{ size?: number; className?: string }>;
  unavailable?: boolean;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      {unavailable || value === undefined ? (
        <span className="text-sm text-[rgb(var(--text-muted))] italic">Not available</span>
      ) : (
        <span className="text-2xl font-bold text-[rgb(var(--text-primary))]">
          {label === 'Engagement Rate'
            ? `${value.toFixed(2)}%`
            : value >= 1_000_000
            ? `${(value / 1_000_000).toFixed(1)}M`
            : value >= 1_000
            ? `${(value / 1_000).toFixed(1)}K`
            : value.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ─── Empty / Unavailable State ────────────────────────────────────────────────

function UnavailableState({ reason }: { reason?: string }) {
  return (
    <div className="card p-8 flex flex-col items-center gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--bg-subtle))] flex items-center justify-center">
        <BarChart2 size={22} className="text-[rgb(var(--text-muted))]" />
      </div>
      <p className="text-sm font-medium text-[rgb(var(--text-secondary))]">Analytics unavailable</p>
      <p className="text-xs text-[rgb(var(--text-muted))] max-w-sm">
        {reason || 'No analytics snapshots recorded. Connect a supported analytics provider or record snapshots manually to see data here.'}
      </p>
    </div>
  );
}

// ─── Account Summary Card ─────────────────────────────────────────────────────

function AccountSummaryCard({ summary }: { summary: AccountAnalyticsSummary }) {
  const { account, snapshotCount, latestSnapshot, averages, dataAvailability, unavailableReason } = summary;
  const isReal = dataAvailability === 'real';

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">{account.accountName}</p>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            @{account.username}
            {account.platformName ? ` · ${account.platformName}` : ''}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            isReal
              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
              : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] border border-[rgb(var(--border))]'
          }`}
        >
          {isReal ? `${snapshotCount} snapshot${snapshotCount !== 1 ? 's' : ''}` : 'No data'}
        </span>
      </div>

      {/* Metrics or unavailable state */}
      {isReal ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
          <MetricCard label="Followers" value={averages.followers} icon={Users} />
          <MetricCard label="Views" value={averages.views} icon={Eye} />
          <MetricCard label="Likes" value={averages.likes} icon={Heart} />
          <MetricCard label="Comments" value={averages.comments} icon={MessageCircle} />
          <MetricCard label="Shares" value={averages.shares} icon={Share2} />
          <MetricCard label="Saves" value={averages.saves} icon={Bookmark} />
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--text-muted))] italic">
          {unavailableReason || 'No analytics data available.'}
        </p>
      )}

      {/* Last recorded */}
      {latestSnapshot && (
        <p className="text-[10px] text-[rgb(var(--text-muted))]">
          Last recorded: {new Date(latestSnapshot.recordedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Snapshot Row ─────────────────────────────────────────────────────────────

function SnapshotRow({ snapshot }: { snapshot: SnapshotWithRelations }) {
  return (
    <tr className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))] transition-colors">
      <td className="py-3 px-4">
        <p className="text-xs font-mono text-[rgb(var(--text-muted))]">{snapshot.id}</p>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
          {snapshot.account?.accountName ?? snapshot.socialAccountId}
        </p>
        <p className="text-xs text-[rgb(var(--text-muted))]">
          {snapshot.account?.platformName ?? ''}
        </p>
      </td>
      <td className="py-3 px-4 text-sm text-[rgb(var(--text-secondary))]">
        {new Date(snapshot.recordedAt).toLocaleDateString()}
      </td>
      <td className="py-3 px-4 text-sm text-right text-[rgb(var(--text-secondary))]">
        {snapshot.followers?.toLocaleString() ?? <span className="text-[rgb(var(--text-muted))] text-xs italic">—</span>}
      </td>
      <td className="py-3 px-4 text-sm text-right text-[rgb(var(--text-secondary))]">
        {snapshot.views?.toLocaleString() ?? <span className="text-[rgb(var(--text-muted))] text-xs italic">—</span>}
      </td>
      <td className="py-3 px-4 text-sm text-right text-[rgb(var(--text-secondary))]">
        {snapshot.derivedEngagementRate !== undefined
          ? `${snapshot.derivedEngagementRate.toFixed(2)}%`
          : <span className="text-[rgb(var(--text-muted))] text-xs italic">—</span>}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { snapshots, loading, error, fetchSnapshots, fetchAccountSummary, refreshAll } = useAnalytics();
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [accountSummaries, setAccountSummaries] = useState<AccountAnalyticsSummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'snapshots'>('overview');

  const dateRange = getDateRange(preset);

  // Load all account summaries
  const loadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    try {
      // Fetch accounts list from accounts API, then get per-account summaries
      const res = await fetch('/api/social-accounts?limit=100');
      if (!res.ok) { setSummariesLoading(false); return; }
      const json = await res.json();
      const accounts: { id: string }[] = json.data?.items ?? [];

      const summaries = await Promise.all(
        accounts.map((acc) => fetchAccountSummary(acc.id, dateRange.from, dateRange.to))
      );
      setAccountSummaries(summaries.filter((s): s is AccountAnalyticsSummary => s !== null));
    } catch {
      // non-fatal
    } finally {
      setSummariesLoading(false);
    }
  }, [fetchAccountSummary, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchSnapshots({ from: dateRange.from, to: dateRange.to, limit: 50 });
    loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const realSummaries = accountSummaries.filter((s) => s.dataAvailability === 'real');
  const unavailableSummaries = accountSummaries.filter((s) => s.dataAvailability !== 'real');

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[rgb(var(--text-primary))] flex items-center gap-2">
            <BarChart2 size={20} />
            Analytics
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Real analytics from stored snapshots only. No fabricated data.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 bg-[rgb(var(--bg-subtle))] rounded-full p-1.5 border border-[rgb(var(--border))]">
            {(['7d', '30d', '90d'] as DateRangePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors min-h-[38px] ${
                  preset === p
                    ? 'bg-[rgb(var(--accent))] text-white shadow-xs'
                    : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                }`}
              >
                {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <button
            onClick={refreshAll}
            className="w-11 h-11 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] flex items-center justify-center hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors disabled:opacity-50 shrink-0"
            disabled={loading}
            aria-label="Refresh analytics"
            title="Refresh analytics"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Real data notice */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-400 text-xs">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          Analytics are sourced exclusively from persisted{' '}
          <code className="font-mono">AnalyticsSnapshot</code> records (database/analytics.json).
          Metrics show{' '}
          <strong>Not available</strong> when data is absent — never estimated values.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 sm:gap-6 border-b border-[rgb(var(--border))]">
        {(['overview', 'snapshots'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-[rgb(var(--accent))] text-[rgb(var(--accent))]'
                : 'border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
            }`}
          >
            {t === 'overview' ? 'Account Overview' : 'All Snapshots'}
          </button>
        ))}
      </div>

      {/* Tab: Account Overview */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-8">
          {summariesLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={18} className="animate-spin text-[rgb(var(--text-muted))]" />
            </div>
          ) : accountSummaries.length === 0 ? (
            <UnavailableState reason="No social accounts found. Add accounts in the Accounts section to see analytics." />
          ) : (
            <>
              {/* Accounts with real data */}
              {realSummaries.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[rgb(var(--text-secondary))] mb-3">
                    Accounts with data ({realSummaries.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {realSummaries.map((s) => (
                      <AccountSummaryCard key={s.account.id} summary={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* Accounts without data */}
              {unavailableSummaries.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[rgb(var(--text-muted))] mb-3">
                    Accounts without analytics ({unavailableSummaries.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {unavailableSummaries.map((s) => (
                      <div key={s.account.id} className="card p-4 flex items-center justify-between opacity-70">
                        <div>
                          <p className="text-sm font-medium text-[rgb(var(--text-primary))]">{s.account.accountName}</p>
                          <p className="text-xs text-[rgb(var(--text-muted))]">
                            @{s.account.username}
                            {s.account.platformName ? ` · ${s.account.platformName}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-[rgb(var(--text-muted))] italic">No data</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {realSummaries.length === 0 && (
                <UnavailableState reason="No analytics snapshots exist yet. Record snapshots to track account performance." />
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: All Snapshots */}
      {tab === 'snapshots' && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={18} className="animate-spin text-[rgb(var(--text-muted))]" />
            </div>
          ) : !snapshots || snapshots.items.length === 0 ? (
            <div className="p-8">
              <UnavailableState reason="No analytics snapshots found for this date range. Snapshots must be recorded through the API or an analytics provider." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]">
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">ID</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Account</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Recorded</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Followers</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Views</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.items.map((s) => (
                    <SnapshotRow key={s.id} snapshot={s} />
                  ))}
                </tbody>
              </table>
              <div className="p-4 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
                <span>{snapshots.total} total snapshot{snapshots.total !== 1 ? 's' : ''}</span>
                <span>Page {snapshots.page} of {snapshots.totalPages}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
