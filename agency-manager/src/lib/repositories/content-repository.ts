// src/lib/repositories/content-repository.ts
import { BaseJsonRepository } from './base-json-repository';
import type { IContentRepository } from './types';
import type { Content } from '@/lib/types/domain';
import { ContentSchema, CreateContentSchema, UpdateContentSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class ContentRepository
  extends BaseJsonRepository<Content, z.infer<typeof CreateContentSchema>, z.infer<typeof UpdateContentSchema>>
  implements IContentRepository
{
  constructor(storage: IStorageService) {
    super('database/content.json', 'CNT', ContentSchema, CreateContentSchema, storage);
  }

  async findByStatus(status: Content['status']): Promise<Content[]> {
    const items = await this.findAll();
    return items.filter((c) => c.status === status);
  }
}
