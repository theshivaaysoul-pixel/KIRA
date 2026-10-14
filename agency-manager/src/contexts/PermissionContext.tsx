'use client';
// src/contexts/PermissionContext.tsx
// Single shared fetch of /api/auth/me for the whole app.
// Previously every component called the usePermission hook independently,
// each firing its own /api/auth/me request (Header, Sidebar, QuickActionsBar,
// and the page itself all fetched the same data on every dashboard load).
// NOTE: Frontend checks are for UX ONLY. Server-side authorization remains mandatory.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamMember, TeamRole, TeamMemberStatus } from '@/lib/types/domain';
import type { Permission } from '@/lib/auth/permissions';
import type { ApiResponse } from '@/lib/types';
import type { AuthMeData } from '@/app/api/auth/me/route';

export interface PermissionContextValue {
  teamMember: TeamMember | null;
  role: TeamRole | null;
  status: TeamMemberStatus | null;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasRole: (role: TeamRole) => boolean;
  isOwnerOrAdmin: boolean;
  isOwnerOrManager: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      await Promise.resolve();
      if (!active) return;

      if (!user) {
        setTeamMember(null);
        setPermissions([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        const token = await getIdToken();
        if (!active || !token) {
          if (active) setLoading(false);
          return;
        }

        const authHeaderValue = ['Bearer', token].join(' ');
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: authHeaderValue,
          },
        });

        const json = (await res.json()) as ApiResponse<AuthMeData>;

        if (!active) return;

        if (!res.ok || !json.success || !json.data) {
          const notAuthorizedMsg = ['HTTP', res.status, '- Failed to resolve authorization'].join(' ');
          const errorMsg =
            typeof json.error === 'string'
              ? json.error
              : json.error?.message || notAuthorizedMsg;
          setError(errorMsg);
          setTeamMember(null);
          setPermissions([]);
        } else {
          setTeamMember(json.data.teamMember);
          setPermissions(json.data.permissions || []);
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load permissions');
        setTeamMember(null);
        setPermissions([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [user, authLoading, getIdToken, refreshTrigger]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const hasPermissionCheck = useCallback(
    (permission: Permission): boolean => {
      if (!teamMember || teamMember.status !== 'ACTIVE') return false;
      if (teamMember.role === 'OWNER' || teamMember.role === 'MANAGER') return true;
      return permissions.includes(permission);
    },
    [teamMember, permissions]
  );

  const hasAnyPermissionCheck = useCallback(
    (perms: Permission[]): boolean => {
      if (!teamMember || teamMember.status !== 'ACTIVE') return false;
      if (teamMember.role === 'OWNER' || teamMember.role === 'MANAGER') return true;
      return perms.some((p) => permissions.includes(p));
    },
    [teamMember, permissions]
  );

  const hasRoleCheck = useCallback(
    (targetRole: TeamRole): boolean => {
      return teamMember?.role === targetRole;
    },
    [teamMember]
  );

  const isOwnerOrAdmin = teamMember?.role === 'OWNER' || teamMember?.role === 'ADMIN';
  const isOwnerOrManager = teamMember?.role === 'OWNER' || teamMember?.role === 'MANAGER';

  return (
    <PermissionContext.Provider
      value={{
        teamMember,
        role: teamMember?.role ?? null,
        status: teamMember?.status ?? null,
        permissions,
        hasPermission: hasPermissionCheck,
        hasAnyPermission: hasAnyPermissionCheck,
        hasRole: hasRoleCheck,
        isOwnerOrAdmin,
        isOwnerOrManager,
        loading: authLoading || loading,
        error,
        refresh,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return ctx;
}
