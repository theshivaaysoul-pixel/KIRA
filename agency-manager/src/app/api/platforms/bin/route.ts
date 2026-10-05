// src/app/api/platforms/bin/route.ts
// DELETE /api/platforms/bin — empty the platform recycle bin permanently

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getPlatformService } from '@/lib/services/platform-service';
import type { ApiResponse } from '@/lib/types';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'platforms.delete');
  if (errorResponse) return errorResponse;

  try {
    const platformService = getPlatformService();
    const result = await platformService.emptyBin(member!);

    const message = result.blockedCount > 0
      ? `Permanently removed ${result.deletedCount} platform(s) from the Bin. (${result.blockedCount} platform(s) skipped because accounts are connected)`
      : `Permanently removed ${result.deletedCount} platform(s) from the Bin.`;

    return NextResponse.json<ApiResponse<{ deletedCount: number; blockedCount: number }>>({
      success: true,
      data: result,
      message,
    } as ApiResponse<{ deletedCount: number; blockedCount: number }> & { message: string });
  } catch (err) {
    console.error('[DELETE /api/platforms/bin]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to empty recycle bin.' } },
      { status: 500 }
    );
  }
}
