// src/app/api/admin/platform-audit/route.ts
// Phase 20 — Dynamic Platform Test & Audit API
//
// GET /api/admin/platform-audit
// Protected by 'system.admin' permission.
// Audits real platform inventory, capabilities, adapter availability,
// external connection states, publishing & analytics compatibility, and generic code integrity.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getPlatformAuditService } from '@/lib/services/platform-audit-service';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'admin-platform-audit');
  if (rateLimitResponse) return rateLimitResponse;

  const { user, member, errorResponse: authError } = await requirePermission(req, 'system.admin');
  if (authError || !user) return authError!;

  try {
    const service = getPlatformAuditService();
    const report = await service.runAudit(member ? { id: member.id, email: member.email } : undefined);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error('[GET /api/admin/platform-audit] Audit execution failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PLATFORM_AUDIT_FAILED',
          message: err instanceof Error ? err.message : 'Failed to execute platform audit',
        },
      },
      { status: 500 }
    );
  }
}
