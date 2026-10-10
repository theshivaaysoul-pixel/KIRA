// src/app/api/team/route.ts
// Protected API endpoints for listing and creating agency team members.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse, logSecurityActivity } from '@/lib/auth/authorization';
import {
  isAgencyOwnerEmail,
  isAgencyManagerEmail,
  isOwnerOrManagerEmail,
} from '@/lib/auth/permissions';
import { getTeamMemberRepository } from '@/lib/repositories';
import { CreateTeamMemberSchema } from '@/lib/validation';
import type { ApiResponse, TeamMember } from '@/lib/types';

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<TeamMember[]>>> {
  const { errorResponse } = await requirePermission(req, 'team.read');
  if (errorResponse) return errorResponse as unknown as NextResponse<ApiResponse<TeamMember[]>>;

  try {
    const teamRepo = getTeamMemberRepository();
    const members = await teamRepo.findAll();
    return NextResponse.json<ApiResponse<TeamMember[]>>({
      success: true,
      data: members,
    });
  } catch (err) {
    console.error('[GET /api/team] Error fetching team members:', err);
    return authErrorResponse('INTERNAL_ERROR', 'Failed to retrieve team members.', 500) as unknown as NextResponse<ApiResponse<TeamMember[]>>;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<TeamMember>>> {
  const { user, member: actor, errorResponse } = await requirePermission(req, 'team.create');
  if (errorResponse || !actor || !user) {
    return (errorResponse || authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }

  try {
    const body = await req.json();
    const validationResult = CreateTeamMemberSchema.safeParse(body);

    if (!validationResult.success) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'Invalid team member payload',
        400,
        validationResult.error.format()
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const payload = validationResult.data;

    // Global rule: Only designated Owners (theshivaaysoul@gmail.com, meenasumit220@gmail.com) and Manager (teamofkira@gmail.com) can hold elevated roles
    const targetEmail = payload.email.trim().toLowerCase();
    if (payload.role === 'OWNER' && !isAgencyOwnerEmail(targetEmail)) {
      return authErrorResponse(
        'FORBIDDEN_OWNER_ROLE_RESTRICTED',
        'Only authorized agency owners (theshivaaysoul@gmail.com, meenasumit220@gmail.com) can hold the Owner role. Please contact the Owner or Manager of KIRA Agency.',
        403
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }
    if (payload.role === 'MANAGER' && !isAgencyManagerEmail(targetEmail)) {
      return authErrorResponse(
        'FORBIDDEN_MANAGER_ROLE_RESTRICTED',
        'Only the authorized agency manager (teamofkira@gmail.com) can hold the Manager role. Please contact the Owner or Manager of KIRA Agency.',
        403
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }
    if (payload.role === 'ADMIN' && !isOwnerOrManagerEmail(targetEmail)) {
      return authErrorResponse(
        'FORBIDDEN_ADMIN_ROLE_RESTRICTED',
        'Administrative roles are restricted. Please contact an Owner or Manager of KIRA Agency.',
        403
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Only an OWNER can assign OWNER role
    if (payload.role === 'OWNER' && actor.role !== 'OWNER') {
      return authErrorResponse(
        'FORBIDDEN_CANNOT_ASSIGN_OWNER',
        'Only an existing OWNER can invite or assign the OWNER role.',
        403
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    // Members cannot assign elevated roles (Owner, Manager, Admin)
    if (actor.role === 'MEMBER' && (payload.role === 'OWNER' || payload.role === 'MANAGER' || payload.role === 'ADMIN')) {
      return authErrorResponse(
        'FORBIDDEN_ELEVATED_ROLE',
        'Members cannot assign elevated administrative roles.',
        403
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const teamRepo = getTeamMemberRepository();

    // Check if email already exists
    const existing = await teamRepo.findByEmail(payload.email);
    if (existing) {
      return authErrorResponse(
        'EMAIL_ALREADY_EXISTS',
        `A team member with email ${payload.email} already exists.`,
        409
      ) as unknown as NextResponse<ApiResponse<TeamMember>>;
    }

    const created = await teamRepo.create(payload);

    await logSecurityActivity(user.uid, 'CREATE', 'TeamMember', created.id, {
      role: created.role,
      status: created.status,
      email: created.email,
      createdBy: actor.id,
    });

    return NextResponse.json<ApiResponse<TeamMember>>(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/team] Error creating team member:', err);
    return authErrorResponse('INTERNAL_ERROR', 'Failed to create team member.', 500) as unknown as NextResponse<ApiResponse<TeamMember>>;
  }
}
