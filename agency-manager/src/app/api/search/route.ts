// src/app/api/search/route.ts
// Phase 17 — Global Search API
//
// GET /api/search?q=...&type=...&page=...&limit=...
//
// Authenticated endpoint.
// Enforces server-side authorization: users only receive entities they are permitted to read.
// Never exposes unauthorized records.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember } from '@/lib/auth/authorization';
import { getGlobalSearchService } from '@/lib/services/global-search-service';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

const ALLOWED_TYPES = new Set([
  'all',
  'platform',
  'account',
  'content',
  'task',
  'team',
  'publication',
  'activity',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = checkRateLimit(req, RATE_LIMIT_PRESETS.SEARCH, 'search');
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await getCurrentTeamMember(req);
  if (!auth.user || !auth.member) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: auth.error || 'Authentication credentials were not provided or are invalid.',
        },
      },
      { status: 401 }
    );
  }

  if (auth.status !== 'ACTIVE') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Your account is ${auth.status.toLowerCase()}. Access denied.`,
        },
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const type = (searchParams.get('type') || 'all').toLowerCase();
  const pageStr = searchParams.get('page');
  const limitStr = searchParams.get('limit');

  if (q === null || q.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Query parameter "q" is required and cannot be empty.',
        },
      },
      { status: 400 }
    );
  }

  if (q.length > 100) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUERY_TOO_LONG',
          message: 'Query parameter "q" must not exceed 100 characters.',
        },
      },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: `Invalid type "${type}". Allowed: ${Array.from(ALLOWED_TYPES).join(', ')}`,
        },
      },
      { status: 400 }
    );
  }

  let page = 1;
  if (pageStr) {
    const parsedPage = parseInt(pageStr, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAGE',
            message: 'Query parameter "page" must be a positive integer.',
          },
        },
        { status: 400 }
      );
    }
    page = parsedPage;
  }

  let limit = 20;
  if (limitStr) {
    const parsedLimit = parseInt(limitStr, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: 'Query parameter "limit" must be between 1 and 100.',
          },
        },
        { status: 400 }
      );
    }
    limit = parsedLimit;
  }

  try {
    const searchService = getGlobalSearchService();
    const result = await searchService.search({
      query: q,
      type,
      page,
      limit,
      role: auth.member.role,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[API /api/search] Search failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'An internal error occurred while executing search.',
        },
      },
      { status: 500 }
    );
  }
}
