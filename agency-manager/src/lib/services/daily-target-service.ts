// src/lib/services/daily-target-service.ts
// Redesigned Daily Platform Content Target Service for KIRA Agency Manager.
//
// Enforces:
// 1. Exactly ONE DailyContentTarget per calendar date (YYYY-MM-DD in agency timezone).
// 2. Real dynamic platforms from PlatformRepository (no hardcoding).
// 3. Integer stepper counts (min 0, no negative).
// 4. Content platform targeting (ON/OFF) vs Completion (✓ Completed).
// 5. Automatic completion synchronization from real Download and Publish operations.
// 6. Strict idempotency & double-counting prevention (same content + platform + dailyTarget only counts once).
// 7. Target adjustments preserve historical completions.

import { getRepositories } from '@/lib/repositories';
import type {
  DailyContentTarget,
  DailyContentTargetWithRelations,
  PlatformTargetDetail,
  ContentPlatformTarget,
  ContentPlatformTargetWithPlatform,
  Platform,
  DailyContentTargetId,
  TeamMemberId,
  ContentPlatformTargetId,
} from '@/lib/types/domain';
import {
  UpdateDailyTargetsInputSchema,
  SetContentPlatformTargetInputSchema,
} from '@/lib/validation';

export class DailyTargetServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'DAILY_TARGET_ERROR', status = 400) {
    super(message);
    this.name = 'DailyTargetServiceError';
    this.code = code;
    this.status = status;
  }
}

export class DailyTargetNotFoundError extends DailyTargetServiceError {
  constructor(identifier: string) {
    super(`Daily content target for "${identifier}" was not found.`, 'DAILY_TARGET_NOT_FOUND', 404);
    this.name = 'DailyTargetNotFoundError';
  }
}

export class DailyTargetService {
  private repos = getRepositories();

  /**
   * Resolves the agency's configured IANA timezone (e.g. 'Asia/Kolkata').
   */
  async getAgencyTimezone(): Promise<string> {
    try {
      const settings = await this.repos.settings.getSettings();
      return settings?.timezone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * Formats a given Date (or ISO string) into 'YYYY-MM-DD' using the agency's timezone.
   */
  async getAgencyDateString(date: Date | string = new Date()): Promise<string> {
    const timezone = await this.getAgencyTimezone();
    const d = typeof date === 'string' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  }

  /**
   * Retrieves the daily target for a given date with full relations (active platforms,
   * target counts, completed counts, remaining counts, status, and overall metrics).
   *
   * If no record exists for that date, returns an unconfigured representation
   * (does NOT fabricate or persist fake records).
   */
  async getDailyTarget(dateStr: string): Promise<DailyContentTargetWithRelations> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      throw new DailyTargetServiceError('Invalid date format. Expected YYYY-MM-DD.', 'INVALID_DATE', 400);
    }

    // 1. Fetch all platforms
    const allPlatforms = await this.repos.platforms.findAll();
    const activePlatforms = allPlatforms.filter((p) => p.isActive);

    // 2. Fetch daily target record for this date
    const targetRecord = await this.repos.dailyTargets.findByDate(dateStr);

    // 3. Build platform map: include all active platforms, plus any platform in targetRecord even if now inactive
    const platformMap = new Map<string, Platform>();
    for (const p of activePlatforms) {
      platformMap.set(p.id, p);
    }
    if (targetRecord) {
      for (const pt of targetRecord.platformTargets) {
        if (!platformMap.has(pt.platformId)) {
          const inactive = allPlatforms.find((p) => p.id === pt.platformId);
          if (inactive) platformMap.set(inactive.id, inactive);
        }
      }
    }

    const platformDetails: PlatformTargetDetail[] = [];
    let overallTarget = 0;
    let overallCompleted = 0;

    for (const platform of platformMap.values()) {
      const configured = targetRecord?.platformTargets.find((pt) => pt.platformId === platform.id);
      const targetCount = configured ? configured.targetCount : 0;
      const completedCount = configured ? configured.completedCount : 0;
      const remaining = Math.max(targetCount - completedCount, 0);

      const status =
        targetCount === 0
          ? 'NOT_TARGETED'
          : completedCount >= targetCount
            ? 'COMPLETE'
            : 'IN_PROGRESS';

      const percentage =
        targetCount > 0 ? Math.min(100, Math.round((completedCount / targetCount) * 100)) : 0;

      if (targetCount > 0) {
        overallTarget += targetCount;
        overallCompleted += completedCount;
      }

      platformDetails.push({
        platform,
        targetCount,
        completedCount,
        remaining,
        status,
        percentage,
        completedContentIds: configured?.completedContentIds || [],
      });
    }

    // Sort platforms by active status then name
    platformDetails.sort((a, b) => {
      if (a.platform.isActive !== b.platform.isActive) {
        return a.platform.isActive ? -1 : 1;
      }
      return a.platform.name.localeCompare(b.platform.name);
    });

    const overallRemaining = Math.max(overallTarget - overallCompleted, 0);
    const overallPercentage =
      overallTarget > 0 ? Math.min(100, Math.round((overallCompleted / overallTarget) * 100)) : 0;

    return {
      id: targetRecord?.id || ('' as DailyContentTargetId),
      date: dateStr,
      platformTargets: targetRecord?.platformTargets || [],
      createdBy: targetRecord?.createdBy || ('' as TeamMemberId),
      createdAt: targetRecord?.createdAt || '',
      updatedAt: targetRecord?.updatedAt || '',
      platforms: platformDetails,
      overallTarget,
      overallCompleted,
      overallRemaining,
      overallPercentage,
    };
  }

