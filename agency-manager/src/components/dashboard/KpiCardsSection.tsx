'use client';
// src/components/dashboard/KpiCardsSection.tsx
// Displays real operational KPI metrics computed server-side from live repositories.
// Each KPI card and metric chip functions as an interactive button linking to its operational section.

import { useRouter } from 'next/navigation';
import {
  Users,
  Image,
  Calendar,
  Target,
  Sparkles,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import type { DashboardMetrics } from '@/lib/types/domain';
import { SpotlightCard } from '@/components/motion';

interface KpiCardsSectionProps {
  metrics: DashboardMetrics;
}

export function KpiCardsSection({ metrics }: KpiCardsSectionProps) {
  const router = useRouter();

  const dailyProgress = metrics.dailyTargetsProgress;
  const hasDailyTargets = !!dailyProgress && dailyProgress.hasTarget;

  const cards = [
    {
      label: 'Connected Accounts',
      value: metrics.activeAccounts,
      desc: 'Active social handles',
      icon: Users,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
      href: '/accounts',
    },
    {
      label: 'Active Content',
      value: metrics.activeContent,
      desc: 'Posts, reels & media',
      icon: Image,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      href: '/content',
    },
    {
      label: 'Scheduled Posts',
      value: metrics.scheduledPublications,
      desc: 'Queued for publishing',
      icon: Calendar,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      href: '/calendar',
    },
    {
      label: "Today's Content Progress",
      value: hasDailyTargets
        ? `${dailyProgress.totalCompleted} / ${dailyProgress.totalTarget}`
        : 'No Targets',
      desc: hasDailyTargets
        ? `${dailyProgress.overallPercentage}% completed today`
        : 'No targets configured',
      icon: Target,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      href: '/tasks',
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
      {/* 4 Primary KPI Cards as Interactive Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <SpotlightCard key={card.label} className="rounded-2xl h-full">
              <button
                type="button"
                onClick={() => router.push(card.href)}
                className="card p-3.5 sm:p-6 lg:p-7 flex flex-col justify-between text-left transition-all duration-200 
                           hover:border-[rgb(var(--primary))]/40 hover:-translate-y-0.5 hover:shadow-lg 
                           cursor-pointer group relative overflow-hidden border border-[rgb(var(--border))] min-h-[120px] sm:min-h-[148px] w-full h-full"
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3 w-full">
                  <span className="text-[11px] sm:text-xs font-semibold text-[rgb(var(--text-secondary))] group-hover:text-[rgb(var(--primary))] transition-colors truncate">
                    {card.label}
                  </span>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl ${card.bgColor} ${card.color} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110`}
                    >
                      <Icon size={14} className="sm:hidden" />
                      <Icon size={16} className="hidden sm:block" />
                    </div>
                    <ArrowUpRight
                      size={14}
                      className="text-[rgb(var(--text-muted))] opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all hidden sm:block"
                    />
                  </div>
                </div>
                <div className="w-full">
                  <div className="text-xl sm:text-3xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight font-mono group-hover:text-[rgb(var(--primary))] transition-colors">
                    {card.value}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[rgb(var(--text-muted))] mt-0.5 sm:mt-1 truncate">
                    {card.desc}
                  </p>
                </div>
              </button>
            </SpotlightCard>
          );
        })}
      </div>

      {/* Secondary Metrics Bar with Interactive Buttons */}
      <div className="card p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <button
          type="button"
          onClick={() => router.push('/analytics')}
          className="flex items-center gap-2 text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--primary))] transition-colors cursor-pointer group"
        >
          <Sparkles size={14} className="text-[rgb(var(--primary))]" />
          <span>Lifetime Published:</span>
          <span className="font-bold text-[rgb(var(--text-primary))] group-hover:text-[rgb(var(--primary))] font-mono underline-offset-4 group-hover:underline">
            {metrics.publishedContent} posts
          </span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/team')}
          className="flex items-center gap-2 text-[rgb(var(--text-secondary))] hover:text-emerald-500 transition-colors cursor-pointer group"
        >
          <UserCheck size={14} className="text-emerald-500" />
          <span>Active Team:</span>
          <span className="font-bold text-[rgb(var(--text-primary))] group-hover:text-emerald-500 font-mono underline-offset-4 group-hover:underline">
            {metrics.totalTeamMembers} members
          </span>
        </button>

        <button
          type="button"
          onClick={() => router.push(metrics.failedPublications > 0 ? '/activity' : '/calendar')}
          className="flex items-center gap-2 text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors cursor-pointer group"
        >
          {metrics.failedPublications > 0 ? (
            <AlertTriangle size={14} className="text-red-500" />
          ) : null}
          <span>Failed Queue:</span>
          <span
            className={`font-bold font-mono underline-offset-4 group-hover:underline ${
              metrics.failedPublications > 0 ? 'text-red-500' : 'text-emerald-500'
            }`}
          >
            {metrics.failedPublications}
          </span>
        </button>
      </div>
    </div>
  );
}
