// src/lib/repositories/content-platform-target-repository.ts
// Repository for Content <-> Platform Target Relationships.
// Tracks targeted (enabled: ON/OFF) and completed (completed: ✓) states per platform for each content piece.
// Stored at database/content-platform-targets.json using DataSafetyService.

import { BaseJsonRepository, ValidationError, DataIntegrityError } from './base-json-repository';
import type { ContentPlatformTarget } from '@/lib/types/domain';
import { ContentPlatformTargetSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { BackupReason } from '@/lib/storage/backup-types';
import { StorageCorruptionError, StorageVerificationError } from '@/lib/storage/errors';
import { generateNextId } from '@/lib/utils/id';
import { z } from 'zod';

export class ContentPlatformTargetRepository extends BaseJsonRepository<
  ContentPlatformTarget,
  z.infer<typeof ContentPlatformTargetSchema>,
  Partial<ContentPlatformTarget>
> {
  constructor(storage: IStorageService) {
    super(
      'database/content-platform-targets.json',
      'CPT',
      ContentPlatformTargetSchema,
      ContentPlatformTargetSchema,
      storage
    );
  }

  /**
   * Safely read content platform targets from database/content-platform-targets.json.
   * Tolerates empty storage or wrapped { contentPlatformTargets: [] } structure.
   */
  protected override async readRaw(): Promise<ContentPlatformTarget[]> {
    try {
      const ContainerSchema = z.union([
        z.object({ contentPlatformTargets: z.array(this.itemSchema) }),
        z.array(this.itemSchema),
      ]);

      const result = await this.safetyService.safeReadJson(
        this.storagePath,
        ContainerSchema,
        { contentPlatformTargets: [] }
      );
      this.lastChecksum = result.checksum;

      if (Array.isArray(result.data)) {
        return result.data;
      }
      return result.data.contentPlatformTargets;
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  /**
   * Safely write records wrapped in { "contentPlatformTargets": [] } with backups and read-back verification.
   */
  protected override async writeRaw(
    items: ContentPlatformTarget[],
    reason: BackupReason = 'BEFORE_UPDATE'
  ): Promise<void> {
    const ContainerSchema = z.object({
      contentPlatformTargets: z.array(this.itemSchema),
    });

    const payload = { contentPlatformTargets: items };
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
   * Find all platform targets for a given content item.
   */
  async findByContentId(contentId: string): Promise<ContentPlatformTarget[]> {
    const items = await this.findAll();
    return items.filter((item) => item.contentId === contentId);
  }

  /**
   * Find target relationship for a specific content item and platform.
   */
  async findByContentAndPlatform(contentId: string, platformId: string): Promise<ContentPlatformTarget | null> {
    const items = await this.findAll();
    return items.find((item) => item.contentId === contentId && item.platformId === platformId) || null;
  }

  /**
   * Set target state (ON/OFF) for a content item and platform.
   * If record exists, updates enabled state without erasing completed status.
   */
  async setTarget(
    contentId: string,
    platformId: string,
    enabled: boolean
  ): Promise<ContentPlatformTarget> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex(
        (i) => i.contentId === contentId && i.platformId === platformId
      );

      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        const existing = items[existingIndex];
        const updated: ContentPlatformTarget = {
          ...existing,
          enabled,
          updatedAt: now,
        };
        items[existingIndex] = updated;
        await this.writeRaw(items, 'BEFORE_UPDATE');
        return updated;
      } else {
        const existingIds = items.map((i) => i.id);
        const id = generateNextId(this.prefix, existingIds);

        const newRecord: ContentPlatformTarget = {
          id,
          contentId,
          platformId,
          enabled,
          completed: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        items.push(newRecord);
        await this.writeRaw(items, 'SYSTEM_SAFETY');
        return newRecord;
      }
    });
  }

  /**
   * Mark a platform target as completed (e.g. from real download or real publish).
   * Automatically sets enabled = true if not already enabled.
   * Idempotent: returns { target, isNewCompletion: false } if already completed.
   */
  async markCompleted(params: {
    contentId: string;
    platformId: string;
    userId?: string;
    source: 'DOWNLOAD' | 'PUBLISH' | 'MANUAL';
    completedAt?: string;
  }): Promise<{ target: ContentPlatformTarget; isNewCompletion: boolean }> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex(
        (i) => i.contentId === params.contentId && i.platformId === params.platformId
      );

      const now = params.completedAt || new Date().toISOString();

      if (existingIndex >= 0) {
        const existing = items[existingIndex];
        const wasAlreadyCompleted = existing.completed === true;

        const updated: ContentPlatformTarget = {
          ...existing,
          enabled: true,
          completed: true,
          completedAt: existing.completedAt || now,
          completedBy: existing.completedBy || params.userId || null,
          source: existing.source || params.source,
          updatedAt: now,
        };

        items[existingIndex] = updated;
        await this.writeRaw(items, 'BEFORE_UPDATE');
        return { target: updated, isNewCompletion: !wasAlreadyCompleted };
      } else {
        const existingIds = items.map((i) => i.id);
        const { generateNextId } = await import('@/lib/utils/id');
        const id = generateNextId(this.prefix, existingIds);

        const newRecord: ContentPlatformTarget = {
          id,
          contentId: params.contentId,
          platformId: params.platformId,
          enabled: true,
          completed: true,
          completedAt: now,
          completedBy: params.userId || null,
          source: params.source,
          createdAt: now,
          updatedAt: now,
        };

        items.push(newRecord);
        await this.writeRaw(items, 'SYSTEM_SAFETY');
        return { target: newRecord, isNewCompletion: true };
      }
    });
  }

  /**
   * Revert a platform target's completion state (completed = false, completedAt = null).
   */
  async unmarkCompleted(params: {
    contentId: string;
    platformId: string;
  }): Promise<ContentPlatformTarget | null> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const existingIndex = items.findIndex(
        (i) => i.contentId === params.contentId && i.platformId === params.platformId
      );

      if (existingIndex < 0) return null;

      const existing = items[existingIndex];
      const now = new Date().toISOString();
      const updated: ContentPlatformTarget = {
        ...existing,
        completed: false,
        completedAt: null,
        completedBy: null,
        updatedAt: now,
      };

      items[existingIndex] = updated;
      await this.writeRaw(items, 'BEFORE_UPDATE');
      return updated;
    });
  }
}
