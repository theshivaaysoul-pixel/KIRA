// src/app/api/admin/data-health/route.ts
// Phase 16 — Admin Data Health & Integrity API
//
// GET /api/admin/data-health
// Protected by 'system.admin' permission.
// Returns real, un-faked health status across application, authentication,
// storage, all 11 JSON collections, relationships, duplicate detection, and backup checksums.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getDataHealthService } from '@/lib/services/data-health-service';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'admin-data-health');
  if (rateLimitResponse) return rateLimitResponse;

  const { user, errorResponse: authError } = await requirePermission(req, 'system.admin');
  if (authError || !user) return authError!;

  try {
    const service = getDataHealthService();
    const report = await service.runHealthCheck();

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error('[API /api/admin/data-health] Health check failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DATA_HEALTH_CHECK_FAILED',
          message: err instanceof Error ? err.message : 'Failed to execute data health diagnostic',
        },
      },
      { status: 500 }
    );
  }
}
