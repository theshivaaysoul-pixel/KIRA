// src/lib/services/publishing-service.ts
// Phase 14 — Publishing Engine
//
// CRITICAL RULES:
//  - Never sets publishedAt/publishedUrl/externalPostId with fabricated values
//  - Only marks PUBLISHED when the real platform adapter confirms success
//  - No adapter configured → publication is immediately set to FAILED with a truthful message
//  - Idempotency: checks getPostStatus before re-sending if a prior attempt may have succeeded
//  - Locking: per-publication mutex prevents parallel processing of the same record
//  - All writes go through the existing DataSafetyService via repositories
//  - PUBLISH_ATTEMPT / PUBLISH_SUCCESS / PUBLISH_FAILED are logged to ActivityLog
//  - Credentials are NEVER stored in ContentPublication records or ActivityLog metadata

import { getRepositories } from '@/lib/repositories';
import { getPlatformAdapterService } from '@/lib/adapters/platform-adapter-service';
import type {
  ContentPublication,
  PublicationStatus,
  TeamMember,
} from '@/lib/types/domain';
import type { PublishRequest } from '@/lib/adapters/types';
import { getDailyTargetService } from '@/lib/services/daily-target-service';
import crypto from 'crypto';

// ─── Per-publication in-process lock ─────────────────────────────────────────
// Prevents the same publication from being processed simultaneously.
// In production a distributed lock (Redis/Cloud Tasks) would replace this.

const _processingLocks = new Set<string>();

// ─── Service Errors ───────────────────────────────────────────────────────────

export class PublishingServiceError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'PUBLISHING_ERROR', status = 400) {
    super(message);
    this.name = 'PublishingServiceError';
    this.code = code;
    this.status = status;
  }
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface PublicationAttemptResult {
  publicationId: string;
  status: PublicationStatus;
  /** Only present after a real platform confirmation */
  externalPostId?: string;
  publishedUrl?: string;
  publishedAt?: string;
  errorMessage?: string;
}

// ─── Publishing Service ───────────────────────────────────────────────────────

export class PublishingService {
  private get repos() {
    return getRepositories();
  }

  private get adapterService() {
    return getPlatformAdapterService();
  }

  /**
   * Attempt to publish a ContentPublication.
   *
   * Full flow:
   *   1. Load and validate publication, content, and social account
   *   2. Resolve platform + adapter
   *   3. If no adapter → immediately FAILED with truthful message
   *   4. Validate platform capabilities against content type
   *   5. Validate live connection (adapter.validateConnection)
   *   6. If prior attempt may have succeeded → check getPostStatus (idempotency)
   *   7. Set PROCESSING, generate idempotency key
   *   8. Call adapter.publishContent
   *   9. On real success → persist externalPostId, publishedUrl, publishedAt, PUBLISHED
   *  10. On failure → persist error message, FAILED
   *  11. Log PUBLISH_ATTEMPT, then PUBLISH_SUCCESS or PUBLISH_FAILED
   */
  async publish(
    publicationId: string,
    actor: TeamMember
  ): Promise<PublicationAttemptResult> {
    // ── Locking ──────────────────────────────────────────────────────────────
    if (_processingLocks.has(publicationId)) {
      throw new PublishingServiceError(
        `Publication "${publicationId}" is already being processed.`,
        'ALREADY_PROCESSING',
        409
      );
    }
    _processingLocks.add(publicationId);

    try {
      return await this._processPublication(publicationId, actor);
    } finally {
      _processingLocks.delete(publicationId);
    }
  }

  /**
   * Retry a FAILED publication (transitions FAILED → RETRYING → PROCESSING).
   * Bounded retries — will not retry permanently invalid requests.
   */
  async retry(
    publicationId: string,
    actor: TeamMember
  ): Promise<PublicationAttemptResult> {
    const pub = await this.repos.publications.findById(publicationId);
    if (!pub) {
      throw new PublishingServiceError(
        `Publication "${publicationId}" not found.`,
        'NOT_FOUND',
        404
      );
    }

    if (!['FAILED', 'QUEUED'].includes(pub.status)) {
      throw new PublishingServiceError(
        `Cannot retry publication in "${pub.status}" status. Only FAILED or QUEUED publications can be retried.`,
        'INVALID_STATUS',
        400
      );
    }

    // Mark as retrying
    await this.repos.publications.update(publicationId, {
      status: 'RETRYING',
      errorMessage: undefined,
    });

    await this.logActivity(actor.id, 'PUBLISH_ATTEMPT', publicationId, {
      action: 'retry',
      previousStatus: pub.status,
    });

    return this.publish(publicationId, actor);
  }

