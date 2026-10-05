'use client';
// src/components/dashboard/DashboardSkeleton.tsx
// Subtle skeleton shimmer loading state for the dashboard.

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgb(var(--border))]" />
          <div className="space-y-2">
            <div className="w-40 h-5 rounded bg-[rgb(var(--border))]" />
            <div className="w-24 h-3 rounded bg-[rgb(var(--border))]" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgb(var(--border))]" />
          <div className="w-20 h-8 rounded bg-[rgb(var(--border))]" />
        </div>
      </div>

      {/* Banner skeleton */}
      <div className="card p-5 h-28 bg-[rgb(var(--bg-subtle))]" />

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 h-28 bg-[rgb(var(--bg-subtle))]" />
        ))}
      </div>

      {/* Content & Tasks grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="card p-5 h-64 bg-[rgb(var(--bg-subtle))]" />
        <div className="card p-5 h-64 bg-[rgb(var(--bg-subtle))]" />
      </div>

      {/* Schedule & Activity skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="card p-5 h-64 bg-[rgb(var(--bg-subtle))]" />
        <div className="card p-5 h-64 bg-[rgb(var(--bg-subtle))]" />
      </div>
    </div>
  );
}
