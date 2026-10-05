// src/app/api/analytics/accounts/[id]/route.ts
// GET /api/analytics/accounts/:id — get analytics summary for a specific SocialAccount

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
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;

  try {
    const svc = getAnalyticsService();
    const summary = await svc.getAccountSummary(
      id,
      member!,
      from && to ? { from, to } : undefined
    );
    return NextResponse.json<ApiResponse<typeof summary>>({ success: true, data: summary });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[GET /api/analytics/accounts/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve account analytics.' } },
      { status: 500 }
    );
  }
}
