// src/lib/auth/authorization.ts
// Centralized server-side authorization layer for KIRA Agency Manager (Phase 3)
// Enforces team member mapping, permission matrix, status validation,
// last-owner protection, self-protection, and IDOR defense.

import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyIdToken } from '@/lib/auth/firebase-admin';
import { getTeamMemberRepository, getActivityLogRepository } from '@/lib/repositories';
import type { TeamMember, TeamRole, TeamMemberStatus, ActivityAction } from '@/lib/types/domain';
import {
  hasPermission,
  Permission,
  ROLE_HIERARCHY,
  isAgencyOwnerEmail,
  isAgencyManagerEmail,
  isOwnerOrManagerEmail,
  KIRA_OWNER_EMAIL,
  KIRA_MANAGER_EMAIL,
} from './permissions';

export interface AuthContext {
  user: DecodedIdToken | null;
  member: TeamMember | null;
  status: 'UNAUTHENTICATED' | 'NO_TEAM_MEMBER' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INVITED';
  error?: string;
}

export interface StructuredErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standardized authorization error response.
 * Never leaks server internals or secrets.
 */
export function authErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<StructuredErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Extract and verify Firebase authenticated identity from the Authorization Bearer header.
 */
export async function getCurrentUser(req: NextRequest): Promise<DecodedIdToken | null> {
  let idToken: string | null = null;
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    idToken = authHeader.slice(7).trim();
  } else if (req.nextUrl?.searchParams?.has('token')) {
    idToken = req.nextUrl.searchParams.get('token');
  } else if (req.nextUrl?.searchParams?.has('auth')) {
    idToken = req.nextUrl.searchParams.get('auth');
  } else if (req.cookies?.has('auth_token')) {
    idToken = req.cookies.get('auth_token')?.value || null;
  }

  if (!idToken) return null;

  try {
    return await verifyIdToken(idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Missing server credentials')) {
      console.error('[getCurrentUser] Firebase Admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in your environment variables.');
      throw new Error('SERVER_CONFIG_MISSING');
    }
    const code = (err as { code?: string; errorInfo?: { code?: string } })?.errorInfo?.code
      || (err as { code?: string })?.code
      || 'unknown';
    console.error('[getCurrentUser] verifyIdToken failed:', code, message);
    throw new Error(`TOKEN_VERIFY_FAILED:${code}:${message.slice(0, 200)}`);
  }
}

/**
 * Resolve current authenticated identity and map it to a TeamMember record.
 * Handles auto-linking authUid to email if first time seen.
 */
