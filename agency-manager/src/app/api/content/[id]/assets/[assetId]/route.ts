// src/app/api/content/[id]/assets/[assetId]/route.ts
// GET /api/content/:id/assets/:assetId — Get asset detail with temporary signed URL
// DELETE /api/content/:id/assets/:assetId — Safely delete asset from GCS and database

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  MediaService,
  AssetNotFoundError,
  AssetOwnershipError,
  ContentNotFoundError,
  MediaIntegrityError,
} from '@/lib/services/media-service';
import type { ApiResponse } from '@/lib/types';
import type { ContentAsset } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ id: string; assetId: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.read');
  if (errorResponse) return errorResponse;

  const { id: contentId, assetId } = await context.params;

  try {
    const { asset, signedUrl } = await MediaService.getSecureMediaAccess(
      contentId,
      assetId,
      member!,
      900 // 15 minutes
    );

    return NextResponse.json<ApiResponse<ContentAsset & { signedUrl: string }>>({
      success: true,
      data: {
        ...asset,
        signedUrl,
      },
    });
  } catch (err) {
    if (err instanceof AssetNotFoundError || err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof AssetOwnershipError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof MediaIntegrityError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 500 }
      );
    }

    console.error('[GET /api/content/:id/assets/:assetId]', err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve asset details.' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id: contentId, assetId } = await context.params;

  try {
    const result = await MediaService.deleteContentAsset(contentId, assetId, member!);

    return NextResponse.json<ApiResponse<{ deleted: boolean; assetId: string }>>({
      success: true,
      data: result,
      message: `Asset "${assetId}" successfully deleted from storage and catalog.`,
    } as ApiResponse<{ deleted: boolean; assetId: string }> & { message: string });
  } catch (err) {
    if (err instanceof AssetNotFoundError || err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof AssetOwnershipError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof MediaIntegrityError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 500 }
      );
    }

    console.error('[DELETE /api/content/:id/assets/:assetId]', err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete asset.' },
      },
      { status: 500 }
    );
  }
}
