// src/app/api/content/bin/route.ts
// DELETE /api/content/bin — empty the recycle bin permanently

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { emptyBin } from '@/lib/services/content-service';
import type { ApiResponse } from '@/lib/types';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.delete');
  if (errorResponse) return errorResponse;

  try {
    const result = await emptyBin(member!);
    return NextResponse.json<ApiResponse<{ deletedCount: number }>>({
      success: true,
      data: result,
      message: `Permanently removed ${result.deletedCount} item(s) from the Bin.`,
    } as ApiResponse<{ deletedCount: number }> & { message: string });
  } catch (err) {
    console.error('[DELETE /api/content/bin]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to empty recycle bin.' } },
      { status: 500 }
    );
  }
}
