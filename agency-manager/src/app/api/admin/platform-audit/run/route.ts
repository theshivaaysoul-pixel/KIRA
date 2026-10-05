// src/app/api/admin/platform-audit/run/route.ts
// Phase 20 — Trigger Dynamic Platform Audit & Lifecycle Test
//
// POST /api/admin/platform-audit/run
// Protected by 'system.admin' permission.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getPlatformAuditService } from '@/lib/services/platform-audit-service';

export async function POST(req: NextRequest): Promise<NextResponse> {
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
    console.error('[POST /api/admin/platform-audit/run] Audit run failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PLATFORM_AUDIT_RUN_FAILED',
          message: err instanceof Error ? err.message : 'Failed to run platform audit',
        },
      },
      { status: 500 }
    );
  }
}
