// src/app/api/settings/route.ts
// Phase 18 — Agency Settings API
//
// GET   /api/settings — Retrieve current agency settings (requires settings.read)
// PATCH /api/settings — Update agency settings with IANA timezone validation & audit logging (requires settings.update)

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getSettingsService, UpdateAgencySettingsSchema } from '@/lib/services/settings-service';
import { ZodError } from 'zod';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'settings.read');
  if (errorResponse) return errorResponse;

  try {
    const service = getSettingsService();
    const settings = await service.getSettings();

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error('[API /api/settings] GET failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SETTINGS_READ_ERROR',
          message: 'Failed to retrieve agency settings.',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'settings.update');
  if (errorResponse || !member) return errorResponse!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      },
      { status: 400 }
    );
  }

  try {
    const validated = UpdateAgencySettingsSchema.parse(body);

    const service = getSettingsService();
    const updated = await service.updateSettings(validated, {
      id: member.id,
      email: member.email,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Settings validation failed',
            details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
        },
        { status: 400 }
      );
    }

    console.error('[API /api/settings] PATCH failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SETTINGS_UPDATE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update agency settings.',
        },
      },
      { status: 500 }
    );
  }
}
