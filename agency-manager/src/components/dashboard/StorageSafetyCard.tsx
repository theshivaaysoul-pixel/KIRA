'use client';
// src/components/dashboard/StorageSafetyCard.tsx
// Admin Storage Safety & Recovery Diagnostic Panel for KIRA Agency Manager.
// Provides real backup execution, listing from storage, and confirmed recovery.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Archive,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { BackupMetadata } from '@/lib/storage/backup-types';

export function StorageSafetyCard() {
  const { getIdToken } = useAuth();
  const { success, error: toastError } = useToast();

  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string>('all');
  
  // Recovery confirmation modal state
  const [targetBackup, setTargetBackup] = useState<BackupMetadata | null>(null);
  const [recovering, setRecovering] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const url = new URL('/api/admin/storage/backups', window.location.origin);
      if (selectedResource !== 'all') {
        url.searchParams.set('resource', selectedResource);
      }
      url.searchParams.set('limit', '25');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBackups(json.data.backups || []);
        setTotal(json.data.total || 0);
      } else {
        toastError(json.error || 'Failed to fetch backups');
      }
    } catch {
      toastError('Network error loading backups');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, selectedResource, toastError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBackups();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchBackups]);

  async function handleBackupAll() {
    setBackingUp(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toastError('Authentication required');
        return;
      }

      const res = await fetch('/api/admin/storage/backup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (json.success) {
        success(`Backup completed: ${json.data.backedUp} collections backed up.`);
        await fetchBackups();
      } else {
        toastError(json.error || 'Backup operation failed');
      }
    } catch {
      toastError('Failed to run backup');
    } finally {
      setBackingUp(false);
    }
  }

  async function handleConfirmRecovery() {
    if (!targetBackup) return;
    setRecovering(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toastError('Authentication required');
        return;
      }

      const res = await fetch('/api/admin/storage/recover', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupPath: targetBackup.backupPath }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Recovery successful: Restored ${targetBackup.sourcePath}`);
        setTargetBackup(null);
        await fetchBackups();
      } else {
        toastError(json.error || 'Recovery failed');
      }
    } catch {
      toastError('Failed executing recovery');
    } finally {
      setRecovering(false);
    }
  }

  const lastBackup = backups.length > 0 ? backups[0] : null;

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Storage Data Safety & Recovery</CardTitle>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Automated versioning, deterministic SHA-256 integrity & rollback
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchBackups}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleBackupAll}
              disabled={backingUp}
              className="flex items-center gap-1.5"
            >
              <Archive size={13} className={backingUp ? 'animate-spin' : ''} />
              {backingUp ? 'Backing up…' : 'Backup Database'}
            </Button>
          </div>
        </CardHeader>

        <div className="p-5 flex flex-col gap-5">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[rgb(var(--bg-subtle))] rounded-xl border border-[rgb(var(--border))] text-xs">
            <div>
              <span className="text-[rgb(var(--text-muted))] block mb-0.5">Integrity Guard</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> Active & Verified
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))] block mb-0.5">Total Backups</span>
              <span className="font-semibold text-[rgb(var(--text-primary))]">{total}</span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))] block mb-0.5">Last Backup</span>
              <span className="font-semibold text-[rgb(var(--text-primary))]">
                {lastBackup ? new Date(lastBackup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None yet'}
              </span>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))] block mb-0.5">Safe Read-Back</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <FileCheck size={13} /> Enforced
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[rgb(var(--text-muted))] font-medium">Filter Resource:</span>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="text-xs bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded-lg px-2.5 py-1 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">All Resources</option>
                <option value="platforms">Platforms</option>
                <option value="social-accounts">Social Accounts</option>
                <option value="content">Content</option>
                <option value="team-members">Team Members</option>
                <option value="tasks">Tasks</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            <span className="text-xs text-[rgb(var(--text-muted))]">
              Showing {backups.length} of {total}
            </span>
          </div>

          {/* Backups List Table */}
          {backups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[rgb(var(--border))] rounded-xl">
              <Archive size={28} className="mx-auto text-[rgb(var(--text-muted))] mb-2 opacity-50" />
              <p className="text-xs font-medium text-[rgb(var(--text-secondary))]">No backups recorded yet</p>
              <p className="text-[11px] text-[rgb(var(--text-muted))] mt-0.5">
                Click &ldquo;Backup Database&rdquo; or update repository entities to generate safety snapshots.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[rgb(var(--border))] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Resource</th>
                    <th className="py-2.5 px-3 font-medium">Reason</th>
                    <th className="py-2.5 px-3 font-medium">SHA-256 Checksum</th>
                    <th className="py-2.5 px-3 font-medium">Size</th>
                    <th className="py-2.5 px-3 font-medium">Created</th>
                    <th className="py-2.5 px-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border))]">
                  {backups.map((bkp) => {
                    const resourceName = bkp.sourcePath.split('/').pop()?.replace('.json', '') || 'resource';
                    return (
                      <tr key={bkp.id} className="hover:bg-[rgb(var(--bg-subtle))]/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-[rgb(var(--text-primary))]">
                          {resourceName}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={bkp.reason === 'MANUAL_BACKUP' ? 'purple' : bkp.reason === 'BEFORE_DELETE' ? 'error' : 'default'}>
                            {bkp.reason}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-[rgb(var(--text-muted))]">
                          {bkp.checksum.slice(0, 12)}…
                        </td>
                        <td className="py-2.5 px-3 text-[rgb(var(--text-muted))]">
                          {(bkp.size / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3 text-[rgb(var(--text-muted))] whitespace-nowrap">
                          {new Date(bkp.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setTargetBackup(bkp)}
                            className="h-7 text-xs px-2 flex items-center gap-1 ml-auto"
                          >
                            <RotateCcw size={12} />
                            Restore
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Recovery Confirmation Dialog */}
      {targetBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[rgb(var(--bg-card))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle size={18} />
                <span>Confirm Database Recovery</span>
              </div>
              <button
                onClick={() => setTargetBackup(null)}
                className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
              Are you sure you want to restore this backup?
              <br />
              <strong className="text-[rgb(var(--text-primary))]">
                A safety snapshot of the current live database file will be created automatically
              </strong>{' '}
              before any data is replaced.
            </p>

            <div className="bg-[rgb(var(--bg-subtle))] p-3 rounded-xl border border-[rgb(var(--border))] text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-[rgb(var(--text-muted))]">Target File: </span>
                <span className="text-[rgb(var(--text-primary))]">{targetBackup.sourcePath}</span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))]">Backup Path: </span>
                <span className="text-[rgb(var(--text-primary))] truncate block">{targetBackup.backupPath}</span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))]">Checksum: </span>
                <span className="text-[rgb(var(--text-primary))]">{targetBackup.checksum.slice(0, 16)}…</span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))]">Created At: </span>
                <span className="text-[rgb(var(--text-primary))]">
                  {new Date(targetBackup.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTargetBackup(null)}
                disabled={recovering}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRecovery}
                loading={recovering}
                className="flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                Confirm Recovery
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
