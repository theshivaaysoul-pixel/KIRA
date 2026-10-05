// src/app/api/platforms/[id]/route.ts
// Protected API endpoints for retrieving, updating, and deleting individual social platforms.
// Enforces relationship protection and platforms.read/update/delete permissions.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import {
  getPlatformService,
  PlatformNotFoundError,
  PlatformSlugExistsError,
  PlatformInUseError,
} from '@/lib/services/platform-service';
import { UpdatePlatformSchema } from '@/lib/validation';
import type { ApiResponse } from '@/lib/types';
import type { Platform, PlatformWithStats } from '@/lib/types/domain';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<PlatformWithStats>>> {
  const { errorResponse } = await requirePermission(req, 'platforms.read');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<PlatformWithStats>>;
  }

  const { id } = await params;
  try {
    const platformService = getPlatformService();
    const platform = await platformService.getPlatformById(id);

    if (!platform) {
      return authErrorResponse(
        'PLATFORM_NOT_FOUND',
        `Platform with ID "${id}" was not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<PlatformWithStats>>;
    }

    return NextResponse.json<ApiResponse<PlatformWithStats>>({
      success: true,
      data: platform,
    });
  } catch (err) {
    console.error(`[GET /api/platforms/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve social platform details.',
      500
    ) as unknown as NextResponse<ApiResponse<PlatformWithStats>>;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Platform>>> {
  const { member: actor, user, errorResponse } = await requirePermission(req, 'platforms.update');
  if (errorResponse || !actor || !user) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<
      ApiResponse<Platform>
    >;
  }

  const { id } = await params;
  try {
    const body = await req.json();

    // Strip attempts to mutate system-assigned fields
    const { id: _ignoreId, createdAt: _ignoreCreated, updatedAt: _ignoreUpdated, ...cleanUpdates } = body;

    const validationResult = UpdatePlatformSchema.safeParse(cleanUpdates);
    if (!validationResult.success) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        'Invalid platform update payload.',
        400,
        validationResult.error.format()
      ) as unknown as NextResponse<ApiResponse<Platform>>;
    }

    const platformService = getPlatformService();
    const updated = await platformService.updatePlatform(actor, id, validationResult.data);

    return NextResponse.json<ApiResponse<Platform>>({
      success: true,
      data: updated,
    });
  } catch (err) {
    if (err instanceof PlatformNotFoundError) {
      return authErrorResponse(
        'PLATFORM_NOT_FOUND',
        err.message,
        404
      ) as unknown as NextResponse<ApiResponse<Platform>>;
    }

    if (err instanceof PlatformSlugExistsError) {
      return authErrorResponse(
        'PLATFORM_SLUG_EXISTS',
        err.message,
        409
      ) as unknown as NextResponse<ApiResponse<Platform>>;
    }

    console.error(`[PATCH /api/platforms/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to update social platform.',
      500
    ) as unknown as NextResponse<ApiResponse<Platform>>;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>>> {
  const { member: actor, user, errorResponse } = await requirePermission(req, 'platforms.delete');
  if (errorResponse || !actor || !user) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)) as unknown as NextResponse<
      ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>
    >;
  }

  const { id } = await params;
  try {
    const isPermanent = req.nextUrl.searchParams.get('permanent') === 'true';
    const platformService = getPlatformService();
    const result = await platformService.deletePlatform(actor, id, isPermanent);

    return NextResponse.json<ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>>({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof PlatformNotFoundError) {
      return authErrorResponse(
        'PLATFORM_NOT_FOUND',
        err.message,
        404
      ) as unknown as NextResponse<ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>>;
    }

    if (err instanceof PlatformInUseError) {
      return authErrorResponse(
        'PLATFORM_IN_USE',
        err.message,
        409,
        { accountCount: err.accountCount }
      ) as unknown as NextResponse<ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>>;
    }

    console.error(`[DELETE /api/platforms/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to delete social platform.',
      500
    ) as unknown as NextResponse<ApiResponse<{ success: boolean; deletedId: string; movedToBin: boolean }>>;
  }
}
