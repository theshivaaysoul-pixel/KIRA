// src/hooks/useTeam.ts
// Client hook for managing agency team members, role assignments, invites, and status updates.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamMember, TeamRole, TeamMemberStatus } from '@/lib/types/domain';
import type { ApiResponse } from '@/lib/types';
import type { CreateTeamMemberInput, UpdateTeamMemberInput, TeamStats } from '@/lib/services/team-service';

function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function useTeam() {
  const { user, getIdToken } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<TeamRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TeamMemberStatus | 'ALL'>('ALL');

  const fetchMembers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/team', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<TeamMember[]> = await res.json();
      if (!res.ok || !json.success) {
        const errText = typeof json.error === 'string' ? json.error : json.error?.message || `Failed to fetch team members (${res.status})`;
        throw new Error(errText);
      }

      setMembers(json.data || []);
    } catch (err) {
      console.error('[useTeam] Error fetching team members:', err);
      setError(formatApiErrorMessage(err, 'Failed to load team members.'));
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Derived filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (roleFilter !== 'ALL' && m.role !== roleFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && m.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [members, search, roleFilter, statusFilter]);

  // Derived team stats
  const stats: TeamStats = useMemo(() => {
    const roleCounts: Record<TeamRole, number> = {
      OWNER: 0,
      ADMIN: 0,
      MANAGER: 0,
      EDITOR: 0,
      DESIGNER: 0,
      ANALYST: 0,
      VIEWER: 0,
      MEMBER: 0,
    };

    let active = 0;
    let invited = 0;
    let suspended = 0;
    let inactive = 0;

    for (const m of members) {
      if (roleCounts[m.role] !== undefined) {
        roleCounts[m.role]++;
      }
      if (m.status === 'ACTIVE') active++;
      else if (m.status === 'INVITED') invited++;
      else if (m.status === 'SUSPENDED') suspended++;
      else if (m.status === 'INACTIVE') inactive++;
    }

    return {
      total: members.length,
      active,
      invited,
      suspended,
      inactive,
      roleCounts,
    };
  }, [members]);

  const createMember = async (data: CreateTeamMemberInput): Promise<TeamMember> => {
    setIsMutating(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json: ApiResponse<TeamMember> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        const errText = typeof json.error === 'string' ? json.error : json.error?.message || `Failed to create team member (${res.status})`;
        throw new Error(errText);
      }

      setMembers((prev) => [...prev, json.data!]);
      return json.data;
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to create team member');
      setError(msg);
      throw err;
    } finally {
      setIsMutating(false);
    }
  };

  const updateMember = async (id: string, data: UpdateTeamMemberInput): Promise<TeamMember> => {
    setIsMutating(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json: ApiResponse<TeamMember> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        const errText = typeof json.error === 'string' ? json.error : json.error?.message || `Failed to update team member (${res.status})`;
        throw new Error(errText);
      }

      setMembers((prev) => prev.map((m) => (m.id === id ? json.data! : m)));
      return json.data;
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to update team member');
      setError(msg);
      throw err;
    } finally {
      setIsMutating(false);
    }
  };

  const deleteMember = async (id: string): Promise<void> => {
    setIsMutating(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/team/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json: ApiResponse<{ deleted: boolean }> = await res.json();
      if (!res.ok || !json.success) {
        const errText = typeof json.error === 'string' ? json.error : json.error?.message || `Failed to delete team member (${res.status})`;
        throw new Error(errText);
      }

      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      const msg = formatApiErrorMessage(err, 'Failed to delete team member');
      setError(msg);
      throw err;
    } finally {
      setIsMutating(false);
    }
  };

  return {
    members: filteredMembers,
    allMembers: members,
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
    refresh: fetchMembers,
    createMember,
    updateMember,
    deleteMember,
  };
}
