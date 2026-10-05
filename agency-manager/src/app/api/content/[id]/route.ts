// src/app/api/content/[id]/route.ts
// GET /api/content/:id   — get content detail
// PATCH /api/content/:id — update content fields (not status)
// DELETE /api/content/:id — delete or archive

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getContentById,
  updateContent,
  deleteOrArchiveContent,
  ContentNotFoundError,
  ContentInUseError,
  WorkflowError,
} from '@/lib/services/content-service';
import { ValidationError } from '@/lib/repositories';
import type { ApiResponse } from '@/lib/types';
import type { ContentWithRelations, ContentType } from '@/lib/types/domain';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.read');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const content = await getContentById(id, member!);
    return NextResponse.json<ApiResponse<ContentWithRelations>>({ success: true, data: content });
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    console.error('[GET /api/content/:id]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

const PatchContentBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  contentType: z.enum(['POST', 'REEL', 'SHORT', 'VIDEO', 'IMAGE', 'CAROUSEL', 'STORY', 'TEXT', 'LIVE', 'OTHER']).optional(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string()).max(50).optional(),
  targetPlatformIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = PatchContentBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const content = await updateContent(id, parsed.data as { title?: string; description?: string; contentType?: ContentType; caption?: string; hashtags?: string[] }, member!);
    return NextResponse.json<ApiResponse<ContentWithRelations>>({ success: true, data: content });
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
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: err.message } },
        { status: 422 }
      );
    }
    console.error('[PATCH /api/content/:id]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.delete');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const sp = req.nextUrl.searchParams;
    const forcePermanent = sp.get('forcePermanent') === 'true';

    const result = await deleteOrArchiveContent(id, member!, forcePermanent);
    return NextResponse.json<ApiResponse<{ archived: boolean; deleted: boolean; movedToBin?: boolean }>>({
      success: true,
      data: result,
      message: result.movedToBin
        ? 'Content moved to Bin. It can be restored within 30 days.'
        : 'Content permanently deleted.',
    } as ApiResponse<{ archived: boolean; deleted: boolean; movedToBin?: boolean }> & { message: string });
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof ContentInUseError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 409 }
      );
    }
    console.error('[DELETE /api/content/:id]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
