// src/app/api/diagnostic/repository/route.ts
// Protected developer/admin diagnostic endpoint for repository verification.
// Runs the real CRUD, validation, relationship, and cleanup suite.
// Protected by 'system.admin' permission and admin rate limit.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';
import { runRepositoryDiagnostics, type RepositoryDiagnosticResult } from '@/lib/services/diagnostic-test-service';
import type { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting check
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'diagnostic-repo');
  if (rateLimitResponse) return rateLimitResponse;

  // Strictly require system.admin permission in all environments
  const { user, errorResponse: authError } = await requirePermission(req, 'system.admin');
  if (authError || !user) return authError!;

  try {
    const result = await runRepositoryDiagnostics();

    return NextResponse.json<ApiResponse<RepositoryDiagnosticResult>>({
      success: result.allPassed,
      data: result,
      ...(!result.allPassed && { error: 'One or more repository diagnostic tests failed' }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown diagnostic error';
    console.error('[API /api/diagnostic/repository] Failed:', err);

    return NextResponse.json<ApiResponse<RepositoryDiagnosticResult>>(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
