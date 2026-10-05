// src/app/api/content/[id]/assets/route.ts
// POST /api/content/:id/assets — Upload a media file
// GET /api/content/:id/assets  — List assets for content

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  MediaService,
  MediaValidationError,
  ContentNotFoundError,
  ContentArchivedError,
  GCSUploadError,
} from '@/lib/services/media-service';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';
import type { ApiResponse } from '@/lib/types';
import type { ContentAsset } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.read');
  if (errorResponse) return errorResponse;

  const { id: contentId } = await context.params;

  try {
    const assets = await MediaService.getContentAssets(contentId, member!);
    return NextResponse.json<ApiResponse<ContentAsset[]>>({
      success: true,
      data: assets,
    });
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    console.error('[GET /api/content/:id/assets]', err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content assets.' },
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.UPLOAD, 'media-upload');
  if (rateLimitResponse) return rateLimitResponse;

  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id: contentId } = await context.params;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Request must be multipart/form-data with a file payload.',
          },
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || !(fileEntry instanceof Blob)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'No file was provided in the "file" form-data field.',
          },
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (fileEntry as File).name || 'uploaded_media';
    const mimeType = fileEntry.type || 'application/octet-stream';

    const createdAsset = await MediaService.uploadContentAsset({
      contentId,
      file: { buffer, fileName, mimeType },
      actor: member!,
    });

    return NextResponse.json<ApiResponse<ContentAsset>>(
      {
        success: true,
        data: createdAsset,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof ContentArchivedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 422 }
      );
    }
    if (err instanceof MediaValidationError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 400 }
      );
    }
    if (err instanceof GCSUploadError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 502 }
      );
    }

    console.error('[POST /api/content/:id/assets]', err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process media upload.' },
      },
      { status: 500 }
    );
  }
}
