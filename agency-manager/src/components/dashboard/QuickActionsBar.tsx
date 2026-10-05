'use client';
// src/components/dashboard/QuickActionsBar.tsx
// Separated quick actions grid for key operational workflows.

import { useRouter } from 'next/navigation';
import { Plus, UserPlus, CheckSquare, Calendar } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { SpotlightCard } from '@/components/motion';

export function QuickActionsBar() {
  const router = useRouter();
  const { hasPermission } = usePermission();

  const canCreateContent = hasPermission('content.create');
  const canCreateAccount = hasPermission('accounts.create');
  const canCreateTask = hasPermission('tasks.create');
  const canReadCalendar = hasPermission('calendar.read');

  const actions = [
    {
      label: 'New Content',
      description: 'Create & schedule posts',
      icon: Plus,
      color: 'bg-violet-500/10 text-violet-500 border-violet-500/20 group-hover:bg-violet-500 group-hover:text-white',
      badgeColor: 'bg-violet-500',
      visible: canCreateContent,
      onClick: () => router.push('/content'),
    },
    {
      label: 'Connect Account',
      description: 'Manage social channels',
      icon: UserPlus,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white',
      badgeColor: 'bg-blue-500',
      visible: canCreateAccount,
      onClick: () => router.push('/accounts'),
    },
    {
      label: 'Add Task',
      description: 'Assign agency deliverables',
      icon: CheckSquare,
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white',
      badgeColor: 'bg-emerald-500',
      visible: canCreateTask,
      onClick: () => router.push('/tasks'),
    },
    {
      label: 'Editorial Calendar',
      description: 'View publication timeline',
      icon: Calendar,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white',
      badgeColor: 'bg-amber-500',
      visible: canReadCalendar,
      onClick: () => router.push('/calendar'),
    },
  ].filter((a) => a.visible);

  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <SpotlightCard key={act.label} className="rounded-2xl h-full">
            <button
              key={act.label}
              onClick={act.onClick}
              className="group card p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 text-left transition-all duration-200 hover:border-[rgb(var(--primary))]/40 hover:shadow-md cursor-pointer border border-[rgb(var(--border))] w-full h-full"
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 ${act.color}`}
              >
                <Icon size={16} className="sm:hidden" />
                <Icon size={18} className="hidden sm:block" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-primary))] group-hover:text-[rgb(var(--primary))] transition-colors truncate">
                  {act.label}
                </div>
                <div className="text-[10px] sm:text-[11px] text-[rgb(var(--text-muted))] truncate mt-0.5">
                  {act.description}
                </div>
              </div>
            </button>
          </SpotlightCard>
        );
      })}
    </div>
  );
}
