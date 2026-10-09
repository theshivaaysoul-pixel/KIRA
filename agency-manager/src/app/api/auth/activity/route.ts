// src/app/api/auth/activity/route.ts
// Records authentication lifecycle events (LOGIN / LOGOUT) to ActivityLog.
// Strictly prevents logging any tokens, passwords, cookies, or secrets.
// Enforces verified user identity — prevents spoofing arbitrary user IDs.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/authorization';
import { getActivityLogRepository } from '@/lib/repositories';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';
import type { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ logged: boolean }>>> {
  // Apply rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.AUTH, 'auth-activity');
  if (rateLimitResponse) return rateLimitResponse as unknown as NextResponse<ApiResponse<{ logged: boolean }>>;

  try {
    const user = await getCurrentUser(req).catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = body.action === 'LOGOUT' ? 'LOGOUT' : 'LOGIN';

    // Security: Only accept user ID from cryptographically verified token.
    // If token is missing, record as 'anonymous' and store unverified identifier in metadata.
    const isVerified = Boolean(user?.uid);
    const userId = isVerified ? user!.uid : 'anonymous';

    const activityRepo = getActivityLogRepository();
    await activityRepo.create({
      userId,
      action: action as 'LOGIN' | 'LOGOUT',
      entityType: 'UserSession',
      entityId: userId,
      metadata: {
        timestamp: new Date().toISOString(),
        verified: isVerified,
        ...(!isVerified && typeof body.uid === 'string' ? { unverifiedClaimedUid: body.uid.slice(0, 128) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: { logged: true },
    });
  } catch (err) {
    console.warn('[Activity Log API] Failed recording auth lifecycle:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to record activity',
    }, { status: 500 });
  }
}
