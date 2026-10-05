// src/app/api/content/route.ts
// GET /api/content  — list with search, filter, sort, pagination
// POST /api/content — create new content

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import {
  listContent,
  createContent,
  WorkflowError,
} from '@/lib/services/content-service';
import { ValidationError } from '@/lib/repositories';
import type { ApiResponse } from '@/lib/types';
import type { ContentWithRelations, ContentQueryResult, ContentType, ContentStatus } from '@/lib/types/domain';
import { z } from 'zod';

const VALID_SORT_FIELDS = ['title', 'createdAt', 'updatedAt', 'status', 'contentType'] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.read');
  if (errorResponse) return errorResponse;

  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') || sp.get('q') || undefined;
    const contentType = (sp.get('contentType') || 'ALL') as ContentType | 'ALL';
    const status = (sp.get('status') || 'ALL') as ContentStatus | 'ALL';
    const platformId = sp.get('platformId') || sp.get('platform') || undefined;
    const createdBy = sp.get('createdBy') || undefined;
    const rawSort = sp.get('sortBy') || 'updatedAt';
    const sortBy = VALID_SORT_FIELDS.includes(rawSort as typeof VALID_SORT_FIELDS[number])
      ? (rawSort as 'title' | 'createdAt' | 'updatedAt' | 'status' | 'contentType')
      : 'updatedAt';
    const sortOrder = sp.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || sp.get('limit') || '20', 10) || 20));
    const rawView = sp.get('view');
    const view: 'active' | 'archived' | 'bin' | 'feed' =
      rawView === 'archived' || rawView === 'bin' || rawView === 'feed' ? rawView : 'active';

    const result = await listContent(
      { search, contentType, status, platformId, createdBy, sortBy, sortOrder, page, pageSize, view },
      member!
    );

    return NextResponse.json<ApiResponse<ContentQueryResult>>({ success: true, data: result });
  } catch (err) {
    console.error('[GET /api/content]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

const CreateContentBody = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  contentType: z.enum(['POST', 'REEL', 'SHORT', 'VIDEO', 'IMAGE', 'CAROUSEL', 'STORY', 'TEXT', 'LIVE', 'OTHER']),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string()).max(50).optional(),
  targetPlatformIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'content.create');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    if (!body.title || !body.title.trim()) {
      body.title = body.caption?.trim().split('\n')[0].slice(0, 60) || `${body.contentType || 'POST'} - ${new Date().toLocaleDateString()}`;
    }
    const parsed = CreateContentBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const content = await createContent(parsed.data, member!);
    return NextResponse.json<ApiResponse<ContentWithRelations>>(
      { success: true, data: content },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: err.message } },
        { status: 422 }
      );
    }
    console.error('[POST /api/content]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
