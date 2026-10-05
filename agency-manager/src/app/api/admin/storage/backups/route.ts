// src/app/api/admin/storage/backups/route.ts
// Admin-protected endpoint: List storage backups metadata with optional filtering and pagination.

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { getDataSafetyService } from '@/lib/storage';
import type { BackupReason } from '@/lib/storage/backup-types';

export async function GET(req: NextRequest) {
  const { user, errorResponse: authError } = await requirePermission(req, 'storage.read');
  if (authError || !user) return authError!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const resource = searchParams.get('resource') || undefined;
    const reason = (searchParams.get('reason') as BackupReason) || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const safetyService = getDataSafetyService();
    const result = await safetyService.listBackups({
      resource,
      reason,
      limit,
      offset,
    });

    return successResponse({
      backups: result.backups,
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    return errorResponse('Failed to retrieve backup list', 500, err);
  }
}
