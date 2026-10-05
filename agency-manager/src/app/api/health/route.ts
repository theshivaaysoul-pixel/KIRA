// src/app/api/health/route.ts
// Basic application health check endpoint.
// Returns application status, environment readiness, and storage availability.
// Does NOT expose secrets or credentials.

import { NextResponse } from 'next/server';
import type { ApiResponse, HealthStatus } from '@/lib/types';

export async function GET(): Promise<NextResponse> {
  const status: HealthStatus = {
    app: 'ok',
    auth: 'unconfigured',
    storage: 'unconfigured',
    timestamp: new Date().toISOString(),
  };

  // Check Firebase config presence (env vars or service account credentials)
  const hasFirebaseConfig =
    (!!process.env.FIREBASE_PROJECT_ID &&
      !!process.env.FIREBASE_CLIENT_EMAIL &&
      !!process.env.FIREBASE_PRIVATE_KEY) ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  status.auth = hasFirebaseConfig ? 'ok' : 'unconfigured';

  // Check Storage config presence (Google Drive or GCS)
  const hasStorageConfig =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (!!process.env.GOOGLE_DRIVE_CLIENT_ID && !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) ||
    (!!process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
      (!!process.env.GOOGLE_CLOUD_CLIENT_EMAIL || !!process.env.GOOGLE_CLOUD_PROJECT_ID));

  status.storage = hasStorageConfig ? 'ok' : 'unconfigured';

  const httpStatus = status.app === 'ok' ? 200 : 500;

  return NextResponse.json<ApiResponse<HealthStatus>>(
    { success: true, data: status },
    { status: httpStatus }
  );
}
