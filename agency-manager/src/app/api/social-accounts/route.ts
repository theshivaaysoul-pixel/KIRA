// src/app/api/social-accounts/route.ts
// Protected API endpoints for listing and creating social accounts.
// Enforces accounts.read and accounts.create permissions.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authErrorResponse } from '@/lib/auth/authorization';
import { SocialAccountService } from '@/lib/services/social-account-service';
import { CreateSocialAccountSchema } from '@/lib/validation';
import type { ApiResponse } from '@/lib/types';
import type {
  SocialAccountWithRelations,
  SocialAccountQueryResult,
  SocialAccountStatus,
} from '@/lib/types/domain';
import { ConflictError, ValidationError } from '@/lib/repositories';

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<SocialAccountQueryResult>>> {
  const { member, errorResponse } = await requirePermission(req, 'accounts.read');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<SocialAccountQueryResult>>;
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const platformId = searchParams.get('platformId') || undefined;
    const statusParam = searchParams.get('status') as SocialAccountStatus | 'ALL' | null;
    const assignedManagerId = searchParams.get('assignedManagerId') || undefined;
    const sortBy = searchParams.get('sortBy') as
      | 'accountName'
      | 'username'
      | 'createdAt'
      | 'updatedAt'
      | 'status'
      | null;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const pageSize = searchParams.get('pageSize') || searchParams.get('limit');
    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await SocialAccountService.listAccounts(
      {
        search,
        platformId,
        status: statusParam || 'ALL',
        assignedManagerId,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
        page: isNaN(page) ? 1 : page,
        pageSize: isNaN(parsedPageSize) ? 20 : parsedPageSize,
      },
      member!
    );

    return NextResponse.json<ApiResponse<SocialAccountQueryResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[GET /api/social-accounts] Error listing accounts:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve social accounts.',
      500
    ) as unknown as NextResponse<ApiResponse<SocialAccountQueryResult>>;
  }
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<SocialAccountWithRelations>>> {
  const { member, errorResponse } = await requirePermission(req, 'accounts.create');
  if (errorResponse) {
    return errorResponse as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

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

  const parseResult = CreateSocialAccountSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.flatten().fieldErrors;
    const firstErrorMessage =
      Object.values(errorDetails)[0]?.[0] || 'Validation failed for social account creation.';
    return authErrorResponse(
      'VALIDATION_ERROR',
      firstErrorMessage,
      400,
      errorDetails
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }

  try {
    const created = await SocialAccountService.createAccount(parseResult.data, member!);

    return NextResponse.json<ApiResponse<SocialAccountWithRelations>>(
      {
        success: true,
        data: created,
        message: `Social account "${created.accountName}" (@${created.username}) created successfully.`,
      },
      { status: 201 }
    );
  } catch (err) {
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

    console.error('[POST /api/social-accounts] Unexpected error:', err);
    return authErrorResponse(
      'INTERNAL_ERROR',
      'Failed to create social account.',
      500
    ) as unknown as NextResponse<ApiResponse<SocialAccountWithRelations>>;
  }
}
