// src/app/api/dashboard/overview/route.ts
// Server-side dashboard overview endpoint aggregating real operational data.
// Protected by 'dashboard.read' permission and role-aware filtering.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import { getDashboardService } from '@/lib/services/dashboard-service';
import type { ApiResponse, DashboardOverviewData } from '@/lib/types';

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<DashboardOverviewData>>> {
  const { member, errorResponse } = await requirePermission(req, 'dashboard.read');
  if (errorResponse || !member) {
    return (errorResponse ||
      authErrorResponse('UNAUTHORIZED', 'Authentication required', 401)) as unknown as NextResponse<
      ApiResponse<DashboardOverviewData>
    >;
  }

  try {
    const dashboardService = getDashboardService();
    const overview = await dashboardService.getDashboardOverview(member);

    return NextResponse.json<ApiResponse<DashboardOverviewData>>({
      success: true,
      data: overview,
    });
  } catch (err) {
    console.error('[GET /api/dashboard/overview] Error loading dashboard data:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to load dashboard overview data.',
      500,
      err instanceof Error ? err.message : String(err)
    ) as unknown as NextResponse<ApiResponse<DashboardOverviewData>>;
  }
}