export async function getCurrentTeamMember(req: NextRequest): Promise<AuthContext> {
  let user: DecodedIdToken | null = null;
  try {
    user = await getCurrentUser(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'SERVER_CONFIG_MISSING') {
      return {
        user: null,
        member: null,
        status: 'UNAUTHENTICATED',
        error: 'Server configuration error: Firebase Admin SDK credentials are not set. The deployment is missing required environment variables (FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).',
      };
    }
    if (message.startsWith('TOKEN_VERIFY_FAILED:')) {
      return {
        user: null,
        member: null,
        status: 'UNAUTHENTICATED',
        error: `Token verification failed (${message.slice('TOKEN_VERIFY_FAILED:'.length)})`,
      };
    }
    return {
      user: null,
      member: null,
      status: 'UNAUTHENTICATED',
      error: 'Authentication credentials were not provided or are invalid.',
    };
  }

  if (!user) {
    return {
      user: null,
      member: null,
      status: 'UNAUTHENTICATED',
      error: 'Authentication credentials were not provided or are invalid.',
    };
  }

  try {
    const teamRepo = getTeamMemberRepository();
    const email = (user.email || '').trim();
    let member = await teamRepo.findByAuthIdentity(user.uid, email);

    // Auto-provision TeamMember profile so newly registered users can access the dashboard immediately
    if (!member && email) {
      try {
        const rawName = (user.name || email.split('@')[0] || 'Team Member').trim();
        const formattedName =
          rawName
            .split(/[\s._-]+/)
            .filter(Boolean)
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ')
            .slice(0, 100)
            .trim() || 'Team Member';

        const isOwner = isAgencyOwnerEmail(email);
        const isManager = isAgencyManagerEmail(email);
        const cookieRole = req.cookies?.get('kira_invite_role')?.value;
        const validRoles: TeamRole[] = ['MEMBER', 'EDITOR', 'DESIGNER', 'ANALYST', 'VIEWER'];
        const assignedRole: TeamRole = isOwner
          ? 'OWNER'
          : isManager
          ? 'MANAGER'
          : cookieRole && validRoles.includes(cookieRole as TeamRole)
          ? (cookieRole as TeamRole)
          : 'MEMBER';

        const avatarUrl = user.picture && /^https?:\/\//.test(user.picture) ? user.picture : undefined;

        member = await teamRepo.create({
          name: formattedName,
          email: email.toLowerCase(),
          authUid: user.uid,
          role: assignedRole,
          status: 'ACTIVE',
          avatarUrl,
        });

        await logSecurityActivity(user.uid, 'CREATE', 'TeamMember', member.id, {
          isRegistration: true,
          role: member.role,
          email: member.email,
        });
      } catch (createErr) {
        console.warn('[getCurrentTeamMember] Auto-provision conflict/retry:', createErr);
        member = await teamRepo.findByAuthIdentity(user.uid, email);
        if (!member) {
          member = await teamRepo.findByEmail(email);
        }
      }
    }

    if (!member) {
      return {
        user,
        member: null,
        status: 'NO_TEAM_MEMBER',
        error: 'No registered TeamMember profile matches this authenticated account. Contact your agency owner.',
      };
    }

    // Global Rule:
    // Owner - "theshivaaysoul@gmail.com" -> OWNER (Full access to everything)
    // Manager - "teamofkira@gmail.com" -> MANAGER (Full access to everything)
    // Every other user MUST be a MEMBER, not a manager or owner.
    const userEmail = (email || member.email || '').trim().toLowerCase();
    if (userEmail === KIRA_OWNER_EMAIL.toLowerCase()) {
      if (member.role !== 'OWNER') {
        try {
          member = await teamRepo.update(member.id, { role: 'OWNER' });
        } catch {
          member = { ...member, role: 'OWNER' };
        }
      }
    } else if (userEmail === KIRA_MANAGER_EMAIL.toLowerCase()) {
      if (member.role !== 'MANAGER') {
        try {
          member = await teamRepo.update(member.id, { role: 'MANAGER' });
        } catch {
          member = { ...member, role: 'MANAGER' };
        }
      }
    } else {
      if (member.role !== 'MEMBER') {
        try {
          member = await teamRepo.update(member.id, { role: 'MEMBER' });
          await logSecurityActivity(user.uid, 'UPDATE', 'TeamMember', member.id, {
            action: 'ENFORCE_MEMBER_ROLE',
            previousRole: member.role,
            role: 'MEMBER',
          });
        } catch (err) {
          console.warn('[getCurrentTeamMember] Failed to persist role normalization:', err);
          member = { ...member, role: 'MEMBER' };
        }
      }
    }

    // If an invited member registers/logs in, transition their account to ACTIVE
    if (member.status === 'INVITED') {
      try {
        const avatarUrl = user.picture && /^https?:\/\//.test(user.picture) ? user.picture : undefined;
        member = await teamRepo.update(member.id, {
          status: 'ACTIVE',
          authUid: user.uid,
          ...(avatarUrl && !member.avatarUrl ? { avatarUrl } : {}),
        });
        await logSecurityActivity(user.uid, 'UPDATE', 'TeamMember', member.id, {
          action: 'INVITATION_ACTIVATED',
          email: member.email,
        });
      } catch (actErr) {
        console.warn('[getCurrentTeamMember] Failed to activate invited member:', actErr);
      }
    }

    if (member.status === 'SUSPENDED') {
      return {
        user,
        member,
        status: 'SUSPENDED',
        error: 'Your agency account has been suspended. Please contact an agency owner.',
      };
    }

    if (member.status === 'INACTIVE') {
      return {
        user,
        member,
        status: 'INACTIVE',
        error: 'Your agency account is currently inactive.',
      };
    }

    if (member.status === 'INVITED') {
      return {
        user,
        member,
        status: 'INVITED',
        error: 'Your agency account invitation is pending onboarding.',
      };
    }

    return {
      user,
      member,
      status: 'ACTIVE',
    };
  } catch (err) {
    console.error('[getCurrentTeamMember] Error mapping auth identity:', err);
    return {
      user,
      member: null,
      status: 'NO_TEAM_MEMBER',
      error: 'Failed to resolve team member identity.',
    };
  }
}

