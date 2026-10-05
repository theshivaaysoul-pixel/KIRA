// src/lib/repositories/analytics-repository.ts
import { BaseJsonRepository, ValidationError } from './base-json-repository';
import type { IAnalyticsRepository, ISocialAccountRepository, IContentRepository } from './types';
import type { AnalyticsSnapshot } from '@/lib/types/domain';
import { AnalyticsSnapshotSchema, CreateAnalyticsSnapshotSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class AnalyticsRepository
  extends BaseJsonRepository<AnalyticsSnapshot, z.infer<typeof CreateAnalyticsSnapshotSchema>, Partial<z.infer<typeof CreateAnalyticsSnapshotSchema>>>
  implements IAnalyticsRepository
{
  constructor(
    storage: IStorageService,
    private readonly socialAccountRepo?: ISocialAccountRepository,
    private readonly contentRepo?: IContentRepository
  ) {
    super('database/analytics.json', 'ANL', AnalyticsSnapshotSchema, CreateAnalyticsSnapshotSchema, storage);
  }

  async findBySocialAccount(socialAccountId: string): Promise<AnalyticsSnapshot[]> {
    const items = await this.findAll();
    return items.filter((a) => a.socialAccountId === socialAccountId);
  }

  protected override async beforeCreate(data: z.infer<typeof CreateAnalyticsSnapshotSchema>): Promise<void> {
    if (this.socialAccountRepo) {
      const exists = await this.socialAccountRepo.exists(data.socialAccountId);
      if (!exists) {
        throw new ValidationError(`Referenced SocialAccount ID "${data.socialAccountId}" does not exist`);
      }
    }

    if (data.contentId && this.contentRepo) {
      const exists = await this.contentRepo.exists(data.contentId);
      if (!exists) {
        throw new ValidationError(`Referenced Content ID "${data.contentId}" does not exist`);
      }
    }
  }
}
