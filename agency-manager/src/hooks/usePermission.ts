'use client';
// src/hooks/usePermission.ts
// Thin wrapper around the shared PermissionContext (single /api/auth/me fetch
// for the whole app, instead of a separate fetch per component that calls
// this hook — previously Header, Sidebar, QuickActionsBar, and page components
// each independently re-fetched the same identity/permissions data).
// NOTE: Frontend checks are for UX ONLY. Server-side authorization remains mandatory.

import { usePermissionContext, type PermissionContextValue } from '@/contexts/PermissionContext';

export type UsePermissionReturn = PermissionContextValue;

export function usePermission(): UsePermissionReturn {
  return usePermissionContext();
}
