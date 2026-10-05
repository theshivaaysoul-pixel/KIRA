// src/app/api/analytics/[id]/route.ts
// GET    /api/analytics/:id — retrieve a single snapshot
// DELETE /api/analytics/:id — delete a snapshot (ADMIN/OWNER only)

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getAnalyticsService, AnalyticsServiceError } from '@/lib/services/analytics-service';
import type { ApiResponse } from '@/lib/types';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'analytics.read');
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const svc = getAnalyticsService();
    const snapshot = await svc.getSnapshotById(id, member!);
    return NextResponse.json<ApiResponse<typeof snapshot>>({ success: true, data: snapshot });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[GET /api/analytics/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve analytics snapshot.' } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'analytics.read');
  if (errorResponse) return errorResponse;

  if (!['OWNER', 'ADMIN'].includes(member!.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only OWNER or ADMIN roles can delete analytics snapshots.' } },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    const svc = getAnalyticsService();
    const deleted = await svc.deleteSnapshot(id, member!);
    if (!deleted) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: 'NOT_FOUND', message: `Analytics snapshot "${id}" not found.` } },
        { status: 404 }
      );
    }
    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({ success: true, data: { deleted: true } });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[DELETE /api/analytics/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete analytics snapshot.' } },
      { status: 500 }
    );
  }
}
