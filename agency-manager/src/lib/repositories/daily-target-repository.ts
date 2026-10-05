// src/lib/repositories/daily-target-repository.ts
// Repository for Daily Platform Content Targets (One task per calendar date).
// Stores records at database/daily-targets.json using DataSafetyService.

import { BaseJsonRepository, ValidationError, DataIntegrityError } from './base-json-repository';
import type { DailyContentTarget, PlatformTargetItem } from '@/lib/types/domain';
import { DailyContentTargetSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { BackupReason } from '@/lib/storage/backup-types';
import { StorageCorruptionError, StorageVerificationError } from '@/lib/storage/errors';
import { generateNextId } from '@/lib/utils/id';
import { z } from 'zod';

export class DailyTargetRepository extends BaseJsonRepository<
  DailyContentTarget,
  z.infer<typeof DailyContentTargetSchema>,
  Partial<DailyContentTarget>
> {
  constructor(storage: IStorageService) {
    super('database/daily-targets.json', 'DCT', DailyContentTargetSchema, DailyContentTargetSchema, storage);
  }

  /**
   * Safely read daily targets from database/daily-targets.json.
   * Tolerates empty storage or wrapped { dailyTargets: [] } structure.
   */
  protected override async readRaw(): Promise<DailyContentTarget[]> {
    try {
      const ContainerSchema = z.union([
        z.object({ dailyTargets: z.array(this.itemSchema) }),
        z.array(this.itemSchema),
      ]);

      const result = await this.safetyService.safeReadJson(
        this.storagePath,
        ContainerSchema,
        { dailyTargets: [] }
      );
      this.lastChecksum = result.checksum;

      if (Array.isArray(result.data)) {
        return result.data;
      }
      return result.data.dailyTargets;
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  /**
   * Safely write daily targets wrapped in { "dailyTargets": [] } with backups and read-back verification.
   */
  protected override async writeRaw(
    items: DailyContentTarget[],
    reason: BackupReason = 'BEFORE_UPDATE'
  ): Promise<void> {
    const ContainerSchema = z.object({
      dailyTargets: z.array(this.itemSchema),
    });

    const payload = { dailyTargets: items };
    const validationResult = ContainerSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Validation failed before writing to ${this.storagePath}`,
        validationResult.error.issues
      );
    }

    try {
      const res = await this.safetyService.safeWriteJson({
        storagePath: this.storagePath,
        data: validationResult.data,
        schema: ContainerSchema,
        reason,
        createBackupBeforeWrite: items.length > 0,
      });
      this.lastChecksum = res.checksum;
    } catch (err) {
      if (err instanceof StorageVerificationError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  /**
   * Find a daily content target by exact calendar date (YYYY-MM-DD).
   */
  async findByDate(date: string): Promise<DailyContentTarget | null> {
    const items = await this.findAll();
    return items.find((item) => item.date === date) || null;
  }

  /**
   * Save or update targets for a specific calendar date (strictly maximum 1 task per date).
   * Preserves historical completedCount and completedContentIds.
   */
  async setTargetsForDate(
    date: string,
    incomingTargets: Array<{ platformId: string; targetCount: number }>,
    userId: string
  ): Promise<DailyContentTarget> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex((i) => i.date === date);

      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        const existing = items[existingIndex];

        // Merge incoming targets with existing completed counts to preserve historical progress
        const mergedPlatformTargets: PlatformTargetItem[] = incomingTargets.map((incoming) => {
          const match = existing.platformTargets.find((p) => p.platformId === incoming.platformId);
          return {
            platformId: incoming.platformId,
            targetCount: Math.max(0, Math.floor(incoming.targetCount)),
            completedCount: match ? match.completedCount : 0,
            completedContentIds: match?.completedContentIds ? [...match.completedContentIds] : [],
          };
        });

        // Also preserve any platforms that had completions but were unselected in incoming list
        for (const prev of existing.platformTargets) {
          if (!mergedPlatformTargets.some((m) => m.platformId === prev.platformId) && prev.completedCount > 0) {
            mergedPlatformTargets.push({
              platformId: prev.platformId,
              targetCount: 0,
              completedCount: prev.completedCount,
              completedContentIds: prev.completedContentIds ? [...prev.completedContentIds] : [],
            });
          }
        }

        const updated: DailyContentTarget = {
          ...existing,
          platformTargets: mergedPlatformTargets,
          updatedAt: now,
        };

        items[existingIndex] = updated;
        await this.writeRaw(items, 'BEFORE_UPDATE');
        return updated;
      } else {
        // Create new daily target with unique ID
        const existingIds = items.map((i) => i.id);
        const id = generateNextId(this.prefix, existingIds);

        const newTarget: DailyContentTarget = {
          id,
          date,
          platformTargets: incomingTargets.map((p) => ({
            platformId: p.platformId,
            targetCount: Math.max(0, Math.floor(p.targetCount)),
            completedCount: 0,
            completedContentIds: [],
          })),
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        };

        items.push(newTarget);
        await this.writeRaw(items, 'SYSTEM_SAFETY');
        return newTarget;
      }
    });
  }

  /**
   * Record a content completion towards a daily target idempotently.
   * If the contentId was already counted for this platform on this date, does NOT increment again.
   * Returns null if no daily target exists for this date.
   */
  async recordCompletion(params: {
    date: string;
    platformId: string;
    contentId: string;
  }): Promise<{ dailyTarget: DailyContentTarget | null; alreadyCounted: boolean }> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex((i) => i.date === params.date);

      if (existingIndex < 0) {
        // As per Rule 20: Do not fabricate a daily target if none exists for this date.
        return { dailyTarget: null, alreadyCounted: false };
      }

      const existing = items[existingIndex];
      const platformItemIndex = existing.platformTargets.findIndex(
        (p) => p.platformId === params.platformId
      );

      if (platformItemIndex < 0) {
        // Platform not pre-targeted on this daily task, but we record the completion
        const updatedPlatformTargets: PlatformTargetItem[] = [
          ...existing.platformTargets,
          {
            platformId: params.platformId,
            targetCount: 0,
            completedCount: 1,
            completedContentIds: [params.contentId],
          },
        ];

        const updated: DailyContentTarget = {
          ...existing,
          platformTargets: updatedPlatformTargets,
          updatedAt: new Date().toISOString(),
        };

        items[existingIndex] = updated;
        await this.writeRaw(items, 'BEFORE_UPDATE');
        return { dailyTarget: updated, alreadyCounted: false };
      }

      const platformItem = existing.platformTargets[platformItemIndex];
      const completedContentIds = platformItem.completedContentIds || [];

      // Idempotency check: Never double count the same content on the same date/platform
      if (completedContentIds.includes(params.contentId)) {
        return { dailyTarget: existing, alreadyCounted: true };
      }

      const updatedPlatformItem: PlatformTargetItem = {
        ...platformItem,
        completedCount: platformItem.completedCount + 1,
        completedContentIds: [...completedContentIds, params.contentId],
      };

      const updatedPlatformTargets = [...existing.platformTargets];
      updatedPlatformTargets[platformItemIndex] = updatedPlatformItem;

      const updated: DailyContentTarget = {
        ...existing,
        platformTargets: updatedPlatformTargets,
        updatedAt: new Date().toISOString(),
      };

      items[existingIndex] = updated;
      await this.writeRaw(items, 'BEFORE_UPDATE');
      return { dailyTarget: updated, alreadyCounted: false };
    });
  }

  /**
   * Remove a content completion from a daily target idempotently.
   * Decrements completedCount (min 0) and removes contentId from completedContentIds.
   */
  async removeCompletion(params: {
    date: string;
    platformId: string;
    contentId: string;
  }): Promise<{ dailyTarget: DailyContentTarget | null; wasCounted: boolean }> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex((i) => i.date === params.date);

      if (existingIndex < 0) {
        return { dailyTarget: null, wasCounted: false };
      }

      const existing = items[existingIndex];
      const platformItemIndex = existing.platformTargets.findIndex(
        (p) => p.platformId === params.platformId
      );

      if (platformItemIndex < 0) {
        return { dailyTarget: existing, wasCounted: false };
      }

      const platformItem = existing.platformTargets[platformItemIndex];
      const completedContentIds = platformItem.completedContentIds || [];

      if (!completedContentIds.includes(params.contentId)) {
        return { dailyTarget: existing, wasCounted: false };
      }

      const updatedPlatformItem: PlatformTargetItem = {
        ...platformItem,
        completedCount: Math.max(0, platformItem.completedCount - 1),
        completedContentIds: completedContentIds.filter((id) => id !== params.contentId),
      };

      const updatedPlatformTargets = [...existing.platformTargets];
      updatedPlatformTargets[platformItemIndex] = updatedPlatformItem;

      const updated: DailyContentTarget = {
        ...existing,
        platformTargets: updatedPlatformTargets,
        updatedAt: new Date().toISOString(),
      };

      items[existingIndex] = updated;
      await this.writeRaw(items, 'BEFORE_UPDATE');
      return { dailyTarget: updated, wasCounted: true };
    });
  }
}

