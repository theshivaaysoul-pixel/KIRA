// src/app/api/tasks/daily/route.ts
// GET  /api/tasks/daily?date=YYYY-MM-DD — Get daily content target for date (defaults to today in agency timezone)
// PUT  /api/tasks/daily — Create or update daily content targets for a date

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getDailyTargetService,
  DailyTargetServiceError,
} from '@/lib/services/daily-target-service';
import type { ApiResponse } from '@/lib/types';
import type { DailyContentTargetWithRelations } from '@/lib/types/domain';
import { z } from 'zod';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'tasks.read');
  if (errorResponse) return errorResponse;

  try {
    const dailyTargetService = getDailyTargetService();
    const dateParam = req.nextUrl.searchParams.get('date');
    const dateStr = dateParam || (await dailyTargetService.getAgencyDateString());

    const result = await dailyTargetService.getDailyTarget(dateStr);

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
    console.error('[GET /api/tasks/daily]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve daily content targets.' } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  // Creating or modifying daily targets requires tasks.create or tasks.update
  const { member, errorResponse } = await requirePermission(req, 'tasks.update');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const dailyTargetService = getDailyTargetService();

    const { date, platformTargets, additionalDates } = body;
    if (!date || !Array.isArray(platformTargets)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Both "date" (YYYY-MM-DD) and "platformTargets" array are required.',
          },
        },
        { status: 400 }
      );
    }

    const updated = await dailyTargetService.updateDailyTargets(
      date,
      platformTargets,
      member!.id
    );

    // If caller specified additional upcoming dates (e.g. tomorrow, next 7 days), set targets for them too
    if (Array.isArray(additionalDates) && additionalDates.length > 0) {
      for (const extraDate of additionalDates) {
        if (typeof extraDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extraDate) && extraDate !== date) {
          await dailyTargetService.updateDailyTargets(
            extraDate,
            platformTargets,
            member!.id
          );
        }
      }
    }

    return NextResponse.json<ApiResponse<DailyContentTargetWithRelations>>({
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
    console.error('[PUT /api/tasks/daily]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update daily content targets.' } },
      { status: 500 }
    );
  }
}