/**
 * Require a valid authenticated Firebase user.
 */
export async function requireAuthenticatedUser(req: NextRequest): Promise<{
  user: DecodedIdToken | null;
  errorResponse: NextResponse<StructuredErrorResponse> | null;
}> {
  const user = await getCurrentUser(req).catch(() => null);
  if (!user) {
    return {
      user: null,
      errorResponse: authErrorResponse('UNAUTHORIZED', 'Authentication required to access this resource.', 401),
    };
  }
  return { user, errorResponse: null };
}

/**
 * Require an active, valid TeamMember mapped to the authenticated user.
 */
export async function requireTeamMember(req: NextRequest): Promise<{
  user: DecodedIdToken | null;
  member: TeamMember | null;
  errorResponse: NextResponse<StructuredErrorResponse> | null;
}> {
  const context = await getCurrentTeamMember(req);

  if (context.status === 'UNAUTHENTICATED' || !context.user) {
    return {
      user: null,
      member: null,
      errorResponse: authErrorResponse('UNAUTHORIZED', context.error || 'Authentication required.', 401),
    };
  }

  if (context.status === 'NO_TEAM_MEMBER' || !context.member) {
    return {
      user: context.user,
      member: null,
      errorResponse: authErrorResponse('NO_TEAM_MEMBER', context.error || 'Team member record not found.', 403),
    };
  }

  if (context.status === 'SUSPENDED') {
    return {
      user: context.user,
      member: context.member,
      errorResponse: authErrorResponse('ACCOUNT_SUSPENDED', context.error || 'Account suspended.', 403),
    };
  }

  if (context.status === 'INACTIVE') {
    return {
      user: context.user,
      member: context.member,
      errorResponse: authErrorResponse('ACCOUNT_INACTIVE', context.error || 'Account inactive.', 403),
    };
  }

  if (context.status === 'INVITED') {
    return {
      user: context.user,
      member: context.member,
      errorResponse: authErrorResponse('ACCOUNT_INVITED', context.error || 'Account invitation pending.', 403),
    };
  }

  return { user: context.user, member: context.member, errorResponse: null };
}

/**
 * Require a specific permission for the active team member.
 * Supports optional asynchronous resource-level access check.
 */
export async function requirePermission(
  req: NextRequest,
  permission: Permission,
  resourceCheck?: (member: TeamMember) => boolean | Promise<boolean>
): Promise<{
  user: DecodedIdToken | null;
  member: TeamMember | null;
  errorResponse: NextResponse<StructuredErrorResponse> | null;
}> {
  const { user, member, errorResponse } = await requireTeamMember(req);
  if (errorResponse || !member || !user) {
    return { user, member, errorResponse };
  }

  // 1. Check Role Permission Matrix & Individual Member Custom Permissions
  const permitted =
    hasPermission(member.role, permission) ||
    Boolean(member.customPermissions && (member.customPermissions as string[]).includes(permission));
  if (!permitted) {
    await logSecurityActivity(user.uid, 'ACCESS_DENIED', 'Permission', permission, {
      role: member.role,
      memberId: member.id,
      path: req.nextUrl.pathname,
      reason: 'MISSING_ROLE_PERMISSION',
    });

    const isRestrictedFeature = [
      'activity.read',
      'system.admin',
      'storage.read',
      'storage.backup',
      'storage.recover',
    ].includes(permission);

    const errorMessage = isRestrictedFeature
      ? 'Access restricted: Members cannot access this resource. Please contact the Owner (theshivaaysoul@gmail.com) or Manager (teamofkira@gmail.com) of KIRA Agency.'
      : `You do not have permission to perform this action (${permission}). Please contact the Owner (theshivaaysoul@gmail.com) or Manager (teamofkira@gmail.com) of KIRA Agency.`;

    return {
      user,
      member,
      errorResponse: authErrorResponse('FORBIDDEN', errorMessage, 403),
    };
  }

  // 2. Resource-level Authorization Check (IDOR & assignment guard)
  if (resourceCheck) {
    try {
      const allowed = await resourceCheck(member);
      if (!allowed) {
        await logSecurityActivity(user.uid, 'ACCESS_DENIED', 'Resource', req.nextUrl.pathname, {
          role: member.role,
          memberId: member.id,
          reason: 'RESOURCE_ACCESS_DENIED',
        });

        return {
          user,
          member,
          errorResponse: authErrorResponse(
            'FORBIDDEN',
            'You do not have authorization to access this specific resource.',
            403
          ),
        };
      }
    } catch (err) {
      console.error('[requirePermission] Resource check error:', err);
      return {
        user,
        member,
        errorResponse: authErrorResponse('INTERNAL_ERROR', 'Authorization evaluation failed.', 500),
      };
    }
  }

  return { user, member, errorResponse: null };
}

