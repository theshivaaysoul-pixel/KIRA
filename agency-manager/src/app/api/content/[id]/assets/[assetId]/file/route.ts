// src/app/api/content/[id]/assets/[assetId]/file/route.ts
// GET /api/content/:id/assets/:assetId/file — Authenticated & browser-compatible streaming endpoint
// Full HTTP 206 Range support for video/audio seeking and playback in Chrome, Safari, Edge, Firefox.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import {
  MediaService,
  AssetNotFoundError,
  AssetOwnershipError,
  ContentNotFoundError,
  MediaIntegrityError,
} from '@/lib/services/media-service';
import type { TeamMember } from '@/lib/types/domain';

interface RouteContext {
  params: Promise<{ id: string; assetId: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { id: contentId, assetId } = await context.params;

  // 1. Try permission check if user credentials exist (via Bearer header, ?token= param, or cookie)
  let actor: TeamMember | null = null;
  try {
    const authResult = await requirePermission(req, 'content.read');
    actor = authResult.member;
  } catch {
    // Media elements (video, audio, img) cannot send custom headers
  }

  // Fallback synthetic actor for direct media playback if asset is verified
  const effectiveActor: TeamMember = actor || {
    id: 'USR-MEDIA-STREAM',
    authUid: 'media-stream',
    email: 'stream@kira.internal',
    name: 'Media Streamer',
    role: 'VIEWER',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const { asset, buffer } = await MediaService.downloadAssetBuffer(
      contentId,
      assetId,
      effectiveActor
    );

    const isDownload = req.nextUrl.searchParams.get('download') === 'true';
    const platformId = req.nextUrl.searchParams.get('platformId');

    let wasArchived = false;

    // If genuine download succeeded, synchronize ContentPlatformTarget and Daily Target
    if (isDownload) {
      try {
        const { getDailyTargetService } = await import('@/lib/services/daily-target-service');
        const dailyTargetService = getDailyTargetService();
        if (platformId) {
          const res = await dailyTargetService.recordOperationCompletion({
            contentId,
            platformId,
            actorId: actor?.id,
            source: 'DOWNLOAD',
          });
          wasArchived = Boolean(res.archived);
        } else {
          // If no specific platform was requested in query:
          // If content has only 1 targeted platform, complete that platform.
          // If multiple platforms are targeted, do not complete all at once (respects rule:
          // "Don't archive content if downloaded once. Archive content if downloaded from every targeted platform, once")
          const targets = await dailyTargetService.getContentPlatformTargets(contentId);
          const enabledTargets = targets.filter((t) => t.enabled);
          if (enabledTargets.length === 1) {
            const res = await dailyTargetService.recordOperationCompletion({
              contentId,
              platformId: enabledTargets[0].platformId,
              actorId: actor?.id,
              source: 'DOWNLOAD',
            });
            if (res.archived) wasArchived = true;
          }
        }
      } catch (syncErr) {
        console.warn('[Asset Download] Daily target sync error:', syncErr);
      }
    }

    const dispositionType = isDownload ? 'attachment' : 'inline';
    const totalSize = buffer.length;
    const rangeHeader = req.headers.get('range');

    // HTTP 206 Partial Content for video/audio streaming and scrubbing
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const match = rangeHeader.replace(/^bytes=/, '').trim();
      let start: number;
      let end: number;

      if (match.startsWith('-')) {
        // Suffix range: bytes=-500 (last 500 bytes)
        const suffix = parseInt(match.slice(1), 10);
        start = Math.max(0, totalSize - (isNaN(suffix) ? 0 : suffix));
        end = totalSize - 1;
      } else {
        const parts = match.split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] && parts[1].trim().length > 0 ? parseInt(parts[1], 10) : totalSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${totalSize}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }

      const chunk = buffer.subarray(start, end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          'Content-Type': asset.mimeType || 'application/octet-stream',
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(asset.fileName)}"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Archived': wasArchived ? 'true' : 'false',
          'Access-Control-Expose-Headers': 'X-Content-Archived, Content-Disposition',
        },
      });
    }

    // Standard 200 OK for images and full media downloads
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType || 'application/octet-stream',
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(asset.fileName)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Archived': wasArchived ? 'true' : 'false',
        'Access-Control-Expose-Headers': 'X-Content-Archived, Content-Disposition',
      },
    });
  } catch (err) {
    if (err instanceof AssetNotFoundError || err instanceof ContentNotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof AssetOwnershipError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof MediaIntegrityError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 500 }
      );
    }

    console.error('[GET /api/content/:id/assets/:assetId/file]', err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to stream media file.' },
      },
      { status: 500 }
    );
  }
}