  /**
   * Sets or updates daily content targets for a specific calendar date.
   * Preserves historical completed counts and completed content tracking.
   */
  async updateDailyTargets(
    dateStr: string,
    targetsInput: Array<{ platformId: string; targetCount: number }>,
    actorId: string
  ): Promise<DailyContentTargetWithRelations> {
    const validated = UpdateDailyTargetsInputSchema.parse({
      date: dateStr,
      platformTargets: targetsInput,
    });

    // Verify all specified platforms exist
    const allPlatforms = await this.repos.platforms.findAll();
    const platformIdSet = new Set(allPlatforms.map((p) => p.id));

    for (const pt of validated.platformTargets) {
      if (!platformIdSet.has(pt.platformId)) {
        throw new DailyTargetServiceError(
          `Platform "${pt.platformId}" does not exist.`,
          'PLATFORM_NOT_FOUND',
          400
        );
      }
    }

    // Persist via repository
    const updatedRecord = await this.repos.dailyTargets.setTargetsForDate(
      validated.date,
      validated.platformTargets,
      actorId
    );

    // Activity log entry
    try {
      await this.repos.activityLogs.log({
        action: 'DAILY_TARGET_CONFIGURED',
        entityType: 'DailyContentTarget',
        entityId: updatedRecord.id,
        userId: actorId,
        metadata: {
          date: validated.date,
          platformTargets: validated.platformTargets,
        },
      });
    } catch (e) {
      console.warn('[DailyTargetService] Failed to write activity log for daily target update:', e);
    }

    return this.getDailyTarget(validated.date);
  }

  /**
   * Get all platform targeting records for a specific content item.
   * Returns a complete list of all currently active platforms, with their targeting
   * state (enabled, completed, completedAt) for this content.
   */
  async getContentPlatformTargets(contentId: string): Promise<ContentPlatformTargetWithPlatform[]> {
    const content = await this.repos.content.findById(contentId);
    if (!content) {
      throw new DailyTargetServiceError(`Content "${contentId}" was not found.`, 'CONTENT_NOT_FOUND', 404);
    }

    const allPlatforms = await this.repos.platforms.findAll();
    const activePlatforms = allPlatforms.filter((p) => p.isActive);

    const existingTargets = await this.repos.contentPlatformTargets.findByContentId(contentId);
    const existingMap = new Map<string, ContentPlatformTarget>();
    for (const t of existingTargets) {
      existingMap.set(t.platformId, t);
    }

    const result: ContentPlatformTargetWithPlatform[] = [];
    for (const platform of activePlatforms) {
      const existing = existingMap.get(platform.id);
      const isTargeted = existing
        ? existing.enabled
        : (content?.targetPlatformIds ? content.targetPlatformIds.includes(platform.id) : false);

      result.push({
        id: existing?.id || ('' as ContentPlatformTargetId),
        contentId,
        platformId: platform.id,
        platform,
        enabled: isTargeted,
        completed: existing?.completed ?? false,
        completedAt: existing?.completedAt || null,
        createdAt: existing?.createdAt || '',
        updatedAt: existing?.updatedAt || '',
      });
    }

    // Sort by platform name
    result.sort((a, b) => a.platform.name.localeCompare(b.platform.name));
    return result;
  }

