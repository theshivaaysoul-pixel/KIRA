// src/lib/repositories/content-asset-repository.ts
import { BaseJsonRepository, ValidationError } from './base-json-repository';
import type { IContentAssetRepository, IContentRepository } from './types';
import type { ContentAsset } from '@/lib/types/domain';
import { ContentAssetSchema, CreateContentAssetSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class ContentAssetRepository
  extends BaseJsonRepository<ContentAsset, z.infer<typeof CreateContentAssetSchema>, Partial<z.infer<typeof CreateContentAssetSchema>>>
  implements IContentAssetRepository
{
  constructor(
    storage: IStorageService,
    private readonly contentRepo?: IContentRepository
  ) {
    super('database/content-assets.json', 'AST', ContentAssetSchema, CreateContentAssetSchema, storage);
  }

  async findByContentId(contentId: string): Promise<ContentAsset[]> {
    const items = await this.findAll();
    return items.filter((a) => a.contentId === contentId);
  }

  protected override async beforeCreate(
    data: z.infer<typeof CreateContentAssetSchema>
  ): Promise<void> {
    if (this.contentRepo) {
      const contentExists = await this.contentRepo.exists(data.contentId);
      if (!contentExists) {
        throw new ValidationError(`Referenced Content ID "${data.contentId}" does not exist`);
      }
    }
  }
}
