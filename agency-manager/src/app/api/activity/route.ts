// src/app/api/activity/route.ts
// GET /api/activity — list real activity logs with server-side filtering and pagination

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getActivityLogService } from '@/lib/services/activity-log-service';
import type { ApiResponse } from '@/lib/types';
import type { ActivityAction } from '@/lib/types/domain';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'activity.read');
  if (errorResponse) return errorResponse;

  const sp = req.nextUrl.searchParams;

  const filters = {
    action: (sp.get('action') as ActivityAction | 'ALL') || undefined,
    userId: sp.get('userId') || undefined,
    entityType: sp.get('entityType') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    search: sp.get('search') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    sort: (sp.get('sort') as 'createdAt') || undefined,
    order: (sp.get('order') as 'asc' | 'desc') || 'desc',
  };

  try {
    const svc = getActivityLogService();
    const result = await svc.getLogs(filters);
    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error('[GET /api/activity]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve activity logs.' } },
      { status: 500 }
    );
  }
}
