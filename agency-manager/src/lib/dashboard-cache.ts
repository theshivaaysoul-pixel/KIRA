// src/lib/dashboard-cache.ts
// Per-tab cache so the dashboard paints instantly while fresh data loads in the background.

import type { DashboardOverviewData } from '@/lib/types/domain';

const CACHE_PREFIX = 'kira:dashboard:';

export function readDashboardCache(
  uid: string
): { data: DashboardOverviewData; savedAt: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + uid);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDashboardCache(uid: string, data: DashboardOverviewData) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + uid, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Storage full or unavailable; caching is best-effort
  }
}

export function clearDashboardCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
