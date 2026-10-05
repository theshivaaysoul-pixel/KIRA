// src/app/api/auth/me/route.ts
// Returns the current authenticated user identity, mapped TeamMember, and granted permissions.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, authErrorResponse } from '@/lib/auth/authorization';
import { getRolePermissions, Permission } from '@/lib/auth/permissions';
import type { TeamMember, User, ApiResponse } from '@/lib/types';

export interface AuthMeData {
  user: User;
  teamMember: TeamMember;
  permissions: Permission[];
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<AuthMeData>>> {
  const context = await getCurrentTeamMember(req);

  if (context.status === 'UNAUTHENTICATED' || !context.user) {
    return authErrorResponse(
      'UNAUTHORIZED',
      context.error || 'Authentication credentials were not provided or are invalid.',
      401
    ) as unknown as NextResponse<ApiResponse<AuthMeData>>;
  }

  if (context.status === 'NO_TEAM_MEMBER' || !context.member) {
    return authErrorResponse(
      'NO_TEAM_MEMBER',
      'No associated TeamMember account exists for this authenticated identity.',
      403
    ) as unknown as NextResponse<ApiResponse<AuthMeData>>;
  }

  if (context.status === 'SUSPENDED') {
    return authErrorResponse(
      'ACCOUNT_SUSPENDED',
      'Your agency account has been suspended.',
      403
    ) as unknown as NextResponse<ApiResponse<AuthMeData>>;
  }

  if (context.status === 'INACTIVE') {
    return authErrorResponse(
      'ACCOUNT_INACTIVE',
      'Your agency account is inactive.',
      403
    ) as unknown as NextResponse<ApiResponse<AuthMeData>>;
  }

  if (context.status === 'INVITED') {
    return authErrorResponse(
      'ACCOUNT_INVITED',
      'Your agency account invitation is pending onboarding.',
      403
    ) as unknown as NextResponse<ApiResponse<AuthMeData>>;
  }

  const rolePermissions = getRolePermissions(context.member.role);
  const customPermissions = (context.member.customPermissions as Permission[]) || [];
  const permissions = Array.from(new Set([...rolePermissions, ...customPermissions]));

  const userProfile: User = {
    uid: context.user.uid,
    email: context.user.email ?? context.member.email,
    displayName: context.user.name ?? context.member.name,
    photoURL: context.user.picture ?? context.member.avatarUrl ?? null,
    emailVerified: context.user.email_verified ?? false,
  };

  return NextResponse.json<ApiResponse<AuthMeData>>(
    {
      success: true,
      data: {
        user: userProfile,
        teamMember: context.member,
        permissions,
      },
    },
    { status: 200 }
  );
}
