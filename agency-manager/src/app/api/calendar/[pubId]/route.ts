// src/app/api/calendar/[pubId]/route.ts
// GET    /api/calendar/:pubId — get single publication event
// PATCH  /api/calendar/:pubId — reschedule (update scheduledAt / platform caption)
// DELETE /api/calendar/:pubId — cancel publication

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getPublication,
  reschedulePublication,
  cancelPublication,
  SchedulingError,
  PublicationNotFoundError,
} from '@/lib/services/calendar-service';
import { ValidationError } from '@/lib/repositories';
import type { ApiResponse } from '@/lib/types';
import type { CalendarEvent } from '@/lib/services/calendar-service';
import type { ContentPublication } from '@/lib/types/domain';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ pubId: string }>;
}

// ─── GET — Single publication event ──────────────────────────────────────────

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.read');
  if (errorResponse) return errorResponse;

  const { pubId } = await context.params;

  try {
    const event = await getPublication(pubId, member!);
    return NextResponse.json<ApiResponse<CalendarEvent>>({ success: true, data: event });
  } catch (err) {
    if (err instanceof PublicationNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof SchedulingError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[GET /api/calendar/:pubId]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

// ─── PATCH — Reschedule ────────────────────────────────────────────────────────

const RescheduleBody = z.object({
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  platformSpecificCaption: z.string().max(5000).optional(),
  platformSpecificTitle: z.string().max(200).optional(),
});

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.update');
  if (errorResponse) return errorResponse;

  const { pubId } = await context.params;

  try {
    const body = await req.json();
    const parsed = RescheduleBody.safeParse(body);
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

    const updated = await reschedulePublication(pubId, parsed.data, member!);
    return NextResponse.json<ApiResponse<ContentPublication>>({ success: true, data: updated });
  } catch (err) {
    if (err instanceof PublicationNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof SchedulingError) {
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
    console.error('[PATCH /api/calendar/:pubId]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

// ─── DELETE — Cancel publication ──────────────────────────────────────────────

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.delete');
  if (errorResponse) return errorResponse;

  const { pubId } = await context.params;

  try {
    const cancelled = await cancelPublication(pubId, member!);
    return NextResponse.json<ApiResponse<ContentPublication>>({ success: true, data: cancelled });
  } catch (err) {
    if (err instanceof PublicationNotFoundError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof SchedulingError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[DELETE /api/calendar/:pubId]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
