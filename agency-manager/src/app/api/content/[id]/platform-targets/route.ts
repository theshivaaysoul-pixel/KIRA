// src/app/api/content/[id]/platform-targets/route.ts
// GET /api/content/:id/platform-targets — Get platform targets for a content item
// PUT /api/content/:id/platform-targets — Toggle platform target (ON/OFF) for a content item

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getDailyTargetService,
  DailyTargetServiceError,
} from '@/lib/services/daily-target-service';
import type { ApiResponse } from '@/lib/types';
import type {
  ContentPlatformTargetWithPlatform,
  ContentPlatformTarget,
} from '@/lib/types/domain';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'content.read');
  if (errorResponse) return errorResponse;

  const { id: contentId } = await context.params;

  try {
    const dailyTargetService = getDailyTargetService();
    await dailyTargetService.checkAndAutoArchiveIfAllCompleted(contentId);
    const targets = await dailyTargetService.getContentPlatformTargets(contentId);

    return NextResponse.json<ApiResponse<ContentPlatformTargetWithPlatform[]>>({
      success: true,
      data: targets,
    });
  } catch (err) {
    if (err instanceof DailyTargetServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[GET /api/content/${contentId}/platform-targets]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve content platform targets.' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id: contentId } = await context.params;

  try {
    const body = await req.json();
    const { platformId, enabled } = body;

    if (!platformId || typeof enabled !== 'boolean') {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Both "platformId" and boolean "enabled" are required.',
          },
        },
        { status: 400 }
      );
    }

    const dailyTargetService = getDailyTargetService();
    const updated = await dailyTargetService.setContentPlatformTarget(
      contentId,
      platformId,
      enabled,
      member!.id
    );

    return NextResponse.json<ApiResponse<ContentPlatformTarget>>({
      success: true,
      data: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          },
        },
        { status: 400 }
      );
    }
    if (err instanceof DailyTargetServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[PUT /api/content/${contentId}/platform-targets]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update content platform target.' } },
      { status: 500 }
    );
  }
}
