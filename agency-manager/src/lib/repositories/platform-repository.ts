// src/lib/repositories/platform-repository.ts
import { BaseJsonRepository, ConflictError } from './base-json-repository';
import type { IPlatformRepository } from './types';
import type { Platform } from '@/lib/types/domain';
import { PlatformSchema, CreatePlatformSchema, UpdatePlatformSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class PlatformRepository
  extends BaseJsonRepository<Platform, z.infer<typeof CreatePlatformSchema>, z.infer<typeof UpdatePlatformSchema>>
  implements IPlatformRepository
{
  constructor(storage: IStorageService) {
    super('database/platforms.json', 'PLT', PlatformSchema, CreatePlatformSchema, storage);
  }

  async findBySlug(slug: string): Promise<Platform | null> {
    const items = await this.findAll();
    return items.find((p) => p.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  protected override async beforeCreate(
    data: z.infer<typeof CreatePlatformSchema>,
    currentItems: Platform[]
  ): Promise<void> {
    const existing = currentItems.find(
      (p) => p.slug.toLowerCase() === data.slug.toLowerCase()
    );
    if (existing) {
      throw new ConflictError(`Platform with slug "${data.slug}" already exists (ID: ${existing.id})`);
    }
  }

  protected override async beforeUpdate(
    id: string,
    data: z.infer<typeof UpdatePlatformSchema>,
    currentItems: Platform[]
  ): Promise<void> {
    if (data.slug) {
      const existing = currentItems.find(
        (p) => p.slug.toLowerCase() === data.slug!.toLowerCase() && p.id !== id
      );
      if (existing) {
        throw new ConflictError(`Platform with slug "${data.slug}" already exists on another record`);
      }
    }
  }
}
