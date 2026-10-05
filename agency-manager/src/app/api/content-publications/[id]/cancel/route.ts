// src/app/api/content-publications/[id]/cancel/route.ts
// POST /api/content-publications/:id/cancel

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
    const publication = await svc.cancel(id, member!);
    return NextResponse.json<ApiResponse<typeof publication>>({ success: true, data: publication });
  } catch (err) {
    if (err instanceof PublishingServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[POST /api/content-publications/${id}/cancel]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Cancel failed.' } },
      { status: 500 }
    );
  }
}
