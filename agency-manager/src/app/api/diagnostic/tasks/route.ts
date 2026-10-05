// src/app/api/diagnostic/tasks/route.ts
// Protected developer/admin diagnostic endpoint for Task Management verification (Phase 10).
// Executes full lifecycle: CRUD, workflow transitions, validation, notifications, and cleanup.
// Protected by 'system.admin' permission and admin rate limit.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';
import { runTaskDiagnostics, type TaskDiagnosticResult } from '@/lib/services/task-diagnostic-service';
import type { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting check
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'diagnostic-tasks');
  if (rateLimitResponse) return rateLimitResponse;

  // Strictly require system.admin permission
  const { user, errorResponse: authError } = await requirePermission(req, 'system.admin');
  if (authError || !user) return authError!;

  try {
    const result = await runTaskDiagnostics();

    return NextResponse.json<ApiResponse<TaskDiagnosticResult>>({
      success: result.allPassed,
      data: result,
      ...(!result.allPassed && { error: 'One or more task diagnostic tests failed' }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown task diagnostic error';
    console.error('[API /api/diagnostic/tasks] Failed:', err);

    return NextResponse.json<ApiResponse<TaskDiagnosticResult>>(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
