// src/lib/auth/permissions.ts
// Centralized permission matrix and role capability definitions for KIRA Agency Manager.
// Evaluated server-side on every protected API and operation.
//
// Rules:
// - Owner: "theshivaaysoul@gmail.com" (Full access to everything)
// - Manager: "teamofkira@gmail.com" (Full access to everything)
// - Members cannot access: Activity, Infra, Data Health, Platform Audit

import type { TeamRole } from '@/lib/types/domain';

export const PERMISSIONS = [
  // Dashboard
  'dashboard.read',

  // Accounts
  'accounts.read',
  'accounts.create',
  'accounts.update',
  'accounts.delete',

  // Content
  'content.read',
  'content.create',
  'content.update',
  'content.delete',
  'content.approve',

  // Calendar
  'calendar.read',
  'calendar.create',
  'calendar.update',
  'calendar.delete',

  // Analytics
  'analytics.read',

  // Tasks
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'tasks.delete',

  // Team
  'team.read',
  'team.create',
  'team.update',
  'team.delete',
  'team.role.update',

  // Activity
  'activity.read',

  // Settings
  'settings.read',
  'settings.update',

  // Platforms
  'platforms.read',
  'platforms.create',
  'platforms.update',
  'platforms.delete',

  // Storage Administration
  'storage.read',
  'storage.backup',
  'storage.recover',

  // System Administration
  'system.admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<TeamRole, readonly Permission[]> = {
  // Only Owner and Manager can access everything
  OWNER: [...PERMISSIONS],

  MANAGER: [...PERMISSIONS],

  ADMIN: [
    'dashboard.read',
    'accounts.read',
    'accounts.create',
    'accounts.update',
    'accounts.delete',
    'content.read',
    'content.create',
    'content.update',
    'content.delete',
    'content.approve',
    'calendar.read',
    'calendar.create',
    'calendar.update',
    'calendar.delete',
    'analytics.read',
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'team.read',
    'team.create',
    'team.update',
    'team.delete',
    'team.role.update',
    'activity.read',
    'settings.read',
    'settings.update',
    'platforms.read',
    'platforms.create',
    'platforms.update',
    'platforms.delete',
    'storage.read',
    'storage.backup',
    'storage.recover',
    'system.admin',
  ],

  EDITOR: [
    'dashboard.read',
    'content.read',
    'content.create',
    'content.update',
    'calendar.read',
    'calendar.create',
    'calendar.update',
    'tasks.read',
    'tasks.update',
    'analytics.read',
    'platforms.read',
  ],

  DESIGNER: [
    'dashboard.read',
    'content.read',
    'content.update',
    'tasks.read',
    'tasks.update',
    'platforms.read',
  ],

  ANALYST: [
    'dashboard.read',
    'analytics.read',
    'accounts.read',
    'content.read',
    'calendar.read',
    'platforms.read',
  ],

  VIEWER: [
    'dashboard.read',
    'accounts.read',
    'content.read',
    'calendar.read',
    'analytics.read',
    'platforms.read',
  ],

  // Members cannot access activity, infra, data health, or platform audit
  MEMBER: [
    'dashboard.read',
    'accounts.read',
    'content.read',
    'content.create',
    'content.update',
    'calendar.read',
    'calendar.create',
    'calendar.update',
    'analytics.read',
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'team.read',
    'team.create',
    'platforms.read',
    'settings.read',
    'settings.update',
  ],
};

/**
 * Designated agency leadership emails.
 * Owner: theshivaaysoul@gmail.com
 * Manager: teamofkira@gmail.com
 */
export const KIRA_OWNER_EMAIL = 'theshivaaysoul@gmail.com';
export const KIRA_MANAGER_EMAIL = 'teamofkira@gmail.com';

export const OWNER_EMAILS: readonly string[] = [
  KIRA_OWNER_EMAIL,
  KIRA_MANAGER_EMAIL,
];

export function isAgencyOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === KIRA_OWNER_EMAIL.toLowerCase();
}

export function isAgencyManagerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === KIRA_MANAGER_EMAIL.toLowerCase();
}

export function isOwnerOrManagerEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === KIRA_OWNER_EMAIL.toLowerCase() ||
    normalized === KIRA_MANAGER_EMAIL.toLowerCase()
  );
}

/**
 * Check if a role has a given permission.
 */
export function hasPermission(role: TeamRole, permission: Permission): boolean {
  if (role === 'OWNER' || role === 'MANAGER') return true;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Get all permissions granted to a role.
 */
export function getRolePermissions(role: TeamRole): Permission[] {
  if (role === 'OWNER' || role === 'MANAGER') return [...PERMISSIONS];
  return [...(ROLE_PERMISSIONS[role] || [])];
}

/**
 * Numeric role hierarchy to evaluate relative privilege.
 */
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  OWNER: 100,
  MANAGER: 90,
  ADMIN: 80,
  EDITOR: 40,
  DESIGNER: 40,
  MEMBER: 25,
  ANALYST: 20,
  VIEWER: 10,
};