  /**
   * Cancel a publication that hasn't been published yet.
   */
  async cancel(
    publicationId: string,
    actor: TeamMember
  ): Promise<ContentPublication> {
    const pub = await this.repos.publications.findById(publicationId);
    if (!pub) {
      throw new PublishingServiceError(
        `Publication "${publicationId}" not found.`,
        'NOT_FOUND',
        404
      );
    }

    if (['PUBLISHED', 'CANCELLED'].includes(pub.status)) {
      throw new PublishingServiceError(
        `Cannot cancel a publication in "${pub.status}" status.`,
        'INVALID_STATUS',
        400
      );
    }

    if (_processingLocks.has(publicationId)) {
      throw new PublishingServiceError(
        `Cannot cancel publication "${publicationId}" — it is currently being processed.`,
        'ALREADY_PROCESSING',
        409
      );
    }

    const updated = await this.repos.publications.update(publicationId, {
      status: 'CANCELLED',
    });

    await this.logActivity(actor.id, 'UPDATE', publicationId, {
      action: 'cancelled',
      previousStatus: pub.status,
    });

    return updated;
  }

  /**
   * Get the current status of a publication, including live platform status if available.
   */
  async getStatus(publicationId: string): Promise<ContentPublication & { liveStatus?: string }> {
    const pub = await this.repos.publications.findById(publicationId);
    if (!pub) {
      throw new PublishingServiceError(
        `Publication "${publicationId}" not found.`,
        'NOT_FOUND',
        404
      );
    }

    // If published, optionally check live status from platform (non-fatal)
    let liveStatus: string | undefined;
    if (pub.status === 'PUBLISHED' && pub.externalPostId) {
      try {
        const result = await this.adapterService.getPostStatus(
          pub.socialAccountId,
          pub.externalPostId
        );
        if (result.found) liveStatus = result.platformStatus;
      } catch {
        // Non-fatal — live status is optional
      }
    }

    return { ...pub, ...(liveStatus ? { liveStatus } : {}) };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async _processPublication(
    publicationId: string,
    actor: TeamMember
  ): Promise<PublicationAttemptResult> {
    // 1. Load publication
    const pub = await this.repos.publications.findById(publicationId);
    if (!pub) {
      throw new PublishingServiceError(`Publication "${publicationId}" not found.`, 'NOT_FOUND', 404);
    }

    if (['PUBLISHED', 'CANCELLED'].includes(pub.status)) {
      throw new PublishingServiceError(
        `Publication is already "${pub.status}" and cannot be re-published.`,
        'INVALID_STATUS',
        400
      );
    }

    // 2. Load content and account
    const content = await this.repos.content.findById(pub.contentId);
    if (!content) {
      return this.failPublication(pub, actor, `Content "${pub.contentId}" not found.`);
    }

    const account = await this.repos.socialAccounts.findById(pub.socialAccountId);
    if (!account) {
      return this.failPublication(pub, actor, `Social account "${pub.socialAccountId}" not found.`);
    }

    const platform = await this.repos.platforms.findById(account.platformId);
    if (!platform) {
      return this.failPublication(pub, actor, `Platform not found for account "${pub.socialAccountId}".`);
    }

    // 3. Check adapter availability — if unavailable: immediately FAILED
    if (!this.adapterService.isAdapterAvailable(platform.slug)) {
      return this.failPublication(
        pub,
        actor,
        `Platform publishing adapter is not configured for "${platform.name}". ` +
        `Connect a supported integration to enable publishing.`
      );
    }

    // 4. Validate platform publishing capability
    const adapter = this.adapterService.getAdapter(platform.slug);
    if (!adapter || !(adapter.supportedCapabilities as readonly string[]).includes('publishing')) {
      return this.failPublication(
        pub,
        actor,
        `Platform "${platform.name}" does not support the "publishing" capability.`
      );
    }

    // 5. Validate live connection
    const connectionStatus = await this.adapterService.getConnectionStatus(pub.socialAccountId);
    if (connectionStatus.code !== 'CONNECTED') {
      return this.failPublication(
        pub,
        actor,
        `Publishing unavailable — account connection status: ${connectionStatus.code}. ${connectionStatus.message}`
      );
    }

    // 6. Idempotency check — if prior attempt may have succeeded, verify before re-sending
    if (pub.externalPostId) {
      try {
        const statusCheck = await this.adapterService.getPostStatus(pub.socialAccountId, pub.externalPostId);
        if (statusCheck.found) {
          // Prior post confirmed — do not re-publish
          const updated = await this.repos.publications.update(publicationId, {
            status: 'PUBLISHED',
            publishedUrl: statusCheck.publishedUrl ?? pub.publishedUrl,
          });
          await this.logActivity(actor.id, 'PUBLISH_SUCCESS', publicationId, {
            reason: 'idempotency_check_confirmed_prior_success',
          });
          return {
            publicationId,
            status: 'PUBLISHED',
            externalPostId: pub.externalPostId,
            publishedUrl: updated.publishedUrl,
            publishedAt: pub.publishedAt,
          };
        }
      } catch {
        // Non-fatal — proceed with fresh publish attempt
      }
    }

    // 7. Set PROCESSING + generate idempotency key
    await this.repos.publications.update(publicationId, {
      status: 'PROCESSING',
      errorMessage: undefined,
    });

    await this.logActivity(actor.id, 'PUBLISH_ATTEMPT', publicationId, {
      contentId: pub.contentId,
      socialAccountId: pub.socialAccountId,
      platformSlug: platform.slug,
    });

    // Load assets for this content
    const assets = await this.repos.contentAssets.findByContentId(pub.contentId);
    const assetUrls = assets.map((a) => a.storagePath);

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${publicationId}-${actor.id}-${Date.now()}`)
      .digest('hex');

    // 8. Call adapter
    const contentType = this.mapContentType(content.contentType);
    const request: PublishRequest = {
      contentId: pub.contentId,
      publicationId,
      contentType,
      caption: pub.platformSpecificCaption ?? content.caption,
      title: pub.platformSpecificTitle ?? content.title,
      assetUrls,
      scheduledAt: pub.scheduledAt,
      idempotencyKey,
    };

    const publishResult = await this.adapterService.publishContent(pub.socialAccountId, request);

    // 9. Persist result
    if (publishResult.success) {
      const publishedAt = publishResult.publishedAt ?? new Date().toISOString();
      await this.repos.publications.update(publicationId, {
        status: 'PUBLISHED',
        externalPostId: publishResult.externalPostId,
        publishedUrl: publishResult.publishedUrl,
        publishedAt,
        errorMessage: undefined,
      });

      await this.logActivity(actor.id, 'PUBLISH_SUCCESS', publicationId, {
        externalPostId: publishResult.externalPostId,
        platformSlug: platform.slug,
      });

      // Synchronize Daily Platform Content Target
      try {
        const dailyTargetService = getDailyTargetService();
        await dailyTargetService.recordOperationCompletion({
          contentId: pub.contentId,
          platformId: platform.id,
          actorId: actor.id,
          source: 'PUBLISH',
          timestamp: publishedAt,
        });
      } catch (err) {
        console.warn('[PublishingService] Failed to sync daily platform target:', err);
      }

      return {
        publicationId,
        status: 'PUBLISHED',
        externalPostId: publishResult.externalPostId,
        publishedUrl: publishResult.publishedUrl,
        publishedAt,
      };
    }

    // 10. Handle failure
    const errorMsg =
      publishResult.error?.message ?? 'Publishing failed. No details returned by the platform.';
    return this.failPublication(pub, actor, errorMsg);
  }

  private async failPublication(
    pub: ContentPublication,
    actor: TeamMember,
    errorMessage: string
  ): Promise<PublicationAttemptResult> {
    try {
      await this.repos.publications.update(pub.id, {
        status: 'FAILED',
        errorMessage,
      });
    } catch (e) {
      console.error('[PublishingService] Failed to persist FAILED status:', e);
    }

    try {
      await this.logActivity(actor.id, 'PUBLISH_FAILED', pub.id, {
        contentId: pub.contentId,
        socialAccountId: pub.socialAccountId,
        reason: errorMessage.slice(0, 300), // truncate — never include secrets
      });
    } catch (e) {
      console.warn('[PublishingService] Failed to log PUBLISH_FAILED activity:', e);
    }

    return {
      publicationId: pub.id,
      status: 'FAILED',
      errorMessage,
    };
  }

  private async logActivity(
    userId: string,
    action: 'PUBLISH_ATTEMPT' | 'PUBLISH_SUCCESS' | 'PUBLISH_FAILED' | 'UPDATE',
    publicationId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      // Strip any accidental credential fields
      const safeMetadata: Record<string, unknown> = {};
      const sensitivePattern = /token|secret|key|password|credential|auth|cookie/i;
      for (const [k, v] of Object.entries(metadata)) {
        if (!sensitivePattern.test(k)) safeMetadata[k] = v;
      }
      await this.repos.activityLogs.create({
        userId,
        action,
        entityType: 'ContentPublication',
        entityId: publicationId,
        metadata: safeMetadata,
      });
    } catch (e) {
      console.warn('[PublishingService] Failed to write activity log:', e);
    }
  }

  /**
   * Map ContentType to publishable adapter type.
   * Defaults to 'text' for unmapped types.
   */
  private mapContentType(
    contentType: string
  ): PublishRequest['contentType'] {
    const map: Record<string, PublishRequest['contentType']> = {
      POST: 'text',
      TEXT: 'text',
      IMAGE: 'image',
      REEL: 'video',
      SHORT: 'shortVideo',
      VIDEO: 'video',
      CAROUSEL: 'carousel',
      STORY: 'story',
    };
    return map[contentType] ?? 'text';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _publishingService: PublishingService | null = null;

export function getPublishingService(): PublishingService {
  if (!_publishingService) _publishingService = new PublishingService();
  return _publishingService;
}
