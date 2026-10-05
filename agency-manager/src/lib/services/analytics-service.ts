// src/lib/services/analytics-service.ts
// Central Analytics Service for KIRA Agency Manager (Phase 11).
//
// REAL DATA ONLY — this service never returns fabricated metrics.
// All returned data must originate from persisted AnalyticsSnapshot records.
//
// Engagement rate formula (when all inputs present):
//   engagementRate = (likes + comments + shares + saves) / views * 100
//
// Data availability states returned to callers:
//   'real'        — actual snapshot data exists in the database
//   'unavailable' — no snapshots exist for this entity / period
//   'error'       — retrieval failed

import { getRepositories } from '@/lib/repositories';
import { ValidationError } from '@/lib/repositories/base-json-repository';
import type {
  AnalyticsSnapshot,
  SocialAccount,
  Content,
  Platform,
  TeamMember,
} from '@/lib/types/domain';
import { CreateAnalyticsSnapshotSchema } from '@/lib/validation';
import { z } from 'zod';

// ─── Custom Errors ──────────────────────────────────────────────────────────

export class AnalyticsServiceError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'ANALYTICS_ERROR', status = 400) {
    super(message);
    this.name = 'AnalyticsServiceError';
    this.code = code;
    this.status = status;
  }
}

export class AnalyticsNotFoundError extends AnalyticsServiceError {
  constructor(id: string) {
    super(`AnalyticsSnapshot "${id}" not found.`, 'ANALYTICS_NOT_FOUND', 404);
  }
}

// ─── Query / Response Types ─────────────────────────────────────────────────

export type DataAvailabilityState = 'real' | 'unavailable' | 'error';

export interface AnalyticsDateRange {
  from: string; // ISO date string
  to: string;   // ISO date string
}

export interface AnalyticsQueryFilters {
  socialAccountId?: string;
  platformId?: string;
  contentId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface SnapshotWithRelations extends AnalyticsSnapshot {
  account?: {
    id: string;
    accountName: string;
    username: string;
    platformId: string;
    platformName?: string;
  } | null;
  content?: {
    id: string;
    title: string;
    contentType: string;
  } | null;
  /** Derived only when views > 0 and all four engagement metrics are defined */
  derivedEngagementRate?: number;
}

export interface AccountAnalyticsSummary {
  account: {
    id: string;
    accountName: string;
    username: string;
    platformId: string;
    platformName: string | null;
  };
  snapshotCount: number;
  latestSnapshot: AnalyticsSnapshot | null;
  /** Computed averages over provided snapshots — undefined if no data */
  averages: {
    followers?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    engagementRate?: number;
  };
  dataAvailability: DataAvailabilityState;
  /** Reason string when dataAvailability is 'unavailable' */
  unavailableReason?: string;
}

export interface AnalyticsListResult {
  items: SnapshotWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  dataAvailability: DataAvailabilityState;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let _analyticsServiceInstance: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!_analyticsServiceInstance) {
    _analyticsServiceInstance = new AnalyticsService();
  }
  return _analyticsServiceInstance;
}

/**
 * Compute derived engagement rate only when all prerequisite values are defined
 * and views > 0.  Returns undefined rather than fabricating a value.
 *
 * Formula: (likes + comments + shares + saves) / views * 100
 */
function computeEngagementRate(snapshot: AnalyticsSnapshot): number | undefined {
  const { likes, comments, shares, saves, views } = snapshot;
  if (
    views === undefined ||
    views === null ||
    views === 0 ||
    likes === undefined ||
    comments === undefined ||
    shares === undefined ||
    saves === undefined
  ) {
    return undefined;
  }
  return ((likes + comments + shares + saves) / views) * 100;
}

/**
 * Compute the numeric average of an array, ignoring undefined values.
 * Returns undefined when no valid values exist.
 */
