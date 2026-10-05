// src/app/api/admin/storage/backup/route.ts
// Admin-protected endpoint: Trigger manual backup of database JSON collections.

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { getDataSafetyService } from '@/lib/storage';
import { DATABASE_RESOURCES, type DatabaseResourceName } from '@/lib/storage/backup-types';
import { getActivityLogRepository } from '@/lib/repositories';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'admin-backup');
  if (rateLimitResponse) return rateLimitResponse;

  const { user, errorResponse: authError } = await requirePermission(req, 'storage.backup');
  if (authError || !user) return authError!;

  try {
    let body: { resource?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const safetyService = getDataSafetyService();
    const activityRepo = getActivityLogRepository();

    const resourcesToBackup: Array<{ name: DatabaseResourceName; path: string }> = [];
    if (body.resource) {
      if (!(body.resource in DATABASE_RESOURCES)) {
        return errorResponse(`Invalid resource "${body.resource}". Allowed: ${Object.keys(DATABASE_RESOURCES).join(', ')}`, 400);
      }
      const resName = body.resource as DatabaseResourceName;
      resourcesToBackup.push({ name: resName, path: DATABASE_RESOURCES[resName] });
    } else {
      for (const [name, path] of Object.entries(DATABASE_RESOURCES)) {
        resourcesToBackup.push({ name: name as DatabaseResourceName, path });
      }
    }

    const results: Array<{
      resource: string;
      sourcePath: string;
      backupPath?: string;
      status: 'success' | 'skipped' | 'failed';
      checksum?: string;
      error?: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;

    for (const { name, path } of resourcesToBackup) {
      try {
        const backup = await safetyService.createBackup(path, 'MANUAL_BACKUP');
        if (!backup) {
          results.push({
            resource: name,
            sourcePath: path,
            status: 'skipped',
          });
          continue;
        }

        results.push({
          resource: name,
          sourcePath: path,
          backupPath: backup.backupPath,
          status: 'success',
          checksum: backup.checksum,
        });
        successCount++;
      } catch (err) {
        console.error(`[Manual Backup] Failed for ${name} (${path}):`, err);
        results.push({
          resource: name,
          sourcePath: path,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        failedCount++;
      }
    }

    // Log the event in ActivityLog
    try {
      await activityRepo.create({
        userId: user.uid,
        action: failedCount > 0 && successCount === 0 ? 'PUBLISH_FAILED' : 'CREATE',
        entityType: 'StorageBackup',
        entityId: `backup-${Date.now()}`,
        metadata: {
          operation: 'MANUAL_BACKUP',
          successCount,
          failedCount,
          total: resourcesToBackup.length,
        },
      });
    } catch (logErr) {
      console.warn('[Manual Backup] Failed recording activity log:', logErr);
    }

    return successResponse({
      status: failedCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'failed',
      backedUp: successCount,
      failed: failedCount,
      total: resourcesToBackup.length,
      results,
    });
  } catch (err) {
    return errorResponse('Manual backup process encountered an internal error', 500, err);
  }
}
