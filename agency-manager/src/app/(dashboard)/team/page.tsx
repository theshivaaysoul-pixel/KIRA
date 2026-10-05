'use client';
// src/app/(dashboard)/team/page.tsx
// Phase 19 — KIRA Agency Team Management Page
//
// Full team lifecycle management:
// - List team members with real-time search & filters
// - Invite new team members with role hierarchy validation
// - Edit roles & statuses with last-owner protection
// - Suspend / reactivate team member accounts
// - Remove team members with audit activity logging
// - Server-backed permissions & security guards

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  MoreVertical,
  CheckCircle2,
  Clock,
  Ban,
  UserX,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react';
import { useTeam } from '@/hooks/useTeam';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/components/ui/Toast';
import { TeamStatsCards } from '@/components/team/TeamStatsCards';
import { TeamMemberModal } from '@/components/team/TeamMemberModal';
import { TeamDeleteModal } from '@/components/team/TeamDeleteModal';
import type { TeamMember, TeamRole, TeamMemberStatus } from '@/lib/types/domain';
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from '@/lib/services/team-service';
import { ROLE_HIERARCHY } from '@/lib/auth/permissions';

const ROLE_BADGES: Record<
  TeamRole,
  { label: string; className: string }
> = {
  OWNER: {
    label: 'Owner',
    className: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  },
  ADMIN: {
    label: 'Admin',
    className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  },
  MANAGER: {
    label: 'Manager',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  EDITOR: {
    label: 'Editor',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  DESIGNER: {
    label: 'Designer',
    className: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
  },
  ANALYST: {
    label: 'Analyst',
    className: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  },
  VIEWER: {
    label: 'Viewer',
    className: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  },
  MEMBER: {
    label: 'Member',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
};

const STATUS_CONFIG: Record<
  TeamMemberStatus,
  { label: string; dot: string; badge: string; icon: React.FC<{ size?: number }> }
> = {
  ACTIVE: {
    label: 'Active',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
  },
  INVITED: {
    label: 'Invited',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: Clock,
  },
  SUSPENDED: {
    label: 'Suspended',
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: Ban,
  },
  INACTIVE: {
    label: 'Inactive',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    icon: UserX,
  },
};

export default function TeamPage() {
  const { role: currentUserRole, hasPermission } = usePermission();
  const { success, error: toastError } = useToast();

  const {
    members,
    allMembers,
    stats,
    loading,
    isMutating,
    error,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    refresh,
    createMember,
    updateMember,
    deleteMember,
  } = useTeam();

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);

  // Permissions
  const canRead = hasPermission('team.read');
  const canCreate = hasPermission('team.create');
  const canUpdate = hasPermission('team.update');
  const canDelete = hasPermission('team.delete');

  const activeOwnerCount = allMembers.filter(
    (m) => m.role === 'OWNER' && m.status === 'ACTIVE'
  ).length;

  const handleOpenCreate = () => {
    setEditingMember(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: TeamMember) => {
    if (currentUserRole === 'MEMBER' || !canModifyMember(m)) {
      toastError('Members cannot edit team member profiles.');
      return;
    }
    setEditingMember(m);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: CreateTeamMemberInput | UpdateTeamMemberInput) => {
    if (editingMember && currentUserRole === 'MEMBER') {
      toastError('Members do not have permission to modify team members.');
      return;
    }
    try {
      if (editingMember) {
        await updateMember(editingMember.id, data as UpdateTeamMemberInput);
        success(`Updated profile for ${data.name || editingMember.name}`);
      } else {
        const created = await createMember(data as CreateTeamMemberInput);
        success(`Invitation sent to ${created.email}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toastError(msg);
      throw err;
    }
  };

  const handleToggleStatus = async (m: TeamMember) => {
    if (currentUserRole === 'MEMBER' || !canModifyMember(m)) {
      toastError('Members cannot change team account status.');
      return;
    }

    const nextStatus: TeamMemberStatus = m.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    // Prevent suspending last active owner
    if (m.role === 'OWNER' && m.status === 'ACTIVE' && activeOwnerCount <= 1) {
      toastError('Cannot suspend the last remaining active agency Owner.');
      return;
    }

    try {
      await updateMember(m.id, { status: nextStatus });
      success(
        nextStatus === 'ACTIVE'
          ? `Reactivated ${m.name}`
          : `Suspended ${m.name}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      toastError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMember) return;
    if (currentUserRole === 'MEMBER' || !canDelete) {
      toastError('Members cannot remove team members.');
      return;
    }
    try {
      await deleteMember(deletingMember.id);
      success(`Removed ${deletingMember.name} from the agency`);
      setDeletingMember(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toastError(msg);
    }
  };

  // Helper to determine if current user can modify target member
  const canModifyMember = (target: TeamMember): boolean => {
    if (!canUpdate || !currentUserRole) return false;
    if (currentUserRole === 'MEMBER') return false; // Members can see but cannot modify anyone
    if (currentUserRole === 'OWNER') return true;
    if (currentUserRole === 'MANAGER' && target.role !== 'OWNER') return true;
    if (target.role === 'OWNER' || target.role === 'MANAGER') return false;
    const actorRank = ROLE_HIERARCHY[currentUserRole] || 0;
    const targetRank = ROLE_HIERARCHY[target.role] || 0;
    return actorRank > targetRank;
  };

  const canDeleteMember = (target: TeamMember): boolean => {
    if (!canDelete || !currentUserRole) return false;
    if (currentUserRole === 'MEMBER') return false; // Members can see but cannot delete anyone
    if (target.role === 'OWNER' && activeOwnerCount <= 1) return false;
    return canModifyMember(target);
  };

  if (!canRead) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-3">
          <ShieldAlert size={24} />
          <div>
            <h3 className="font-semibold text-sm">Access Restricted</h3>
            <p className="text-xs text-amber-400/80">
              You do not have permission to view agency team members. Contact an agency Owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-[rgb(var(--text-primary))]">
                Team Management
              </h1>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Agency personnel, role assignments, and permission controls
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="w-11 h-11 rounded-full border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
            title="Refresh team members"
          >
            <RotateCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all min-h-[44px]"
            >
              <UserPlus size={18} />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <TeamStatsCards stats={stats} loading={loading} />

      {/* Filter and Search Bar */}
      <div className="card p-4 rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex items-center flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-[rgb(var(--text-muted))]"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[rgb(var(--text-muted))] whitespace-nowrap hidden sm:inline">
            Role:
          </span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as TeamRole | 'ALL')}
            className="px-3 py-2 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all"
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EDITOR">Editor</option>
            <option value="DESIGNER">Designer</option>
            <option value="ANALYST">Analyst</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[rgb(var(--text-muted))] whitespace-nowrap hidden sm:inline">
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TeamMemberStatus | 'ALL')}
            className="px-3 py-2 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Invited</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Team Members List */}
      <div className="card rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <RotateCw size={28} className="animate-spin text-purple-400 mb-3" />
            <p className="text-xs text-[rgb(var(--text-muted))]">Loading agency roster...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 rounded-2xl bg-zinc-500/10 text-zinc-400">
              <Users size={28} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                No team members found
              </h3>
              <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                {search || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No members match the current search filters.'
                  : 'Start by inviting the first member to your agency.'}
              </p>
            </div>
            {(search || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="mt-2 px-3.5 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]/50 text-[rgb(var(--text-muted))] uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">Member</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 hidden md:table-cell">Joined</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {members.map((m) => {
                  const roleBadge = ROLE_BADGES[m.role];
                  const statusCfg = STATUS_CONFIG[m.status];
                  const StatusIcon = statusCfg.icon;
                  const canModify = canModifyMember(m);
                  const isSoleOwner = m.role === 'OWNER' && activeOwnerCount <= 1;

                  // Initials fallback
                  const initials = m.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-[rgb(var(--bg-subtle))]/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              className="w-9 h-9 rounded-full object-cover border border-[rgb(var(--border))]"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-xs text-purple-300">
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-[rgb(var(--text-primary))] flex items-center gap-1.5">
                              <span>{m.name}</span>
                              <span className="font-mono text-[10px] text-[rgb(var(--text-muted))] bg-[rgb(var(--bg-subtle))] px-1.5 py-0.5 rounded-md">
                                {m.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-[rgb(var(--text-muted))]">
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium text-[11px] ${roleBadge.className}`}
                        >
                          <Shield size={12} />
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-[11px] border ${statusCfg.badge}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${m.status === 'ACTIVE' ? 'animate-pulse' : ''
                              }`}
                          />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-6 hidden md:table-cell text-[rgb(var(--text-muted))]">
                        {new Date(m.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        {(() => {
                          const isMemberUser = currentUserRole === 'MEMBER';
                          const canEdit = !isMemberUser && canModifyMember(m);
                          const canToggleStatus =
                            !isMemberUser &&
                            canModifyMember(m) &&
                            !(m.role === 'OWNER' && activeOwnerCount <= 1);
                          const canRemove = !isMemberUser && canDeleteMember(m);

                          return (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. Edit Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canEdit) {
                                    if (isMemberUser) {
                                      toastError('Members cannot edit team member profiles.');
                                    }
                                    return;
                                  }
                                  handleOpenEdit(m);
                                }}
                                disabled={isMutating || !canEdit}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  canEdit
                                    ? 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] cursor-pointer'
                                    : 'text-[rgb(var(--text-muted))] opacity-40 cursor-not-allowed'
                                }`}
                                title={
                                  isMemberUser
                                    ? 'Members cannot edit team member profiles'
                                    : !canEdit
                                      ? 'Insufficient permissions to edit this member'
                                      : 'Edit profile or change role'
                                }
                              >
                                <Edit2 size={14} />
                              </button>

                              {/* 2. Suspend / Reactivate Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canToggleStatus) {
                                    if (isMemberUser) {
                                      toastError('Members cannot change team account status.');
                                    }
                                    return;
                                  }
                                  handleToggleStatus(m);
                                }}
                                disabled={isMutating || !canToggleStatus}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  m.status === 'SUSPENDED'
                                    ? canToggleStatus
                                      ? 'text-emerald-400 hover:bg-emerald-500/10 cursor-pointer'
                                      : 'text-emerald-400/60 opacity-40 cursor-not-allowed'
                                    : canToggleStatus
                                      ? 'text-amber-400 hover:bg-amber-500/10 cursor-pointer'
                                      : 'text-amber-400/60 opacity-40 cursor-not-allowed'
                                }`}
                                title={
                                  isMemberUser
                                    ? 'Members cannot suspend or reactivate team accounts'
                                    : isSoleOwner
                                      ? 'Cannot suspend sole Owner'
                                      : !canToggleStatus
                                        ? 'Insufficient permissions to change status'
                                        : m.status === 'SUSPENDED'
                                          ? 'Reactivate account'
                                          : 'Suspend account'
                                }
                              >
                                {m.status === 'SUSPENDED' ? (
                                  <CheckCircle2 size={14} />
                                ) : (
                                  <Ban size={14} />
                                )}
                              </button>

                              {/* 3. Delete Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canRemove) {
                                    if (isMemberUser) {
                                      toastError('Members cannot remove team members.');
                                    }
                                    return;
                                  }
                                  setDeletingMember(m);
                                }}
                                disabled={isMutating || !canRemove}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  canRemove
                                    ? 'text-red-400 hover:bg-red-500/10 cursor-pointer'
                                    : 'text-red-400/60 opacity-40 cursor-not-allowed'
                                }`}
                                title={
                                  isMemberUser
                                    ? 'Members cannot remove team members'
                                    : isSoleOwner
                                      ? 'Cannot delete sole Owner'
                                      : !canRemove
                                        ? 'Insufficient permissions to remove this member'
                                        : 'Remove team member'
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <TeamMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        member={editingMember}
        currentUserRole={currentUserRole || 'VIEWER'}
        isMutating={isMutating}
      />

      <TeamDeleteModal
        isOpen={!!deletingMember}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDeleteConfirm}
        member={deletingMember}
        isMutating={isMutating}
        activeOwnerCount={activeOwnerCount}
      />
    </div>
  );
}
