// src/app/api/admin/access-control/route.ts
// Protected API endpoint for Owner & Manager to view and configure member option permissions.

import { NextRequest, NextResponse } from 'next/server';
import {
  requireTeamMember,
  authErrorResponse,
  logSecurityActivity,
} from '@/lib/auth/authorization';
import {
  ACCESS_OPTION_MODULES,
  KIRA_OWNER_EMAIL,
  KIRA_MANAGER_EMAIL,
  PERMISSIONS,
  Permission,
} from '@/lib/auth/permissions';
import { getTeamMemberRepository } from '@/lib/repositories';
import type { ApiResponse, TeamMember } from '@/lib/types';
import type { AccessOptionModule } from '@/lib/auth/permissions';

export interface AccessControlData {
  members: TeamMember[];
  options: readonly AccessOptionModule[];
  allPermissions: readonly Permission[];
  ownerEmail: string;
  managerEmail: string;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<AccessControlData>>> {
  const { member: actor, errorResponse } = await requireTeamMember(req);
  if (errorResponse || !actor) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Authentication required', 401)) as unknown as NextResponse<
      ApiResponse<AccessControlData>
    >;
  }

  // Strict guard: Only Owner and Manager can access access control
  if (actor.role !== 'OWNER' && actor.role !== 'MANAGER') {
    return authErrorResponse(
      'FORBIDDEN',
      `Access restricted: Only the Owner (${KIRA_OWNER_EMAIL}) and Manager (${KIRA_MANAGER_EMAIL}) can access permissions management. Please contact agency leadership.`,
      403
    ) as unknown as NextResponse<ApiResponse<AccessControlData>>;
  }

  try {
    const teamRepo = getTeamMemberRepository();
    const members = await teamRepo.findAll();

    return NextResponse.json<ApiResponse<AccessControlData>>({
      success: true,
      data: {
        members,
        options: ACCESS_OPTION_MODULES,
        allPermissions: PERMISSIONS,
        ownerEmail: KIRA_OWNER_EMAIL,
        managerEmail: KIRA_MANAGER_EMAIL,
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/access-control] Error:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to load access control data.',
      500
    ) as unknown as NextResponse<ApiResponse<AccessControlData>>;
  }
}

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<TeamMember>>> {
  const { user, member: actor, errorResponse } = await requireTeamMember(req);
  if (errorResponse || !actor || !user) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Authentication required', 401)) as unknown as NextResponse<
      ApiResponse<TeamMember>
    >;
  }

  // Strict guard: Only Owner and Manager can modify access permissions
  if (actor.role !== 'OWNER' && actor.role !== 'MANAGER') {
    return authErrorResponse(
      'FORBIDDEN',
      `Access restricted: Only the Owner (${KIRA_OWNER_EMAIL}) and Manager (${KIRA_MANAGER_EMAIL}) can grant or revoke member access permissions.`,
      403
    ) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }

  try {
    const body = await req.json();
    const { memberId, customPermissions } = body;

    if (!memberId || typeof memberId !== 'string') {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'Valid memberId string is required.',
        400
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    if (!Array.isArray(customPermissions)) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'customPermissions must be an array of permission strings.',
        400
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Validate that all permissions in array are recognized permissions
    const validPermissions = customPermissions.filter((p): p is Permission =>
      (PERMISSIONS as readonly string[]).includes(p)
    );

    const teamRepo = getTeamMemberRepository();
    const target = await teamRepo.findById(memberId);

    if (!target) {
      return authErrorResponse(
        'TEAM_MEMBER_NOT_FOUND',
        `Team member with ID "${memberId}" not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Protect Owner & Manager accounts from arbitrary permission restrictions
    const targetEmail = (target.email || '').trim().toLowerCase();
    if (
      targetEmail === KIRA_OWNER_EMAIL.toLowerCase() ||
      targetEmail === KIRA_MANAGER_EMAIL.toLowerCase()
    ) {
      return authErrorResponse(
        'LEADERSHIP_PERMISSIONS_IMMUTABLE',
        'The Owner and Manager permanently possess full access across all agency systems.',
        400
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const updated = await teamRepo.update(target.id, {
      customPermissions: validPermissions,
    });

    if (!updated) {
      return authErrorResponse(
        'INTERNAL_ERROR',
        'Failed to save updated permissions.',
        500
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Audit log this security change
    await logSecurityActivity(user.uid, 'ROLE_CHANGED', 'TeamMember', target.id, {
      action: 'UPDATE_CUSTOM_PERMISSIONS',
      targetMemberId: target.id,
      targetEmail: target.email,
      grantedPermissions: validPermissions,
      grantedCount: validPermissions.length,
      updatedBy: actor.email,
    });

    return NextResponse.json<ApiResponse<TeamMember>>({
      success: true,
      data: updated,
      message: `Permissions updated successfully for ${target.name}.`,
    });
  } catch (err) {
    console.error('[PATCH /api/admin/access-control] Error:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to update permissions.',
      500
    ) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }
}
