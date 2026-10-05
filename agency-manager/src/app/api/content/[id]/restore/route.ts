// src/app/api/content/[id]/restore/route.ts
// POST /api/content/:id/restore — restore content from Bin or Archived

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getContentById,
  restoreFromBin,
  restoreFromArchived,
  ContentNotFoundError,
  WorkflowError,
} from '@/lib/services/content-service';
import type { ApiResponse } from '@/lib/types';
import type { ContentWithRelations, ContentStatus } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const existing = await getContentById(id, member!);
    let restored: ContentWithRelations;

    if (existing.deletedAt) {
      // In Bin: restore from bin
      restored = await restoreFromBin(id, member!);
    } else if (existing.status === 'ARCHIVED') {
      // In Archived: restore from archived
      let targetStatus: ContentStatus | undefined;
      try {
        const body = await req.json();
        targetStatus = body?.targetStatus;
      } catch {
        // no body provided, defaults in service
      }
      restored = await restoreFromArchived(id, member!, targetStatus);
    } else {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'NOT_RESTOREABLE',
            message: 'Content is neither in Bin nor Archived.',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<ContentWithRelations>>({
      success: true,
      data: restored,
      message: `Restored content "${restored.title}" successfully.`,
    } as ApiResponse<ContentWithRelations> & { message: string });
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof WorkflowError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[POST /api/content/:id/restore]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
