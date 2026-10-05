'use client';
// src/components/dashboard/SystemStatusCard.tsx
// Shows live application, auth, and storage config status.

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import type { HealthStatus } from '@/lib/types';
import { Activity } from 'lucide-react';

export function SystemStatusCard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setHealth(json.data as HealthStatus);
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, []);

  function statusBadge(val: 'ok' | 'error' | 'unconfigured' | undefined) {
    if (fetching) return <Badge variant="default">Checking…</Badge>;
    if (val === 'ok') return <Badge variant="success">Configured</Badge>;
    if (val === 'error') return <Badge variant="error">Error</Badge>;
    return <Badge variant="warning">Not configured</Badge>;
  }

  const rows = [
    { label: 'Application',                value: fetching ? undefined : 'ok' as const },
    { label: 'Firebase Auth (server)',      value: health?.auth },
    { label: 'Google Cloud Storage',        value: health?.storage },
    { label: 'Signed in as',               value: user ? 'ok' as const : 'unconfigured' as const,
      display: user ? user.email ?? 'Unknown' : 'Not signed in' },
  ];

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-violet-600" />
          <CardTitle>System Status</CardTitle>
        </div>
        {health && (
          <span className="text-[10px] text-[rgb(var(--text-muted))]">
            {new Date(health.timestamp).toLocaleTimeString()}
          </span>
        )}
      </CardHeader>

      <div className="px-4 pb-4 mt-3 flex flex-col gap-0">
        {rows.map(({ label, value, display }) => (
          <div
            key={label}
            className="flex items-center justify-between py-2.5 border-b border-[rgb(var(--border))] last:border-0"
          >
            <span className="text-sm text-[rgb(var(--text-secondary))]">{label}</span>
            {display ? (
              <span className="text-xs text-[rgb(var(--text-muted))] font-mono max-w-[160px] truncate">
                {display}
              </span>
            ) : (
              statusBadge(value)
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
