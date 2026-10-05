'use client';
// src/components/dashboard/StorageDiagnostic.tsx
import type { StorageCheckResult as SCR } from '@/lib/types';
// Developer diagnostic panel — tests real GCS connectivity.
// Shows write/read/delete test results, not fake status.

import { useStorageHealth } from '@/hooks/useStorageHealth';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { StorageCheckStatus } from '@/lib/types';
import { RefreshCw, Database } from 'lucide-react';

const statusLabel: Record<StorageCheckStatus, string> = {
  idle:     'Not tested',
  checking: 'Testing…',
  ok:       'Passed',
  error:    'Failed',
};

const statusDotClass: Record<StorageCheckStatus, string> = {
  idle:     'status-dot status-dot-idle',
  checking: 'status-dot status-dot-idle status-dot-pulse',
  ok:       'status-dot status-dot-ok',
  error:    'status-dot status-dot-error',
};

const statusTextClass: Record<StorageCheckStatus, string> = {
  idle:     'text-[rgb(var(--text-muted))]',
  checking: 'text-[rgb(var(--text-muted))]',
  ok:       'text-green-600 dark:text-green-400',
  error:    'text-red-600 dark:text-red-400',
};

interface CheckRowProps {
  label: string;
  status: StorageCheckStatus;
}

function CheckRow({ label, status }: CheckRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgb(var(--border))] last:border-0">
      <span className="text-sm text-[rgb(var(--text-secondary))]">{label}</span>
      <div className="flex items-center gap-2">
        <div className={statusDotClass[status]} />
        <span className={`text-xs font-medium ${statusTextClass[status]}`}>
          {statusLabel[status]}
        </span>
      </div>
    </div>
  );
}

export function StorageDiagnostic() {
  const { result, state, error, runCheck } = useStorageHealth();

  const checks: { label: string; key: Exclude<keyof SCR, 'error'> }[] = [
    { label: 'Storage Connection',       key: 'connection' },
    { label: 'Drive / Container Access', key: 'bucketAccess' },
    { label: 'Write Test',               key: 'writeTest' },
    { label: 'Read Test',                key: 'readTest' },
    { label: 'Delete / Cleanup',         key: 'deleteTest' },
  ];

  const getStatus = (key: Exclude<keyof SCR, 'error'>): StorageCheckStatus => {
    if (state === 'idle')     return 'idle';
    if (state === 'checking') return 'checking';
    return (result?.[key] as StorageCheckStatus | undefined) ?? 'idle';
  };

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-violet-600" />
          <CardTitle>Google Cloud Storage</CardTitle>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw size={13} className={state === 'checking' ? 'animate-spin' : ''} />}
          loading={state === 'checking'}
          onClick={runCheck}
        >
          {state === 'idle' ? 'Run Test' : 'Retest'}
        </Button>
      </CardHeader>

      <div className="px-4 pb-1 mt-3">
        {checks.map(({ label, key }) => (
          <CheckRow key={key} label={label} status={getStatus(key)} />
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-4 mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {state === 'done' && !error && (
        <p className="text-xs text-[rgb(var(--text-muted))] px-4 pb-4 mt-1">
          Test object was written and deleted. No permanent files created.
        </p>
      )}
    </Card>
  );
}
