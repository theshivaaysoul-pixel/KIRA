// src/app/api/content-publications/[id]/status/route.ts
// GET /api/content-publications/:id/status
// Returns current publication status including optional live platform status.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getPublishingService, PublishingServiceError } from '@/lib/services/publishing-service';
import type { ApiResponse } from '@/lib/types';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { errorResponse } = await requirePermission(req, 'calendar.read');
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const svc = getPublishingService();
    const status = await svc.getStatus(id);
    return NextResponse.json<ApiResponse<typeof status>>({ success: true, data: status });
  } catch (err) {
    if (err instanceof PublishingServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[GET /api/content-publications/${id}/status]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get publication status.' } },
      { status: 500 }
    );
  }
}
