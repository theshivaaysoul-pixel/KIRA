// src/app/api/analytics/route.ts
// GET  /api/analytics — list analytics snapshots with filters and pagination
// POST /api/analytics — record a new analytics snapshot (ADMIN/OWNER only)

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getAnalyticsService, AnalyticsServiceError } from '@/lib/services/analytics-service';
import type { ApiResponse } from '@/lib/types';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'analytics.read');
  if (errorResponse) return errorResponse;

  const sp = req.nextUrl.searchParams;
  const filters = {
    socialAccountId: sp.get('socialAccountId') || undefined,
    platformId: sp.get('platformId') || undefined,
    contentId: sp.get('contentId') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
  };

  try {
    const svc = getAnalyticsService();
    const result = await svc.getSnapshots(filters, member!);
    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[GET /api/analytics]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve analytics.' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Only ADMIN/OWNER can record snapshots (data ingestion)
  const { member, errorResponse } = await requirePermission(req, 'analytics.read');
  if (errorResponse) return errorResponse;

  // Only allow admin-level roles to create snapshots
  if (!['OWNER', 'ADMIN'].includes(member!.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only OWNER or ADMIN roles can record analytics snapshots.' } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const svc = getAnalyticsService();
    const snapshot = await svc.recordSnapshot(body, member!);
    return NextResponse.json<ApiResponse<typeof snapshot>>({ success: true, data: snapshot }, { status: 201 });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[POST /api/analytics]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record analytics snapshot.' } },
      { status: 500 }
    );
  }
}
