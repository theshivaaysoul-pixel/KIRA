// src/app/api/platforms/[id]/restore/route.ts
// POST /api/platforms/:id/restore — restore platform from Bin

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getPlatformService,
  PlatformNotFoundError,
} from '@/lib/services/platform-service';
import type { ApiResponse } from '@/lib/types';
import type { Platform } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'platforms.update');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const platformService = getPlatformService();
    const restored = await platformService.restoreFromBin(member!, id);

    return NextResponse.json<ApiResponse<Platform>>({
      success: true,
      data: restored,
      message: `Restored platform "${restored.name}" successfully.`,
    } as ApiResponse<Platform> & { message: string });
  } catch (err) {
    if (err instanceof PlatformNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    console.error(`[POST /api/platforms/${id}/restore] Error:`, err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: 'RESTORE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to restore platform.',
        },
      },
      { status: 400 }
    );
  }
}
