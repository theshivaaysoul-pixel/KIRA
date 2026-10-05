'use client';
// src/components/dashboard/TeamRoleManagementCard.tsx
// Minimal protected role management interface for authorized agency members.
// All actions trigger real server-side authorization checks and update GCS records.

import { useState, useEffect, useCallback } from 'react';
import { UsersRound, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import type { TeamMember, TeamRole, TeamMemberStatus } from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';

const ROLES: TeamRole[] = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'EDITOR',
  'DESIGNER',
  'ANALYST',
  'VIEWER',
  'MEMBER',
];

export function TeamRoleManagementCard() {
  const { getIdToken } = useAuth();
  const { teamMember: currentActor, hasPermission } = usePermission();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canReadTeam = hasPermission('team.read');
  const canUpdateRole = hasPermission('team.role.update');
  const canUpdateStatus = hasPermission('team.update');

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!canReadTeam) {
        if (active) setLoading(false);
        return;
      }
      try {
        const token = await getIdToken();
        if (!active || !token) {
          if (active) setLoading(false);
          return;
        }

        const res = await fetch('/api/team', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as ApiResponse<TeamMember[]>;

        if (!active) return;

        if (res.ok && data.success && data.data) {
          setMembers(data.data);
          setActionError(null);
        } else {
          const msg = typeof data.error === 'string' ? data.error : data.error?.message;
          setActionError(msg || 'Failed to fetch team members.');
        }
      } catch (err) {
        if (!active) return;
        setActionError(err instanceof Error ? err.message : 'Error fetching team members.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      active = false;
    };
  }, [canReadTeam, getIdToken, refreshKey]);

  const refreshMembers = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRoleChange = async (targetId: string, newRole: TeamRole) => {
    try {
      setUpdatingId(targetId);
      setActionError(null);
      setActionSuccess(null);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/team/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = (await res.json()) as ApiResponse<TeamMember>;

      if (!res.ok || !data.success) {
        const msg = typeof data.error === 'string' ? data.error : data.error?.message;
        setActionError(msg || 'Failed to update role.');
      } else {
        setActionSuccess(`Role successfully updated to ${newRole}.`);
        refreshMembers();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (target: TeamMember) => {
    const newStatus: TeamMemberStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      setUpdatingId(target.id);
      setActionError(null);
      setActionSuccess(null);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/team/${target.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = (await res.json()) as ApiResponse<TeamMember>;

      if (!res.ok || !data.success) {
        const msg = typeof data.error === 'string' ? data.error : data.error?.message;
        setActionError(msg || 'Failed to update member status.');
      } else {
        setActionSuccess(`Account status changed to ${newStatus}.`);
        refreshMembers();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!canReadTeam) {
    return null;
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary-light))] flex items-center justify-center text-[rgb(var(--primary))]">
            <UsersRound size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
              Team & Role Administration
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Role permissions & access controls (Server-Verified)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))] font-mono">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>{members.length} members</span>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle size={14} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-[rgb(var(--text-muted))]">
          Loading team directory...
        </div>
      ) : members.length === 0 ? (
        <div className="py-6 text-center text-xs text-[rgb(var(--text-muted))]">
          No team members registered yet.
        </div>
      ) : (
        <div className="divide-y divide-[rgb(var(--border))]">
          {members.map((member) => {
            const isSelf = currentActor?.id === member.id;
            const isOwner = member.role === 'OWNER';
            const isUpdating = updatingId === member.id;

            return (
              <div
                key={member.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[rgb(var(--text-primary))]">
                      {member.name}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-neutral-500/10 text-neutral-600 dark:text-neutral-400">
                        You
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        member.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[rgb(var(--text-secondary))] truncate">
                    {member.email} · <span className="font-mono text-[10px]">{member.id}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Role Selector */}
                  {canUpdateRole ? (
                    <select
                      value={member.role}
                      disabled={isUpdating || (isSelf && isOwner)}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as TeamRole)}
                      className="px-2 py-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))] disabled:opacity-50"
                      title={isSelf ? 'Cannot modify your own role' : 'Change role'}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-semibold font-mono text-[rgb(var(--text-primary))]">
                      {member.role}
                    </span>
                  )}

                  {/* Status Toggle */}
                  {canUpdateStatus && !isSelf && (
                    <button
                      onClick={() => handleStatusToggle(member)}
                      disabled={isUpdating}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors text-[11px] ${
                        member.status === 'ACTIVE'
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600'
                      } disabled:opacity-50`}
                    >
                      {member.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
