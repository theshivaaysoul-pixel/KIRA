// src/app/api/tasks/daily/[date]/route.ts
// GET /api/tasks/daily/:date — Get daily content target for specific calendar date

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getDailyTargetService,
  DailyTargetServiceError,
} from '@/lib/services/daily-target-service';
import type { ApiResponse } from '@/lib/types';
import type { DailyContentTargetWithRelations } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ date: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'tasks.read');
  if (errorResponse) return errorResponse;

  const { date } = await context.params;

  try {
    const dailyTargetService = getDailyTargetService();
    const result = await dailyTargetService.getDailyTarget(date);

    return NextResponse.json<ApiResponse<DailyContentTargetWithRelations>>({
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
    console.error(`[GET /api/tasks/daily/${date}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve daily content target.' } },
      { status: 500 }
    );
  }
}
