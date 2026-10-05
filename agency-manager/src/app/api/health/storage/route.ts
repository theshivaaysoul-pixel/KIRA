// src/app/api/health/storage/route.ts
// GCS storage health check endpoint.
// Performs a real write → read → delete test cycle on the configured bucket.
// Returns safe status messages — never exposes credentials.
// Protected by 'storage.read' permission and rate limiting.

import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/storage';
import { requirePermission } from '@/lib/auth/authorization';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';
import type { ApiResponse, StorageCheckResult } from '@/lib/types';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Rate limiting check
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.ADMIN, 'health-storage');
  if (rateLimitResponse) return rateLimitResponse;

  // Require storage.read permission to access the storage diagnostic
  const { user, errorResponse: authError } = await requirePermission(req, 'storage.read');
  if (authError || !user) return authError!;

  try {
    const storageService = getStorageService();
    const health = await storageService.healthCheck();

    const result: StorageCheckResult = {
      connection: health.connection ? 'ok' : 'error',
      bucketAccess: health.bucketAccess ? 'ok' : 'error',
      readTest: health.readTest ? 'ok' : 'error',
      writeTest: health.writeTest ? 'ok' : 'error',
      deleteTest: health.deleteTest ? 'ok' : 'error',
      ...(health.error && { error: health.error }),
    };

    const allPassed =
      health.connection &&
      health.bucketAccess &&
      health.readTest &&
      health.writeTest &&
      health.deleteTest;

    return NextResponse.json<ApiResponse<StorageCheckResult>>(
      { success: allPassed, data: result, ...(health.error && { error: health.error }) },
      { status: allPassed ? 200 : 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown storage error';
    // Log full error server-side
    console.error('[API /health/storage] Storage check failed:', err);

    // Return safe message to client
    const result: StorageCheckResult = {
      connection: 'error',
      bucketAccess: 'idle',
      readTest: 'idle',
      writeTest: 'idle',
      deleteTest: 'idle',
      error: 'Storage configuration error. Check server logs.',
    };

    return NextResponse.json<ApiResponse<StorageCheckResult>>(
      { success: false, data: result, error: message.includes('GOOGLE_CLOUD') ? message : 'Storage configuration error. Check server logs.' },
      { status: 500 }
    );
  }
}
