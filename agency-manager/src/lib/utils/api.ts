// src/lib/utils/api.ts
// Server-side API utilities: auth extraction, error formatting, response helpers.

import { type NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth/firebase-admin';
import type { ApiResponse } from '@/lib/types';

/**
 * Extract and verify the Firebase ID token from the Authorization header.
 * Returns the decoded token payload or null.
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7);
  try {
    return await verifyIdToken(idToken);
  } catch {
    return null;
  }
}

/**
 * Require authentication — returns 401 if not authenticated.
 */
export async function requireAuth(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}

/**
 * Require admin authorization — returns 401 if unauthenticated, 403 if forbidden.
 * Delegated to centralized requirePermission(req, 'system.admin').
 */
export async function requireAdmin(req: NextRequest) {
  const { requirePermission } = await import('@/lib/auth/authorization');
  const { user, member, errorResponse } = await requirePermission(req, 'system.admin');
  return { user, member, response: errorResponse };
}

/**
 * Create a successful JSON response.
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

/**
 * Create an error JSON response.
 * Logs the full error server-side, returns a safe message to the client.
 */
export function errorResponse(
  safeMessage: string,
  status = 500,
  err?: unknown
): NextResponse {
  if (err) {
    console.error(`[API Error] ${safeMessage}:`, err);
  }
  return NextResponse.json<ApiResponse>(
    { success: false, error: safeMessage },
    { status }
  );
}

