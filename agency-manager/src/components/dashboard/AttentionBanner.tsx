'use client';
// src/components/dashboard/AttentionBanner.tsx
// Surfaces real failure events (e.g. FAILED publications, CONNECTION_ERROR accounts).
// Only displays if real attention items exist in the repository.

import { AlertTriangle, AlertCircle } from 'lucide-react';
import type { DashboardAttentionItem } from '@/lib/types/domain';

interface AttentionBannerProps {
  items: DashboardAttentionItem[];
}

export function AttentionBanner({ items }: AttentionBannerProps) {
  if (!items || items.length === 0) return null;

  const errorCount = items.filter((i) => i.severity === 'ERROR').length;
  const warningCount = items.filter((i) => i.severity === 'WARNING').length;

  return (
    <div className="card p-4 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-[rgb(var(--text-primary))]">
              Attention Required
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {items.length} issue{items.length > 1 ? 's' : ''} (
              {errorCount > 0 ? `${errorCount} critical` : ''}
              {errorCount > 0 && warningCount > 0 ? ', ' : ''}
              {warningCount > 0 ? `${warningCount} warnings` : ''})
            </span>
          </div>
          <p className="text-xs text-[rgb(var(--text-secondary))] mb-3">
            Real operational issues detected in connected platforms or publication queue:
          </p>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.type}-${item.entityId}-${index}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.severity === 'ERROR' ? (
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold text-[rgb(var(--text-primary))]">
                      {item.title}
                    </span>
                    <span className="text-[rgb(var(--text-muted))] mx-1.5">·</span>
                    <span className="text-[rgb(var(--text-secondary))] truncate">
                      {item.description}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[rgb(var(--text-muted))] shrink-0">
                  {item.entityId}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
