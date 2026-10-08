'use client';
// src/app/(dashboard)/dashboard/page.tsx
// KIRA Agency Manager — Real Operational Dashboard (Phase 4).
// Connected directly to live repository data via /api/dashboard/overview.

import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { AttentionBanner } from '@/components/dashboard/AttentionBanner';
import { KpiCardsSection } from '@/components/dashboard/KpiCardsSection';
import { UpcomingScheduleSection } from '@/components/dashboard/UpcomingScheduleSection';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ContentFeed } from '@/components/dashboard/content-feed';
import { ScrollReveal } from '@/components/motion';

export default function DashboardPage() {
  const { user } = useAuth();
  const { teamMember } = usePermission();
  const { data, loading, error, refresh } = useDashboardData();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const agencyName = data?.agencySettings?.agencyName || 'KIRA Agency';
  const userName = teamMember?.name || user?.displayName?.split(' ')[0] || 'Member';

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    const isServerConfig = error.includes('Server configuration error') || error.includes('Firebase Admin SDK');
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">
            {isServerConfig ? 'Server Configuration Required' : 'Unable to Load Dashboard'}
          </h2>
          <p className="text-sm text-[rgb(var(--text-muted))] mb-4 leading-relaxed">
            {error}
          </p>
          {isServerConfig && (
            <p className="text-xs text-[rgb(var(--text-muted))] mb-6 leading-relaxed">
              Add your Firebase service account credentials to your hosting provider&apos;s environment variables, then redeploy.
            </p>
          )}
          <Button variant="primary" onClick={() => refresh()} className="w-full">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 2. Welcome Banner */}
      <div className="card p-4 sm:p-6 bg-gradient-to-r from-[rgb(var(--card-bg))] to-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--primary))]">
            KIRA Agency Manager
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight">
          {getGreeting()}, {userName}
        </h2>
        <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1 max-w-2xl">
          Here is what is happening across {agencyName} today. All statistics and content are synced directly with your live cloud storage.
        </p>
      </div>

      {/* 3. Real KPI Cards: Connected Accounts, Active Content, Scheduled Posts, Pending Tasks */}
      <ScrollReveal delay={40}>
        {data?.metrics ? (
          <KpiCardsSection metrics={data.metrics} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 sm:p-6 h-28 sm:h-36 animate-pulse bg-[rgb(var(--bg-surface))]" />
            ))}
          </div>
        )}
      </ScrollReveal>

      {/* 4. Attention Banner (Only surfaces if real failed publications or connection errors exist) */}
      {data?.attentionItems && data.attentionItems.length > 0 && (
        <ScrollReveal delay={60}>
          <AttentionBanner items={data.attentionItems} />
        </ScrollReveal>
      )}

      {/* 5. Quick Actions: New Content, Connect Account, Add Task, Editorial Calendar */}
      <ScrollReveal delay={80}>
        <QuickActionsBar />
      </ScrollReveal>

      {/* 6. Upcoming Editorial Schedule */}
      {data?.upcomingPublications && data.upcomingPublications.length > 0 && (
        <ScrollReveal delay={100}>
          <UpcomingScheduleSection
            items={data.upcomingPublications}
            timezone={data.agencySettings?.timezone}
          />
        </ScrollReveal>
      )}

      {/* 7. Content Feed Add-On */}
      <ScrollReveal delay={120}>
        <ContentFeed />
      </ScrollReveal>
    </div>
  );
}