  /**
   * Evaluates whether all targeted platforms for a content item have been completed.
   * If all targeted platforms are completed, transitions content status to 'ARCHIVED'
   * and records an activity log.
   */
  async checkAndAutoArchiveIfAllCompleted(
    contentId: string,
    actorId?: string
  ): Promise<{ archived: boolean }> {
    const content = await this.repos.content.findById(contentId);
    if (!content || content.deletedAt || content.status === 'ARCHIVED') {
      return { archived: false };
    }

    const allContentTargets = await this.repos.contentPlatformTargets.findByContentId(contentId);
    const targetSet = new Set<string>();

    if (Array.isArray(content.targetPlatformIds) && content.targetPlatformIds.length > 0) {
      for (const pid of content.targetPlatformIds) {
        if (pid) targetSet.add(pid);
      }
    } else {
      for (const t of allContentTargets) {
        if (t.enabled) {
          targetSet.add(t.platformId);
        }
      }
    }

    if (targetSet.size === 0) {
      return { archived: false };
    }

    const completedSet = new Set<string>();
    for (const t of allContentTargets) {
      if (t.completed) {
        completedSet.add(t.platformId);
      }
    }

    const allCompleted = Array.from(targetSet).every((pid) => completedSet.has(pid));
    if (allCompleted) {
      await this.repos.content.update(contentId, { status: 'ARCHIVED' });
      try {
        await this.repos.activityLogs.log({
          action: 'ARCHIVE',
          entityType: 'Content',
          entityId: contentId,
          userId: actorId || 'USR-SYSTEM',
          metadata: {
            contentTitle: content.title,
            targetedPlatformCount: targetSet.size,
            targetedPlatforms: Array.from(targetSet),
            reason: 'DOWNLOADED_FROM_ALL_TARGETED_PLATFORMS',
          },
        });
      } catch (e) {
        console.warn('[DailyTargetService] Failed to write auto-archive log:', e);
      }
      return { archived: true };
    }

    return { archived: false };
  }

  /**
   * Manually toggle a content item's targeted state (ON/OFF) for a platform.
   * Note: Turning ON does NOT automatically mark completed.
   */
  async setContentPlatformTarget(
    contentId: string,
    platformId: string,
    enabled: boolean,
    actorId?: string
  ): Promise<ContentPlatformTarget> {
    SetContentPlatformTargetInputSchema.parse({ contentId, platformId, enabled });

    const content = await this.repos.content.findById(contentId);
    if (!content) {
      throw new DailyTargetServiceError(`Content "${contentId}" was not found.`, 'CONTENT_NOT_FOUND', 404);
    }

    const platform = await this.repos.platforms.findById(platformId);
    if (!platform) {
      throw new DailyTargetServiceError(`Platform "${platformId}" was not found.`, 'PLATFORM_NOT_FOUND', 404);
    }

    const record = await this.repos.contentPlatformTargets.setTarget(
      contentId,
      platformId,
      enabled
    );

    // Also keep content.targetPlatformIds in sync if present
    if (Array.isArray(content.targetPlatformIds)) {
      const currentList = new Set(content.targetPlatformIds);
      if (enabled) {
        currentList.add(platformId);
      } else {
        currentList.delete(platformId);
      }
      await this.repos.content.update(contentId, {
        targetPlatformIds: Array.from(currentList),
      });
    }

    try {
      await this.repos.activityLogs.log({
        action: enabled ? 'CONTENT_PLATFORM_TARGETED' : 'CONTENT_PLATFORM_UNTARGETED',
        entityType: 'ContentPlatformTarget',
        entityId: record.id,
        userId: actorId || 'USR-SYSTEM',
        metadata: {
          contentId,
          contentTitle: content.title,
          platformId,
          platformName: platform.name,
          enabled,
        },
      });
    } catch (e) {
      console.warn('[DailyTargetService] Failed to write activity log for content platform toggle:', e);
    }

    // Check if toggling platform target state completes all targets
    await this.checkAndAutoArchiveIfAllCompleted(contentId, actorId);

    return record;
  }

