'use client';
// src/components/team/TeamStatsCards.tsx
// Key statistical metrics overview for agency team members.

import React from 'react';
import { Users, UserCheck, Mail, UserX, Crown, Shield } from 'lucide-react';
import type { TeamStats } from '@/lib/services/team-service';

interface TeamStatsCardsProps {
  stats: TeamStats;
  loading: boolean;
}

export function TeamStatsCards({ stats, loading }: TeamStatsCardsProps) {
  const cards = [
    {
      title: 'Total Members',
      value: stats.total,
      icon: Users,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      subtitle: `${stats.roleCounts.OWNER + stats.roleCounts.ADMIN} Admins/Owners`,
    },
    {
      title: 'Active Members',
      value: stats.active,
      icon: UserCheck,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      subtitle: 'Full system access',
    },
    {
      title: 'Pending Invites',
      value: stats.invited,
      icon: Mail,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      subtitle: 'Awaiting onboarding',
    },
    {
      title: 'Suspended / Inactive',
      value: stats.suspended + stats.inactive,
      icon: UserX,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      subtitle: 'Revoked access',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="card p-6 sm:p-7 rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-xs relative overflow-hidden transition-all hover:border-[rgb(var(--border-strong))] flex flex-col justify-between"
            style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))] leading-snug">
                {card.title}
              </span>
              <div className={`p-2.5 rounded-xl border shrink-0 ${card.color}`}>
                <Icon size={18} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[rgb(var(--text-primary))] tracking-tight">
                {loading ? '—' : card.value}
              </div>
              <div className="mt-1.5 text-xs text-[rgb(var(--text-muted))] leading-normal">
                {card.subtitle}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
