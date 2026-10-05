// src/app/api/team/[id]/route.ts
// Protected API endpoints for retrieving, updating, and deleting individual team members.
// Enforces last-owner protection, self-promotion guards, and hierarchy checks.

import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  requireTeamMember,
  validateRoleChange,
  authErrorResponse,
  logSecurityActivity,
} from '@/lib/auth/authorization';
import { getTeamMemberRepository } from '@/lib/repositories';
import { UpdateTeamMemberSchema } from '@/lib/validation';
import type { ApiResponse, TeamMember } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<TeamMember>>> {
  const { errorResponse } = await requirePermission(req, 'team.read');
  if (errorResponse) return errorResponse as unknown as NextResponse<ApiResponse<TeamMember>>;

  const { id } = await params;
  try {
    const teamRepo = getTeamMemberRepository();
    const member = await teamRepo.findById(id);

    if (!member) {
      return authErrorResponse(
        'TEAM_MEMBER_NOT_FOUND',
        `Team member with ID ${id} was not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    return NextResponse.json<ApiResponse<TeamMember>>({
      success: true,
      data: member,
    });
  } catch (err) {
    console.error(`[GET /api/team/${id}] Error:`, err);
    return authErrorResponse('INTERNAL_ERROR', 'Failed to retrieve team member.', 500) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<TeamMember>>> {
  const { user, member: actor, errorResponse } = await requireTeamMember(req);
  if (errorResponse || !actor || !user) {
    return (errorResponse || authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }

  const { id } = await params;
  try {
    const teamRepo = getTeamMemberRepository();
    const target = await teamRepo.findById(id);

    if (!target) {
      return authErrorResponse(
        'TEAM_MEMBER_NOT_FOUND',
        `Team member with ID ${id} was not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const body = await req.json();
    const validationResult = UpdateTeamMemberSchema.safeParse(body);

    if (!validationResult.success) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'Invalid update payload',
        400,
        validationResult.error.format()
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const updates = validationResult.data;

    // Check role or status modifications
    if (updates.role !== undefined || updates.status !== undefined) {
      const roleCheck = await validateRoleChange(actor, target, updates.role, updates.status);
      if (!roleCheck.allowed) {
        const statusCode = roleCheck.code === 'CANNOT_REMOVE_LAST_OWNER' ? 422 : 403;
        return authErrorResponse(
          roleCheck.code || 'FORBIDDEN',
          roleCheck.message || 'Action forbidden.',
          statusCode
        ) as unknown as NextResponse<ApiResponse<TeamMember>>;
      }
    } else {
      // General profile fields update requires 'team.update' unless editing own non-role fields
      const isSelf = actor.id === target.id;
      if (!isSelf && !['OWNER', 'MANAGER', 'ADMIN'].includes(actor.role)) {
        return authErrorResponse(
          'FORBIDDEN',
          'You do not have permission to update other team members.',
          403
        ) as unknown as NextResponse<ApiResponse<TeamMember>>;
      }
    }

    const updated = await teamRepo.update(target.id, updates);
    if (!updated) {
      return authErrorResponse('INTERNAL_ERROR', 'Update failed to persist.', 500) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Security activity logging
    if (updates.role && updates.role !== target.role) {
      await logSecurityActivity(user.uid, 'ROLE_CHANGED', 'TeamMember', target.id, {
        oldRole: target.role,
        newRole: updated.role,
        changedBy: actor.id,
      });
    }

    if (updates.status && updates.status !== target.status) {
      if (updates.status === 'SUSPENDED') {
        await logSecurityActivity(user.uid, 'TEAM_MEMBER_SUSPENDED', 'TeamMember', target.id, {
          previousStatus: target.status,
          suspendedBy: actor.id,
        });
      } else if (target.status === 'SUSPENDED' && updates.status === 'ACTIVE') {
        await logSecurityActivity(user.uid, 'TEAM_MEMBER_REACTIVATED', 'TeamMember', target.id, {
          previousStatus: target.status,
          reactivatedBy: actor.id,
        });
      } else {
        await logSecurityActivity(user.uid, 'UPDATE', 'TeamMember', target.id, {
          field: 'status',
          from: target.status,
          to: updates.status,
          updatedBy: actor.id,
        });
      }
    }

    return NextResponse.json<ApiResponse<TeamMember>>({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error(`[PATCH /api/team/${id}] Error:`, err);
    return authErrorResponse('INTERNAL_ERROR', 'Failed to update team member.', 500) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  const { user, member: actor, errorResponse } = await requirePermission(req, 'team.delete');
  if (errorResponse || !actor || !user) {
    return (errorResponse || authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
  }

  const { id } = await params;
  try {
    const teamRepo = getTeamMemberRepository();
    const target = await teamRepo.findById(id);

    if (!target) {
      return authErrorResponse(
        'TEAM_MEMBER_NOT_FOUND',
        `Team member with ID ${id} was not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
    }

    // Role check: Members can never delete team members
    if (actor.role === 'MEMBER') {
      return authErrorResponse(
        'FORBIDDEN',
        'Members do not have permission to delete team members.',
        403
      ) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
    }

    // Self-deletion check
    if (actor.id === target.id) {
      return authErrorResponse(
        'CANNOT_DELETE_SELF',
        'You cannot delete your own team member account.',
        403
      ) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
    }

    // Last OWNER protection check
    if (target.role === 'OWNER') {
      const activeOwners = await teamRepo.countActiveOwners();
      if (activeOwners <= 1) {
        return authErrorResponse(
          'CANNOT_REMOVE_LAST_OWNER',
          'Cannot delete the last remaining active agency OWNER.',
          422
        ) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
      }
    }

    await teamRepo.delete(id);

    await logSecurityActivity(user.uid, 'DELETE', 'TeamMember', id, {
      deletedRole: target.role,
      deletedEmail: target.email,
      deletedBy: actor.id,
    });

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
    });
  } catch (err) {
    console.error(`[DELETE /api/team/${id}] Error:`, err);
    return authErrorResponse('INTERNAL_ERROR', 'Failed to delete team member.', 500) as unknown as NextResponse<ApiResponse<{ deleted: boolean }>>;
  }
}
