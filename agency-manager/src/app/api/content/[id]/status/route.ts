// src/app/api/content/[id]/status/route.ts
// PATCH /api/content/:id/status — workflow status transition
// Server-side enforced. Validates transition rules, role requirements, and logs activity.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  transitionStatus,
  ContentNotFoundError,
  WorkflowError,
} from '@/lib/services/content-service';
import type { ApiResponse } from '@/lib/types';
import type { ContentWithRelations, ContentStatus } from '@/lib/types/domain';
import { z } from 'zod';

const StatusTransitionBody = z.object({
  status: z.enum([
    'IDEA', 'SCRIPT', 'PRODUCTION', 'EDITING', 'REVIEW',
    'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED',
  ]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Requires content.update at minimum; content.approve checked inside workflow service
  const { member, errorResponse } = await requirePermission(req, 'content.update');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = StatusTransitionBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status value.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const content = await transitionStatus(id, parsed.data.status as ContentStatus, member!);
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
    console.error('[PATCH /api/content/:id/status]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