/**
 * Require one of the specified roles.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: TeamRole | TeamRole[]
): Promise<{
  user: DecodedIdToken | null;
  member: TeamMember | null;
  errorResponse: NextResponse<StructuredErrorResponse> | null;
}> {
  const { user, member, errorResponse } = await requireTeamMember(req);
  if (errorResponse || !member || !user) {
    return { user, member, errorResponse };
  }

  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!rolesArray.includes(member.role)) {
    await logSecurityActivity(user.uid, 'ACCESS_DENIED', 'Role', rolesArray.join(','), {
      actualRole: member.role,
      memberId: member.id,
      path: req.nextUrl.pathname,
    });

    return {
      user,
      member,
      errorResponse: authErrorResponse(
        'FORBIDDEN',
        'Insufficient role privilege for this operation.',
        403
      ),
    };
  }

  return { user, member, errorResponse: null };
}

/**
 * Check if a member has a specific role.
 */
export function hasRole(member: TeamMember, role: TeamRole): boolean {
  return member.role === role;
}

/**
 * Check if a member has a specific permission.
 */
export function hasPermissionForMember(member: TeamMember, permission: Permission): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (member.role === 'OWNER' || member.role === 'MANAGER') return true;
  if (member.customPermissions && (member.customPermissions as string[]).includes(permission)) {
    return true;
  }
  return hasPermission(member.role, permission);
}

/**
 * Server-side validation for changing a team member's role or status.
 * Enforces:
 * 1. Self-protection: Users cannot change their own role.
 * 2. Self-protection: Cannot deactivate/suspend oneself if last active owner.
 * 3. Privilege escalation prevention:
 *    - Only an OWNER can promote someone to OWNER.
 *    - Actor must have higher role hierarchy than target unless actor is OWNER.
 * 4. Last Owner Protection: Cannot remove, demote, or deactivate the last remaining active OWNER.
 */
