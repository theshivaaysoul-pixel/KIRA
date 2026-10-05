// src/app/api/content-publications/[id]/retry/route.ts
// POST /api/content-publications/:id/retry
// Retry a FAILED publication through the real publishing engine.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getPublishingService, PublishingServiceError } from '@/lib/services/publishing-service';
import type { ApiResponse } from '@/lib/types';

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.update');
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const svc = getPublishingService();
    const result = await svc.retry(id, member!);
    const httpStatus = result.status === 'PUBLISHED' ? 200 : 422;
    return NextResponse.json<ApiResponse<typeof result>>(
      { success: result.status === 'PUBLISHED', data: result },
      { status: httpStatus }
    );
  } catch (err) {
    if (err instanceof PublishingServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[POST /api/content-publications/${id}/retry]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Retry failed unexpectedly.' } },
      { status: 500 }
    );
  }
}