function avg(values: (number | undefined)[]): number | undefined {
  const valid = values.filter((v): v is number => v !== undefined && !isNaN(v));
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Filter snapshots to those within the given date range (inclusive).
 */
function filterByDateRange(
  snapshots: AnalyticsSnapshot[],
  from?: string,
  to?: string
): AnalyticsSnapshot[] {
  return snapshots.filter((s) => {
    const recorded = new Date(s.recordedAt).getTime();
    if (from && recorded < new Date(from).getTime()) return false;
    if (to && recorded > new Date(to).getTime()) return false;
    return true;
  });
}

// ─── Analytics Service ──────────────────────────────────────────────────────

export class AnalyticsService {
  private get repos() {
    return getRepositories();
  }

  /**
   * Record a new analytics snapshot.
   * Validates that referenced SocialAccount (and optional Content) exist.
   * ID is always server-generated — never accepted from caller.
   */
  async recordSnapshot(
    data: z.infer<typeof CreateAnalyticsSnapshotSchema>,
    actor: TeamMember
  ): Promise<SnapshotWithRelations> {
    const parsed = CreateAnalyticsSnapshotSchema.safeParse(data);
    if (!parsed.success) {
      throw new AnalyticsServiceError(
        parsed.error.issues.map((i) => i.message).join('; '),
        'VALIDATION_ERROR',
        400
      );
    }

    // Cross-entity validation — account must exist
    const accountExists = await this.repos.socialAccounts.exists(parsed.data.socialAccountId);
    if (!accountExists) {
      throw new AnalyticsServiceError(
        `Social account "${parsed.data.socialAccountId}" does not exist.`,
        'INVALID_REFERENCE',
        400
      );
    }

    // Optional content must exist if provided
    if (parsed.data.contentId) {
      const contentExists = await this.repos.content.exists(parsed.data.contentId);
      if (!contentExists) {
        throw new AnalyticsServiceError(
          `Content "${parsed.data.contentId}" does not exist.`,
          'INVALID_REFERENCE',
          400
        );
      }
    }

    const snapshot = await this.repos.analytics.create(parsed.data);

    // Activity log
    try {
      await this.repos.activityLogs.create({
        userId: actor.id,
        action: 'CREATE',
        entityType: 'AnalyticsSnapshot',
        entityId: snapshot.id,
        metadata: { socialAccountId: snapshot.socialAccountId, contentId: snapshot.contentId ?? null },
      });
    } catch (e) {
      console.warn('[AnalyticsService] Failed to log activity:', e);
    }

    return this.resolveRelations(snapshot);
  }

  /**
   * Retrieve a single snapshot by ID with relations resolved.
   */
  async getSnapshotById(
    id: string,
    _actor: TeamMember
  ): Promise<SnapshotWithRelations> {
    const snapshot = await this.repos.analytics.findById(id);
    if (!snapshot) throw new AnalyticsNotFoundError(id);
    return this.resolveRelations(snapshot);
  }

  /**
   * List snapshots with optional filters and pagination.
   * Returns real data only.  Never generates synthetic records.
   */
  async getSnapshots(
    filters: AnalyticsQueryFilters,
    _actor: TeamMember
  ): Promise<AnalyticsListResult> {
    try {
      let all = await this.repos.analytics.findAll();

      // Filter by socialAccountId
      if (filters.socialAccountId) {
        all = all.filter((s) => s.socialAccountId === filters.socialAccountId);
      }

      // Filter by contentId
      if (filters.contentId) {
        all = all.filter((s) => s.contentId === filters.contentId);
      }

      // Filter by platformId (requires resolving account → platform)
      if (filters.platformId) {
        const accounts = await this.repos.socialAccounts.findAll();
        const accountIdsForPlatform = new Set(
          accounts
            .filter((a) => a.platformId === filters.platformId)
            .map((a) => a.id)
        );
        all = all.filter((s) => accountIdsForPlatform.has(s.socialAccountId));
      }

      // Date range filter
      all = filterByDateRange(all, filters.from, filters.to);

      // Sort by recordedAt descending (most recent first)
      all.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

      const total = all.length;
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.limit ?? 25));
      const totalPages = Math.ceil(total / pageSize);
      const paged = all.slice((page - 1) * pageSize, page * pageSize);

      const items = await Promise.all(paged.map((s) => this.resolveRelations(s)));

      return {
        items,
        total,
        page,
        pageSize,
        totalPages,
        dataAvailability: total > 0 ? 'real' : 'unavailable',
      };
    } catch (err) {
      console.error('[AnalyticsService.getSnapshots]', err);
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
        dataAvailability: 'error',
      };
    }
  }

  /**
   * Get a summary of analytics for a specific SocialAccount.
   * Returns averages computed from REAL persisted snapshots only.
   */
  async getAccountSummary(
    socialAccountId: string,
    _actor: TeamMember,
    dateRange?: AnalyticsDateRange
  ): Promise<AccountAnalyticsSummary> {
    const account = await this.repos.socialAccounts.findById(socialAccountId);
    if (!account) {
      throw new AnalyticsServiceError(
        `Social account "${socialAccountId}" not found.`,
        'NOT_FOUND',
        404
      );
    }

    let platform: Platform | null = null;
    try {
      platform = await this.repos.platforms.findById(account.platformId);
    } catch {
      // Non-fatal — platform name just won't be resolved
    }

    let snapshots = await this.repos.analytics.findBySocialAccount(socialAccountId);
    if (dateRange) {
      snapshots = filterByDateRange(snapshots, dateRange.from, dateRange.to);
    }

    if (snapshots.length === 0) {
      return {
        account: {
          id: account.id,
          accountName: account.accountName,
          username: account.username,
          platformId: account.platformId,
          platformName: platform?.name ?? null,
        },
        snapshotCount: 0,
        latestSnapshot: null,
        averages: {},
        dataAvailability: 'unavailable',
        unavailableReason:
          'No analytics snapshots recorded for this account. Connect an analytics provider to retrieve live metrics.',
      };
    }

    // Sort to find latest
    snapshots.sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
    const latestSnapshot = snapshots[0];

    return {
      account: {
        id: account.id,
        accountName: account.accountName,
        username: account.username,
        platformId: account.platformId,
        platformName: platform?.name ?? null,
      },
      snapshotCount: snapshots.length,
      latestSnapshot,
      averages: {
        followers: avg(snapshots.map((s) => s.followers)),
        views: avg(snapshots.map((s) => s.views)),
        likes: avg(snapshots.map((s) => s.likes)),
        comments: avg(snapshots.map((s) => s.comments)),
        shares: avg(snapshots.map((s) => s.shares)),
        saves: avg(snapshots.map((s) => s.saves)),
        engagementRate: avg(
          snapshots.map((s) => s.engagementRate ?? computeEngagementRate(s))
        ),
      },
      dataAvailability: 'real',
    };
  }

  /**
   * Get summaries for all accounts — used by the analytics overview page.
   * Accounts without any snapshots are included with dataAvailability='unavailable'.
   */
  async getAllAccountSummaries(
    actor: TeamMember,
    dateRange?: AnalyticsDateRange
  ): Promise<AccountAnalyticsSummary[]> {
    const accounts = await this.repos.socialAccounts.findAll();
    return Promise.all(
      accounts.map((acc) => this.getAccountSummary(acc.id, actor, dateRange))
    );
  }

  /**
   * Delete an analytics snapshot by ID.
   */
  async deleteSnapshot(id: string, actor: TeamMember): Promise<boolean> {
    const snapshot = await this.repos.analytics.findById(id);
    if (!snapshot) throw new AnalyticsNotFoundError(id);

    const deleted = await this.repos.analytics.delete(id);

    if (deleted) {
      try {
        await this.repos.activityLogs.create({
          userId: actor.id,
          action: 'DELETE',
          entityType: 'AnalyticsSnapshot',
          entityId: id,
          metadata: { socialAccountId: snapshot.socialAccountId },
        });
      } catch (e) {
        console.warn('[AnalyticsService] Failed to log delete activity:', e);
      }
    }
    return deleted;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveRelations(
    snapshot: AnalyticsSnapshot
  ): Promise<SnapshotWithRelations> {
    let accountInfo: SnapshotWithRelations['account'] = null;
    let contentInfo: SnapshotWithRelations['content'] = null;

    try {
      const account = await this.repos.socialAccounts.findById(snapshot.socialAccountId);
      if (account) {
        let platformName: string | undefined;
        try {
          const platform = await this.repos.platforms.findById(account.platformId);
          platformName = platform?.name;
        } catch {
          // non-fatal
        }
        accountInfo = {
          id: account.id,
          accountName: account.accountName,
          username: account.username,
          platformId: account.platformId,
          platformName,
        };
      }
    } catch {
      // non-fatal
    }

    if (snapshot.contentId) {
      try {
        const content = await this.repos.content.findById(snapshot.contentId);
        if (content) {
          contentInfo = {
            id: content.id,
            title: content.title,
            contentType: content.contentType,
          };
        }
      } catch {
        // non-fatal
      }
    }

    const derivedEngagementRate =
      snapshot.engagementRate ?? computeEngagementRate(snapshot);

    return {
      ...snapshot,
      account: accountInfo,
      content: contentInfo,
      ...(derivedEngagementRate !== undefined ? { derivedEngagementRate } : {}),
    };
  }
}
