// src/app/api/activity/[id]/route.ts
// GET /api/activity/:id — retrieve a single activity log entry

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getActivityLogService } from '@/lib/services/activity-log-service';
import type { ApiResponse } from '@/lib/types';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'activity.read');
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const svc = getActivityLogService();
    const log = await svc.getLogById(id);
    if (!log) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: 'NOT_FOUND', message: `Activity log "${id}" not found.` } },
        { status: 404 }
      );
    }
    return NextResponse.json<ApiResponse<typeof log>>({ success: true, data: log });
  } catch (err) {
    console.error(`[GET /api/activity/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve activity log.' } },
      { status: 500 }
    );
  }
}