  /**
   * Records a REAL successful completion event (from Download, Upload/Publish, or verified operation).
   *
   * Automatically:
   * 1. Marks ContentPlatformTarget as enabled=true, completed=true, completedAt=now.
   * 2. Resolves agency calendar date from operation timestamp and agency timezone.
   * 3. Idempotently updates that date's DailyContentTarget (if one exists), incrementing
   *    completedCount only once for this content+platform combination.
   * 4. Logs activity.
   */
  async recordOperationCompletion(params: {
    contentId: string;
    platformId: string;
    actorId?: string;
    source: 'DOWNLOAD' | 'PUBLISH' | 'MANUAL';
    timestamp?: string;
  }): Promise<{
    contentTarget: ContentPlatformTarget;
    dailyTargetUpdated: boolean;
    dailyTarget?: DailyContentTarget;
    archived?: boolean;
  }> {
    const { contentId, platformId, actorId, source, timestamp } = params;

    const content = await this.repos.content.findById(contentId);
    if (!content) {
      throw new DailyTargetServiceError(`Content "${contentId}" was not found.`, 'CONTENT_NOT_FOUND', 404);
    }

    const platform = await this.repos.platforms.findById(platformId);
    if (!platform) {
      throw new DailyTargetServiceError(`Platform "${platformId}" was not found.`, 'PLATFORM_NOT_FOUND', 404);
    }

    const opTime = timestamp || new Date().toISOString();

    // 1. Mark content platform target completed
    const completionResult = await this.repos.contentPlatformTargets.markCompleted({
      contentId,
      platformId,
      userId: actorId,
      source: source || 'MANUAL',
      completedAt: opTime,
    });

    // 2. Resolve agency calendar date
    const dateStr = await this.getAgencyDateString(opTime);

    // 3. Idempotently record completion on the daily target (if one exists)
    const targetResult = await this.repos.dailyTargets.recordCompletion({
      date: dateStr,
      platformId,
      contentId,
    });

    // 4. Activity log
    try {
      await this.repos.activityLogs.log({
        action: 'CONTENT_PLATFORM_COMPLETED',
        entityType: 'ContentPlatformTarget',
        entityId: completionResult.target.id,
        userId: actorId || 'USR-SYSTEM',
        metadata: {
          contentId,
          contentTitle: content.title,
          platformId,
          platformName: platform.name,
          source,
          date: dateStr,
          dailyTargetUpdated: !!targetResult.dailyTarget,
        },
      });
    } catch (e) {
      console.warn('[DailyTargetService] Failed to write activity log for operation completion:', e);
    }

    // 5. Global Rule: Don't archive content if downloaded once.
    // Archive content if downloaded from every targeted platform, once.
    const { archived } = await this.checkAndAutoArchiveIfAllCompleted(contentId, actorId);

    return {
      contentTarget: completionResult.target,
      dailyTargetUpdated: !!targetResult.dailyTarget,
      dailyTarget: targetResult.dailyTarget || undefined,
      archived,
    };
  }

  /**
   * Reverts a completion event for a content item on a platform.
   * Decrements daily target completedCount and unmarks ContentPlatformTarget.
   */
  async unmarkOperationCompletion(params: {
    contentId: string;
    platformId: string;
    actorId?: string;
    timestamp?: string;
  }): Promise<{
    contentTarget: ContentPlatformTarget | null;
    dailyTargetUpdated: boolean;
    dailyTarget?: DailyContentTarget;
  }> {
    const { contentId, platformId, actorId: _actorId, timestamp } = params;

    const opTime = timestamp || new Date().toISOString();
    const dateStr = await this.getAgencyDateString(opTime);

    const updatedTarget = await this.repos.contentPlatformTargets.unmarkCompleted({
      contentId,
      platformId,
    });

    const dailyResult = await this.repos.dailyTargets.removeCompletion({
      date: dateStr,
      platformId,
      contentId,
    });

    return {
      contentTarget: updatedTarget,
      dailyTargetUpdated: dailyResult.wasCounted,
      dailyTarget: dailyResult.dailyTarget || undefined,
    };
  }