export function isRoleSuperior(roleA: TeamRole, roleB: TeamRole): boolean {
  return (ROLE_HIERARCHY[roleA] || 0) > (ROLE_HIERARCHY[roleB] || 0);
}

export function isRoleAtLeast(role: TeamRole, requiredRole: TeamRole): boolean {
  return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

/**
 * High-level configurable option modules for Owner & Manager to grant/revoke.
 */
export interface AccessOptionModule {
  id: string;
  name: string;
  description: string;
  category: 'ADMIN' | 'OPERATIONS' | 'CONTENT' | 'SYSTEM';
  icon: string;
  permissions: readonly Permission[];
  restrictedByRole?: boolean;
}

export const ACCESS_OPTION_MODULES: readonly AccessOptionModule[] = [
  {
    id: 'opt_activity',
    name: 'Activity Audit Logs',
    description: 'Access real-time security activity stream, member logins, and audit logs.',
    category: 'ADMIN',
    icon: 'Activity',
    permissions: ['activity.read'],
    restrictedByRole: true,
  },
  {
    id: 'opt_infra',
    name: 'Infrastructure & Storage',
    description: 'Inspect cloud storage buckets, trigger automated safety backups, and view recovery logs.',
    category: 'ADMIN',
    icon: 'Server',
    permissions: ['storage.read', 'storage.backup', 'storage.recover'],
    restrictedByRole: true,
  },
  {
    id: 'opt_data_health',
    name: 'Data Health & Integrity',
    description: 'Run deep integrity diagnostics across JSON collections, verify checksums, and detect orphans.',
    category: 'ADMIN',
    icon: 'ShieldCheck',
    permissions: ['system.admin'],
    restrictedByRole: true,
  },
  {
    id: 'opt_platform_audit',
    name: 'Platform Test & Audit',
    description: 'Execute automated platform connector diagnostic sweeps and test publishing capabilities.',
    category: 'ADMIN',
    icon: 'Cpu',
    permissions: ['system.admin'],
    restrictedByRole: true,
  },
  {
    id: 'opt_content_approval',
    name: 'Content Approval',
    description: 'Review drafted media, approve publication schedules, or send back for revision.',
    category: 'CONTENT',
    icon: 'CheckSquare',
    permissions: ['content.approve'],
  },
  {
    id: 'opt_content_delete',
    name: 'Content Deletion & Archive',
    description: 'Permanently remove or archive content posts, scripts, and production assets.',
    category: 'CONTENT',
    icon: 'Image',
    permissions: ['content.delete'],
  },
  {
    id: 'opt_accounts_manage',
    name: 'Social Accounts Management',
    description: 'Connect new client social accounts, edit credentials, or disconnect profiles.',
    category: 'OPERATIONS',
    icon: 'Users',
    permissions: ['accounts.create', 'accounts.update', 'accounts.delete'],
  },
  {
    id: 'opt_platforms_manage',
    name: 'Platforms Configuration',
    description: 'Create new platform connections, modify platform settings, and edit adapters.',
    category: 'OPERATIONS',
    icon: 'Share2',
    permissions: ['platforms.create', 'platforms.update', 'platforms.delete'],
  },
  {
    id: 'opt_calendar_manage',
    name: 'Calendar & Scheduling',
    description: 'Schedule, reschedule, or cancel publishing calendar slots and campaign dates.',
    category: 'OPERATIONS',
    icon: 'Calendar',
    permissions: ['calendar.create', 'calendar.update', 'calendar.delete'],
  },
  {
    id: 'opt_tasks_manage',
    name: 'Task Management & Deletion',
    description: 'Create, reassign, or remove tasks from team member queues.',
    category: 'OPERATIONS',
    icon: 'CheckSquare',
    permissions: ['tasks.create', 'tasks.update', 'tasks.delete'],
  },
  {
    id: 'opt_team_manage',
    name: 'Team Member Management',
    description: 'Invite new team members, edit member details, and update member status.',
    category: 'ADMIN',
    icon: 'UsersRound',
    permissions: ['team.create', 'team.update', 'team.delete'],
    restrictedByRole: true,
  },
  {
    id: 'opt_settings_manage',
    name: 'Agency Global Settings',
    description: 'Update agency brand name, logo, default timezone, and date formats.',
    category: 'SYSTEM',
    icon: 'Settings',
    permissions: ['settings.update'],
  },
] as const;
