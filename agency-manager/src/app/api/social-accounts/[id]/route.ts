// src/app/api/social-accounts/[id]/route.ts
// Protected API endpoints for detail, update, and relationship-protected deletion of social accounts.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import {
  SocialAccountService,
  AccountInUseError,
  AccountNotFoundError,
} from '@/lib/services/social-account-service';
import { UpdateSocialAccountSchema } from '@/lib/validation';
import type { ApiResponse } from '@/lib/types';
import type { SocialAccountWithRelations } from '@/lib/types/domain';
import { ConflictError, ValidationError } from '@/lib/repositories';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<SocialAccountWithRelations>>> {
  const { member, errorResponse } = await requirePermission(req, 'accounts.read');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

  const { id } = await context.params;

  try {
    const account = await SocialAccountService.getAccountById(id, member!);
    if (!account) {
      return authErrorResponse(
        'ACCOUNT_NOT_FOUND',
        `Social account "${id}" was not found.`,
        404
      ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
    }

    return NextResponse.json<ApiResponse<SocialAccountWithRelations>>({
      success: true,
      data: account,
    });
  } catch (err) {
    console.error(`[GET /api/social-accounts/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve social account details.',
      500
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<SocialAccountWithRelations>>> {
  const { member, errorResponse } = await requirePermission(req, 'accounts.update');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return authErrorResponse(
      'INVALID_JSON',
      'Malformed request body.',
      400
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

  const parseResult = UpdateSocialAccountSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.flatten().fieldErrors;
    const firstErrorMessage =
      Object.values(errorDetails)[0]?.[0] || 'Validation failed for social account update.';
    return authErrorResponse(
      'VALIDATION_ERROR',
      firstErrorMessage,
      400,
      errorDetails
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

  try {
    const updated = await SocialAccountService.updateAccount(id, parseResult.data, member!);

    return NextResponse.json<ApiResponse<SocialAccountWithRelations>>({
      success: true,
      data: updated,
      message: `Social account "${updated.accountName}" (@${updated.username}) updated successfully.`,
    });
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return authErrorResponse(
        'ACCOUNT_NOT_FOUND',
        err.message,
        404
      ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
    }

    if (err instanceof ConflictError) {
      return authErrorResponse(
        'ACCOUNT_CONFLICT',
        err.message,
        409
      ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
    }

    if (err instanceof ValidationError) {
      return authErrorResponse(
        'VALIDATION_ERROR',
        err.message,
        400
      ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
    }

    if (err instanceof Error) {
      return authErrorResponse(
        'BAD_REQUEST',
        err.message,
        400
      ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
    }

    console.error(`[PATCH /api/social-accounts/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to update social account.',
      500
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<
  NextResponse<
    ApiResponse<{
      archived: boolean;
      deleted: boolean;
      message?: string;
    }>
  >
> {
  const { member, errorResponse } = await requirePermission(req, 'accounts.delete');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<
      ApiResponse<{ archived: boolean; deleted: boolean; message?: string }>
    >;
  }

  const { id } = await context.params;
  const forcePermanent =
    req.nextUrl.searchParams.get('forcePermanent') === 'true' ||
    req.nextUrl.searchParams.get('permanent') === 'true';

  try {
    const result = await SocialAccountService.deleteOrArchiveAccount(id, member!, {
      forcePermanent,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return authErrorResponse('ACCOUNT_NOT_FOUND', err.message, 404) as unknown as NextResponse<
        ApiResponse<{ archived: boolean; deleted: boolean; message?: string }>
      >;
    }

    if (err instanceof AccountInUseError) {
      return authErrorResponse(
        'ACCOUNT_IN_USE',
        err.message,
        409,
        err.stats
      ) as unknown as NextResponse<
        ApiResponse<{ archived: boolean; deleted: boolean; message?: string }>
      >;
    }

    console.error(`[DELETE /api/social-accounts/${id}] Error:`, err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to delete or archive social account.',
      500
    ) as unknown as NextResponse<
      ApiResponse<{ archived: boolean; deleted: boolean; message?: string }>
    >;
  }
}
