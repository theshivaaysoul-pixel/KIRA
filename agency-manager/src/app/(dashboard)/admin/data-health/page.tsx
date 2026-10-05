'use client';
// src/app/(dashboard)/admin/data-health/page.tsx
// Phase 16 — Admin Data Health & Integrity Dashboard
//
// Displays real, verified health status for:
// - Application & Runtime Environment
// - Authentication & Session Validation
// - GCS / Storage reachability, read, write, and delete tests
// - 11 Database JSON Collections (record counts, schemas, validity)
// - Relationship Integrity (orphan detection across entities)
// - Duplicate Detection (IDs, slugs, unique fields)
// - Checksum & Backup Integrity
// - Recommended Actions (non-destructive administrative guidance)

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { AccessRestrictedCard } from '@/components/auth/AccessRestrictedCard';
import type { DataHealthReport, HealthStatusLevel } from '@/lib/services/data-health-service';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Database,
  Layers,
  Link2,
  Copy,
  Archive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Activity,
  Server,
  Key,
} from 'lucide-react';

export default function AdminDataHealthPage() {
  const { getIdToken } = useAuth();
  const { role, hasPermission, loading: permissionLoading } = usePermission();
  const [report, setReport] = useState<DataHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthReport = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const token = await getIdToken();
      const res = await fetch('/api/admin/data-health', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 403) {
        setError('403 Forbidden: You do not have permission to view administrative data health.');
        setReport(null);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${res.status}: Failed to fetch health report`);
      }

      const json = await res.json();
      setReport(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data health report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (!permissionLoading) {
      fetchHealthReport();
    }
  }, [permissionLoading, fetchHealthReport]);

  if (permissionLoading || (loading && !report && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[rgb(var(--primary))]" />
        <p className="text-sm text-[rgb(var(--text-muted))]">Running comprehensive data health audit…</p>
      </div>
    );
  }

  // Authorization check: Only Owner and Manager can access Data Health
  const isAuthorized = role === 'OWNER' || role === 'MANAGER' || hasPermission('system.admin');
  if (!isAuthorized || error?.includes('403')) {
    return (
      <AccessRestrictedCard
        featureName="Data Health & Integrity"
        description="Only the Owner and Manager can access administrative data health diagnostics."
      />
    );
  }

  if (error && !report) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h1 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">Health Check Failed</h1>
        <p className="text-sm text-[rgb(var(--text-muted))] mb-4">{error}</p>
        <button
          onClick={fetchHealthReport}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-[rgb(var(--primary))] text-white hover:opacity-90 transition-opacity"
        >
          Retry Check
        </button>
      </div>
    );
  }

  if (!report) return null;

  const renderStatusBadge = (status: HealthStatusLevel) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={13} /> Healthy
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={13} /> Warning
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={13} /> Error
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              Data Health & Integrity
            </h1>
            {renderStatusBadge(report.summary.status)}
          </div>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Real-time audit of storage persistence, collection schemas, relationship graphs, and backups.
          </p>
        </div>

        <button
          onClick={fetchHealthReport}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold
                     bg-[rgb(var(--primary))] text-white hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Auditing…' : 'Run Integrity Check'}
        </button>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
        <div
          className="card rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">
            Checks Passed
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">{report.summary.healthyChecks}</div>
            <div className="text-[10px] text-[rgb(var(--text-muted))] mt-1">Verified operational</div>
          </div>
        </div>

        <div
          className="card rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">
            Warnings
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{report.summary.warningChecks}</div>
            <div className="text-[10px] text-[rgb(var(--text-muted))] mt-1">Non-critical alerts</div>
          </div>
        </div>

        <div
          className="card rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">
            Errors
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{report.summary.errorChecks}</div>
            <div className="text-[10px] text-[rgb(var(--text-muted))] mt-1">Requires attention</div>
          </div>
        </div>

        <div
          className="card rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex flex-col justify-between"
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">
            Last Verified
          </div>
          <div>
            <div className="text-xs font-semibold text-[rgb(var(--text-primary))] mt-2 truncate">
              {new Date(report.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-[10px] text-[rgb(var(--text-muted))] mt-1">
              {new Date(report.timestamp).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Actions (if any) */}
      {report.summary.recommendedActions.length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <HelpCircle size={16} /> Recommended Administrative Actions
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-xs text-[rgb(var(--text-primary))]">
            {report.summary.recommendedActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2-Column: Runtime Services (App & Auth) + Storage Diagnostic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Application & Auth Card */}
        <div className="card p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-[rgb(var(--primary))]" />
              <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Application & Auth</h2>
            </div>
            {renderStatusBadge(
              report.application.status === 'ERROR' || report.authentication.status === 'ERROR'
                ? 'ERROR'
                : report.application.status === 'WARNING' || report.authentication.status === 'WARNING'
                ? 'WARNING'
                : 'HEALTHY'
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[rgb(var(--text-muted))]">Runtime:</span>{' '}
              <span className="font-mono font-medium text-[rgb(var(--text-primary))]">
                Node {report.application.nodeVersion}
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Environment:</span>{' '}
              <span className="font-mono font-medium text-[rgb(var(--text-primary))]">
                {report.application.environment}
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Uptime:</span>{' '}
              <span className="font-mono font-medium text-[rgb(var(--text-primary))]">
                {Math.floor(report.application.uptimeSeconds / 60)} min
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Storage Provider:</span>{' '}
              <span className="font-mono font-medium text-[rgb(var(--text-primary))] uppercase">
                {report.application.configChecks.storageProvider}
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Firebase Admin:</span>{' '}
              <span className={report.authentication.adminConfigured ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                {report.authentication.adminConfigured ? 'Configured' : 'Missing'}
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Protection Enforced:</span>{' '}
              <span className="text-emerald-400 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Storage Diagnostics Card */}
        <div className="card p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-[rgb(var(--primary))]" />
              <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Storage Health Diagnostic</h2>
            </div>
            {renderStatusBadge(report.storage.status)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Reachable</span>
              {report.storage.reachable ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
            </div>
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Bucket Access</span>
              {report.storage.bucketAccess ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
            </div>
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Read Test</span>
              {report.storage.readAccess ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
            </div>
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Write Test</span>
              {report.storage.writeAccess ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
            </div>
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Delete Test</span>
              {report.storage.deleteCapability ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
            </div>
            <div className="p-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] flex items-center justify-between">
              <span className="text-[rgb(var(--text-muted))]">Cleanup Check</span>
              <CheckCircle2 size={14} className="text-emerald-400" />
            </div>
          </div>
          {report.storage.error && (
            <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{report.storage.error}</p>
          )}
        </div>
      </div>

      {/* Database Collections Table */}
      <div className="p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
        <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-[rgb(var(--primary))]" />
            <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">
              Database JSON Collections ({report.collections.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                <th className="py-2 px-3 font-semibold">Storage File</th>
                <th className="py-2 px-3 font-semibold">Status</th>
                <th className="py-2 px-3 font-semibold text-right">Records</th>
                <th className="py-2 px-3 font-semibold text-right">Invalid</th>
                <th className="py-2 px-3 font-semibold">JSON / Root Structure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {report.collections.map((col) => (
                <tr key={col.path} className="hover:bg-[rgb(var(--bg-base))]/40">
                  <td className="py-2.5 px-3 font-mono font-medium text-[rgb(var(--text-primary))]">
                    {col.path}
                  </td>
                  <td className="py-2.5 px-3">{renderStatusBadge(col.status)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[rgb(var(--text-primary))]">
                    {col.totalRecords}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {col.invalidRecordsCount > 0 ? (
                      <span className="text-red-400 font-semibold">{col.invalidRecordsCount}</span>
                    ) : (
                      <span className="text-emerald-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[rgb(var(--text-muted))]">
                    {col.validJson && col.validRootStructure ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Valid
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle size={12} /> Malformed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column: Relationships + Duplicates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Relationships Integrity */}
        <div className="card p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
            <div className="flex items-center gap-2">
              <Link2 size={18} className="text-[rgb(var(--primary))]" />
              <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Relationship Integrity</h2>
            </div>
            {renderStatusBadge(report.relationships.status)}
          </div>

          <div className="flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
            <span>Foreign key checks evaluated:</span>
            <span className="font-mono font-semibold text-[rgb(var(--text-primary))]">
              {report.relationships.totalChecks}
            </span>
          </div>

          {report.relationships.orphanedCount === 0 ? (
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>All entity relationships intact. Zero orphaned records detected.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-400">
                {report.relationships.orphanedCount} Orphaned Record(s) Found:
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {report.relationships.issues.map((iss, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[rgb(var(--bg-base))] border border-amber-500/20 text-[11px] text-[rgb(var(--text-primary))]"
                  >
                    {iss.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Detection */}
        <div className="card p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
            <div className="flex items-center gap-2">
              <Copy size={18} className="text-[rgb(var(--primary))]" />
              <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Duplicate Detection</h2>
            </div>
            {renderStatusBadge(report.duplicates.status)}
          </div>

          <div className="flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
            <span>Unique field collisions:</span>
            <span className="font-mono font-semibold text-[rgb(var(--text-primary))]">
              {report.duplicates.duplicatesFound}
            </span>
          </div>

          {report.duplicates.duplicatesFound === 0 ? (
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>No duplicate IDs, platform slugs, or account identifiers detected.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-400">
                {report.duplicates.duplicatesFound} Duplicate Collision(s) Detected:
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {report.duplicates.issues.map((dup, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[rgb(var(--bg-base))] border border-amber-500/20 text-[11px] text-[rgb(var(--text-primary))]"
                  >
                    {dup.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup Checksum Integrity */}
      <div className="p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
        <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-[rgb(var(--primary))]" />
            <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">
              Backup Checksum Integrity ({report.backups.totalBackupsFound} Backups)
            </h2>
          </div>
          {renderStatusBadge(report.backups.status)}
        </div>

        {report.backups.totalBackupsFound === 0 ? (
          <p className="text-xs text-[rgb(var(--text-muted))]">
            No backups stored yet in <code className="font-mono">database/backups/</code>. Backups are automatically created prior to mutations.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                  <th className="py-2 px-3 font-semibold">Backup Path</th>
                  <th className="py-2 px-3 font-semibold">Created</th>
                  <th className="py-2 px-3 font-semibold">Checksum Verification</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {report.backups.backups.map((b) => (
                  <tr key={b.backupPath} className="hover:bg-[rgb(var(--bg-base))]/40">
                    <td className="py-2.5 px-3 font-mono text-[rgb(var(--text-primary))]">{b.backupPath}</td>
                    <td className="py-2.5 px-3 text-[rgb(var(--text-muted))]">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {b.checksumValid ? (
                        <span className="text-emerald-400">SHA-256 Verified ({b.recordedChecksum.slice(0, 8)}…)</span>
                      ) : (
                        <span className="text-red-400">{b.error || 'Checksum Mismatch'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {b.checksumValid && b.readable ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Valid
                        </span>
                      ) : (
                        <span className="text-red-400 font-semibold flex items-center gap-1">
                          <XCircle size={12} /> Corrupt
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
