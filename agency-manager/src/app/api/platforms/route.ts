// src/app/api/platforms/route.ts
// Protected API endpoints for listing and creating social platforms.
// Enforces platforms.read and platforms.create permissions.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import { getPlatformService, PlatformSlugExistsError } from '@/lib/services/platform-service';
import { CreatePlatformSchema } from '@/lib/validation';
import type { ApiResponse } from '@/lib/types';
import type { Platform, PlatformQueryResult, PlatformCapability } from '@/lib/types/domain';
import { PLATFORM_CAPABILITIES } from '@/lib/types/domain';

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<PlatformQueryResult>>> {
  const { errorResponse } = await requirePermission(req, 'platforms.read');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<PlatformQueryResult>>;
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const capabilityParam = searchParams.get('capability') as PlatformCapability | null;
    const sort = searchParams.get('sort') as 'name' | 'createdAt' | 'updatedAt' | 'isActive' | null;
    const order = searchParams.get('order') as 'asc' | 'desc' | null;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    let isActive: boolean | 'all' = 'all';
    if (isActiveParam === 'true') isActive = true;
    else if (isActiveParam === 'false') isActive = false;

    const capability =
      capabilityParam && PLATFORM_CAPABILITIES.includes(capabilityParam)
        ? capabilityParam
        : undefined;

    const viewParam = searchParams.get('view');
    const view: 'active' | 'bin' = viewParam === 'bin' ? 'bin' : 'active';

    const platformService = getPlatformService();
    const result = await platformService.listPlatforms({
      search,
      isActive,
      capability,
      sort: sort || 'name',
      order: order || 'asc',
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 50 : limit,
      view,
    });

    return NextResponse.json<ApiResponse<PlatformQueryResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[GET /api/platforms] Error fetching platforms:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve social platforms.',
      500
    ) as unknown as NextResponse<ApiResponse<PlatformQueryResult>>;
  }
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Platform>>> {
  const { member: actor, user, errorResponse } = await requirePermission(req, 'platforms.create');
  if (errorResponse || !actor || !user) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<
      ApiResponse<Platform>
    >;
  }

  try {
    const body = await req.json();
    const validationResult = CreatePlatformSchema.safeParse(body);

    if (!validationResult.success) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'Invalid platform payload. Please verify name, slug, icon, and capabilities.',
        400,
        validationResult.error.format()
      ) as unknown as NextResponse<ApiResponse<Platform>>;
    }

    const platformService = getPlatformService();
    const created = await platformService.createPlatform(actor, validationResult.data);

    return NextResponse.json<ApiResponse<Platform>>(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof PlatformSlugExistsError) {
      return authErrorResponse(
        'PLATFORM_SLUG_EXISTS',
        err.message,
        409
      ) as unknown as NextResponse<ApiResponse<Platform>>;
    }

    console.error('[POST /api/platforms] Error creating platform:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to create social platform.',
      500
    ) as unknown as NextResponse<ApiResponse<Platform>>;
  }
}
