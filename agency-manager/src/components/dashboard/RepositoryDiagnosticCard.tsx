'use client';
// src/components/dashboard/RepositoryDiagnosticCard.tsx
// Phase 1 Developer diagnostic card for repository layer, domain models, and persistence.

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, XCircle, RefreshCw, Layers } from 'lucide-react';
import type { RepositoryDiagnosticResult } from '@/lib/services/diagnostic-test-service';

export function RepositoryDiagnosticCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RepositoryDiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunTest() {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/diagnostic/repository', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success && data.data) {
        setResult(data.data);
      } else {
        setError(data.error || 'Diagnostic test failed');
        if (data.data) setResult(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error running diagnostic');
    } finally {
      setRunning(false);
    }
  }

  const checks = [
    { label: 'Platform Persistence (Create)', passed: result?.platformCreate },
    { label: 'Read & Structure Verification',  passed: result?.platformRead },
    { label: 'Entity Update & Timestamp',      passed: result?.platformUpdate },
    { label: 'Duplicate Slug Rejection',       passed: result?.duplicateRejection },
    { label: 'Zod Schema Validation',          passed: result?.invalidDataRejection },
    { label: 'Cross-Entity Relationships',     passed: result?.relationshipValidation },
    { label: 'Safe Cleanup & Deletion',        passed: result?.cleanupVerified },
    { label: 'AgencySettings Singleton',       passed: result?.settingsCheck },
  ];

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Layers size={18} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Repository & Persistence</CardTitle>
              <p className="text-xs text-[rgb(var(--text-muted))]">Domain models & storage-backed JSON</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRunTest}
            disabled={running}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
            {running ? 'Testing…' : 'Run Tests'}
          </Button>
        </CardHeader>

        <div className="p-4 pt-1 space-y-2.5">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between py-1.5 border-b border-[rgb(var(--border))] last:border-0"
            >
              <span className="text-xs text-[rgb(var(--text-secondary))] font-medium">
                {check.label}
              </span>
              <div className="flex items-center gap-1.5">
                {check.passed === undefined ? (
                  <span className="text-xs text-[rgb(var(--text-muted))]">Not run</span>
                ) : check.passed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Passed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <XCircle size={14} /> Failed
                  </span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="p-2.5 mt-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {result?.allPassed && (
            <div className="p-2.5 mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 size={16} /> All 8 repository integrity tests passed!
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