export async function validateRoleChange(
  actor: TeamMember,
  target: TeamMember,
  newRole?: TeamRole,
  newStatus?: TeamMemberStatus
): Promise<{ allowed: boolean; code?: string; message?: string }> {
  // 1. Self-protection: Role modification
  if (actor.id === target.id && newRole && newRole !== target.role) {
    return {
      allowed: false,
      code: 'CANNOT_MODIFY_OWN_ROLE',
      message: 'You cannot modify your own role.',
    };
  }

  // 2. Permission check
  if (newRole && !hasPermission(actor.role, 'team.role.update')) {
    return {
      allowed: false,
      code: 'FORBIDDEN',
      message: 'You do not have permission to update team roles.',
    };
  }

  if (newStatus && !hasPermission(actor.role, 'team.update')) {
    return {
      allowed: false,
      code: 'FORBIDDEN',
      message: 'You do not have permission to update team member status.',
    };
  }

  // 3. Global Rule: Only designated Owner and Manager accounts can hold Owner or Manager roles
  if (newRole && (newRole === 'OWNER' || newRole === 'MANAGER' || newRole === 'ADMIN')) {
    const targetEmail = (target.email || '').trim().toLowerCase();
    if (newRole === 'OWNER' && targetEmail !== KIRA_OWNER_EMAIL.toLowerCase()) {
      return {
        allowed: false,
        code: 'FORBIDDEN_OWNER_ROLE_RESTRICTED',
        message: 'Only the authorized agency owner (theshivaaysoul@gmail.com) can hold the Owner role. Please contact the Owner or Manager of KIRA Agency.',
      };
    }
    if (newRole === 'MANAGER' && targetEmail !== KIRA_MANAGER_EMAIL.toLowerCase()) {
      return {
        allowed: false,
        code: 'FORBIDDEN_MANAGER_ROLE_RESTRICTED',
        message: 'Only the authorized agency manager (teamofkira@gmail.com) can hold the Manager role. Please contact the Owner or Manager of KIRA Agency.',
      };
    }
    if (newRole === 'ADMIN' && !isOwnerOrManagerEmail(target.email)) {
      return {
        allowed: false,
        code: 'FORBIDDEN_ROLE_RESTRICTED',
        message: 'Only the Owner (theshivaaysoul@gmail.com) or Manager (teamofkira@gmail.com) of KIRA Agency can hold elevated roles.',
      };
    }
  }

  // 4. Hierarchy rules:
  // Non-owner cannot assign OWNER role
  if (newRole === 'OWNER' && actor.role !== 'OWNER') {
    return {
      allowed: false,
      code: 'FORBIDDEN_CANNOT_ASSIGN_OWNER',
      message: 'Only an existing OWNER can assign the OWNER role to a team member.',
    };
  }

  // Actor cannot modify an OWNER unless actor is an OWNER
  if (target.role === 'OWNER' && actor.role !== 'OWNER') {
    return {
      allowed: false,
      code: 'FORBIDDEN',
      message: 'Only an OWNER can modify another OWNER account.',
    };
  }

  // ADMIN cannot modify another ADMIN or higher role unless actor is OWNER
  if (actor.role !== 'OWNER') {
    const actorRank = ROLE_HIERARCHY[actor.role] || 0;
    const targetRank = ROLE_HIERARCHY[target.role] || 0;
    if (targetRank >= actorRank && actor.id !== target.id) {
      return {
        allowed: false,
        code: 'FORBIDDEN_HIERARCHY_VIOLATION',
        message: 'Cannot modify a team member of equal or higher role privilege.',
      };
    }
  }

  // 4. Last OWNER Protection
  const isTargetOwner = target.role === 'OWNER';
  const isTargetActive = target.status === 'ACTIVE';

  if (isTargetOwner && isTargetActive) {
    const roleIsChangingAwayFromOwner = newRole !== undefined && newRole !== 'OWNER';
    const statusIsChangingAwayFromActive = newStatus !== undefined && newStatus !== 'ACTIVE';

    if (roleIsChangingAwayFromOwner || statusIsChangingAwayFromActive) {
      const teamRepo = getTeamMemberRepository();
      const activeOwnerCount = await teamRepo.countActiveOwners();

      if (activeOwnerCount <= 1) {
        return {
          allowed: false,
          code: 'CANNOT_REMOVE_LAST_OWNER',
          message: 'Cannot demote or deactivate the last remaining active agency OWNER.',
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Secure activity logging helper.
 * Never stores tokens, passwords, secrets, or sensitive request bodies.
 */
export async function logSecurityActivity(
  userId: string,
  action: ActivityAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const activityRepo = getActivityLogRepository();
    const safeMetadata: Record<string, unknown> = {};
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (/password|token|secret|key|privatekey|credential|auth/i.test(key)) {
          // Strictly omit sensitive keys to satisfy schema validation and security rules
          continue;
        }
        safeMetadata[key] = value;
      }
    }

    await activityRepo.create({
      userId,
      action,
      entityType,
      entityId,
      metadata: safeMetadata,
    });
  } catch (err) {
    console.warn('[logSecurityActivity] Failed to write security activity log:', err);
  }
}
