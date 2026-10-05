// src/app/api/admin/storage/recover/route.ts
// Admin-protected endpoint: Controlled recovery of database collections from an existing backup.

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { getDataSafetyService } from '@/lib/storage';
import { InvalidBackupPathError, RecoveryError, StorageCorruptionError } from '@/lib/storage/errors';
import { getActivityLogRepository } from '@/lib/repositories';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'admin-recover');
  if (rateLimitResponse) return rateLimitResponse;

  const { user, errorResponse: authError } = await requirePermission(req, 'storage.recover');
  if (authError || !user) return authError!;

  let backupPath: string;
  try {
    const body = await req.json();
    backupPath = body.backupPath;
    if (!backupPath || typeof backupPath !== 'string') {
      return errorResponse('Missing required string field "backupPath"', 400);
    }
  } catch {
    return errorResponse('Invalid JSON body. Expected { backupPath: string }', 400);
  }

  const safetyService = getDataSafetyService();
  const activityRepo = getActivityLogRepository();

  try {
    const result = await safetyService.restoreBackup({
      backupPath,
      adminUserId: user.uid,
    });

    // Log the successful recovery event
    try {
      await activityRepo.create({
        userId: user.uid,
        action: 'UPDATE',
        entityType: 'StorageRecovery',
        entityId: backupPath,
        metadata: {
          operation: 'RECOVERY',
          backupPath,
          livePath: result.livePath,
          checksum: result.checksum,
          preRecoveryBackupPath: result.preRecoveryBackup?.backupPath,
        },
      });
    } catch (logErr) {
      console.warn('[Recovery] Failed logging activity:', logErr);
    }

    return successResponse({
      status: 'ok',
      message: 'Database collection restored successfully',
      livePath: result.livePath,
      preRecoveryBackup: result.preRecoveryBackup,
      checksum: result.checksum,
    });
  } catch (err) {
    if (err instanceof InvalidBackupPathError) {
      return errorResponse(err.message, 400, err);
    }
    if (err instanceof StorageCorruptionError) {
      return errorResponse(`Corruption detected: ${err.message}`, 422, err);
    }
    if (err instanceof RecoveryError) {
      return errorResponse(`Recovery failed: ${err.message}`, 422, err);
    }

    // Log the failure
    try {
      await activityRepo.create({
        userId: user.uid,
        action: 'PUBLISH_FAILED',
        entityType: 'StorageRecovery',
        entityId: backupPath,
        metadata: {
          operation: 'RECOVERY_FAILED',
          backupPath,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    } catch {
      // ignore secondary log error
    }

    return errorResponse('Failed to recover database collection from backup', 500, err);
  }
}
