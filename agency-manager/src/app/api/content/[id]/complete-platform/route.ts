// src/app/api/content/[id]/complete-platform/route.ts
// POST /api/content/:id/complete-platform — Record verified platform completion for a content item
// Automatically marks content target completed and idempotently increments today's daily target count

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getDailyTargetService,
  DailyTargetServiceError,
} from '@/lib/services/daily-target-service';
import type { ApiResponse } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id: contentId } = await context.params;

  try {
    const body = await req.json();
    const { platformId, completed = true, allTargeted = false, source = 'MANUAL', timestamp } = body;
    const dailyTargetService = getDailyTargetService();

    // Batch toggle across all targeted platforms for this content item
    if (allTargeted || (!platformId && completed !== undefined)) {
      const result = await dailyTargetService.toggleContentTaskCompletion({
        contentId,
        completed: Boolean(completed),
        actorId: member!.id,
        timestamp,
      });

      return NextResponse.json<ApiResponse<typeof result>>({
        success: true,
        data: result,
      });
    }

    if (!platformId) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '"platformId" or "allTargeted" is required.',
          },
        },
        { status: 400 }
      );
    }

    if (completed === false) {
      const result = await dailyTargetService.unmarkOperationCompletion({
        contentId,
        platformId,
        actorId: member!.id,
        timestamp,
      });

      return NextResponse.json<ApiResponse<typeof result>>({
        success: true,
        data: result,
      });
    }

    const result = await dailyTargetService.recordOperationCompletion({
      contentId,
      platformId,
      actorId: member!.id,
      source,
      timestamp,
    });

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof DailyTargetServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[POST /api/content/${contentId}/complete-platform]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record platform completion.' } },
      { status: 500 }
    );
  }
}
