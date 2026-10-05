// src/app/api/platforms/seed/route.ts
// Idempotent seeding endpoint for default social media platforms.
// Requires platforms.create permission.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import { getPlatformService, PlatformSeedResult } from '@/lib/services/platform-service';
import type { ApiResponse } from '@/lib/types';

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<PlatformSeedResult>>> {
  const { member: actor, user, errorResponse } = await requirePermission(req, 'platforms.create');
  if (errorResponse || !actor || !user) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<
      ApiResponse<PlatformSeedResult>
    >;
  }

  try {
    const platformService = getPlatformService();
    const result = await platformService.seedDefaultPlatforms(actor);

    return NextResponse.json<ApiResponse<PlatformSeedResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[POST /api/platforms/seed] Error seeding platforms:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to execute platform seed operation.',
      500
    ) as unknown as NextResponse<ApiResponse<PlatformSeedResult>>;
  }
}
