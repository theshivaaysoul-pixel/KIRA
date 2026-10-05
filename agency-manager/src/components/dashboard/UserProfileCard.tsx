'use client';
// src/components/dashboard/UserProfileCard.tsx
// Minimal authenticated profile card displaying identity, team member mapping, role, and status.

import { Shield, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Avatar } from '@/components/ui/Avatar';

export function UserProfileCard() {
  const { user } = useAuth();
  const { teamMember, role, status, permissions, loading, error } = usePermission();

  const getRoleBadgeColor = (r: string | null) => {
    switch (r) {
      case 'OWNER':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ADMIN':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'MANAGER':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'EDITOR':
      case 'DESIGNER':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'ANALYST':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
    }
  };

  const getStatusBadge = (s: string | null) => {
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={12} /> Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500">
        <AlertCircle size={12} /> {s || 'Unlinked'}
      </span>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))]">
            <UserIcon size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
              Identity & Role
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Authenticated TeamMember profile
            </p>
          </div>
        </div>
        {role && (
          <span
            className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getRoleBadgeColor(
              role
            )}`}
          >
            {role}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-[rgb(var(--text-muted))]">
          Resolving authorization identity...
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={user?.photoURL}
              name={teamMember?.name || user?.displayName || user?.email}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))] truncate">
                {teamMember?.name || user?.displayName || 'Agency Member'}
              </h3>
              <p className="text-xs text-[rgb(var(--text-secondary))] truncate">
                {teamMember?.email || user?.email}
              </p>
            </div>
            <div className="text-right">
              {getStatusBadge(status)}
              {teamMember?.id && (
                <p className="text-[10px] text-[rgb(var(--text-muted))] font-mono">
                  {teamMember.id}
                </p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[rgb(var(--text-secondary))]">
              <Shield size={14} className="text-[rgb(var(--primary))]" />
              <span>Granted Permissions</span>
            </div>
            <span className="font-semibold text-[rgb(var(--text-primary))] font-mono">
              {permissions.length} actions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
