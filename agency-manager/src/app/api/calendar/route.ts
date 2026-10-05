// src/app/api/calendar/route.ts
// GET  /api/calendar   — list calendar events for a date range
// POST /api/calendar   — schedule a new publication

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  getCalendarEvents,
  schedulePublication,
  getAgencyTimezone,
  SchedulingError,
  PublicationNotFoundError,
} from '@/lib/services/calendar-service';
import { ValidationError } from '@/lib/repositories';
import type { ApiResponse } from '@/lib/types';
import type { CalendarEvent } from '@/lib/services/calendar-service';
import type { ContentPublication } from '@/lib/types/domain';
import { z } from 'zod';

// ─── GET — List Calendar Events ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.read');
  if (errorResponse) return errorResponse;

  const sp = req.nextUrl.searchParams;

  // Fallback: if no range provided, default to the current month in agency timezone
  const agencyTz = await getAgencyTimezone();

  let startDate = sp.get('startDate');
  let endDate = sp.get('endDate');

  if (!startDate || !endDate) {
    // Default: current month UTC bounds
    const now = new Date();
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    startDate = firstOfMonth.toISOString();
    endDate = lastOfMonth.toISOString();
  }

  const status = (sp.get('status') || 'ALL') as 'ALL' | 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'RETRYING' | 'CANCELLED';
  const socialAccountId = sp.get('socialAccountId') || undefined;

  try {
    const events = await getCalendarEvents(
      { startDate, endDate, timezone: agencyTz, status, socialAccountId },
      member!
    );

    return NextResponse.json<ApiResponse<{ events: CalendarEvent[]; timezone: string; startDate: string; endDate: string }>>({
      success: true,
      data: { events, timezone: agencyTz, startDate, endDate },
    });
  } catch (err) {
    if (err instanceof SchedulingError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[GET /api/calendar]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}

// ─── POST — Schedule a Publication ────────────────────────────────────────────

const SchedulePublicationBody = z.object({
  contentId: z.string().regex(/^CNT-\d{6}$/, 'Invalid Content ID format (CNT-XXXXXX)'),
  socialAccountId: z.string().regex(/^ACC-\d{6}$/, 'Invalid SocialAccount ID format (ACC-XXXXXX)'),
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  platformSpecificCaption: z.string().max(5000).optional(),
  platformSpecificTitle: z.string().max(200).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'calendar.create');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = SchedulePublicationBody.safeParse(body);
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

    const publication = await schedulePublication(parsed.data, member!);

    return NextResponse.json<ApiResponse<ContentPublication>>(
      { success: true, data: publication },
      { status: 201 }
    );
  } catch (err) {
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
    console.error('[POST /api/calendar]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