  /**
   * Toggles task completion for all targeted platforms of a content item.
   * If completed=true: marks 1 task completed in each targeted platform for today.
   * If completed=false: reverts completion in targeted platforms.
   */
  async toggleContentTaskCompletion(params: {
    contentId: string;
    completed: boolean;
    actorId?: string;
    timestamp?: string;
  }): Promise<{
    affectedPlatformIds: string[];
    dailyTargetUpdated: boolean;
    archived?: boolean;
  }> {
    const { contentId, completed, actorId, timestamp } = params;

    const content = await this.repos.content.findById(contentId);
    if (!content) {
      throw new DailyTargetServiceError(`Content "${contentId}" was not found.`, 'CONTENT_NOT_FOUND', 404);
    }

    const platformTargets = await this.getContentPlatformTargets(contentId);
    let targeted = platformTargets.filter((t) => t.enabled);

    // If completed=true and no platforms are targeted yet, use content's targetPlatformIds or active platforms
    if (completed && targeted.length === 0) {
      const fallbackPlatforms =
        content.targetPlatformIds && content.targetPlatformIds.length > 0
          ? content.targetPlatformIds
          : platformTargets.slice(0, 1).map((p) => p.platform.id);

      for (const pId of fallbackPlatforms) {
        await this.setContentPlatformTarget(contentId, pId, true, actorId);
      }
      const refreshed = await this.getContentPlatformTargets(contentId);
      targeted = refreshed.filter((t) => t.enabled);
    }

    const affectedPlatformIds: string[] = [];
    let anyDailyTargetUpdated = false;
    let anyArchived = false;

    if (completed) {
      for (const target of targeted) {
        const res = await this.recordOperationCompletion({
          contentId,
          platformId: target.platformId,
          actorId,
          source: 'MANUAL',
          timestamp,
        });
        affectedPlatformIds.push(target.platformId);
        if (res.dailyTargetUpdated) anyDailyTargetUpdated = true;
        if (res.archived) anyArchived = true;
      }
    } else {
      const completedTargets = platformTargets.filter((t) => t.completed);
      for (const target of completedTargets) {
        const res = await this.unmarkOperationCompletion({
          contentId,
          platformId: target.platformId,
          actorId,
          timestamp,
        });
        affectedPlatformIds.push(target.platformId);
        if (res.dailyTargetUpdated) anyDailyTargetUpdated = true;
      }
    }

    return {
      affectedPlatformIds,
      dailyTargetUpdated: anyDailyTargetUpdated,
      archived: anyArchived,
    };
  }

  /**
   * Retrieves today's content progress metrics for dashboard integration.
   */
  async getTodayProgress(): Promise<{
    totalTarget: number;
    totalCompleted: number;
    totalRemaining: number;
    overallPercentage: number;
    hasTarget: boolean;
    date: string;
  }> {
    const today = await this.getAgencyDateString();
    const dailyTarget = await this.getDailyTarget(today);

    if (dailyTarget.overallTarget === 0) {
      return {
        totalTarget: 0,
        totalCompleted: 0,
        totalRemaining: 0,
        overallPercentage: 0,
        hasTarget: false,
        date: today,
      };
    }

    return {
      totalTarget: dailyTarget.overallTarget,
      totalCompleted: dailyTarget.overallCompleted,
      totalRemaining: dailyTarget.overallRemaining,
      overallPercentage: dailyTarget.overallPercentage,
      hasTarget: true,
      date: today,
    };
  }
}

// Singleton accessor
let _instance: DailyTargetService | null = null;

export function getDailyTargetService(): DailyTargetService {
  if (!_instance) {
    _instance = new DailyTargetService();
  }
  return _instance;
}
