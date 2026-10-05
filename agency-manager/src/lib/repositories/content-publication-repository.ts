// src/lib/repositories/content-publication-repository.ts
import { BaseJsonRepository, ValidationError } from './base-json-repository';
import type { IContentPublicationRepository, IContentRepository, ISocialAccountRepository } from './types';
import type { ContentPublication } from '@/lib/types/domain';
import { ContentPublicationSchema, CreateContentPublicationSchema, UpdateContentPublicationSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class ContentPublicationRepository
  extends BaseJsonRepository<ContentPublication, z.infer<typeof CreateContentPublicationSchema>, z.infer<typeof UpdateContentPublicationSchema>>
  implements IContentPublicationRepository
{
  constructor(
    storage: IStorageService,
    private readonly contentRepo?: IContentRepository,
    private readonly socialAccountRepo?: ISocialAccountRepository
  ) {
    super('database/content-publications.json', 'PUB', ContentPublicationSchema, CreateContentPublicationSchema, storage);
  }

  async findByContentId(contentId: string): Promise<ContentPublication[]> {
    const items = await this.findAll();
    return items.filter((p) => p.contentId === contentId);
  }

  async findBySocialAccountId(socialAccountId: string): Promise<ContentPublication[]> {
    const items = await this.findAll();
    return items.filter((p) => p.socialAccountId === socialAccountId);
  }

  protected override async beforeCreate(
    data: z.infer<typeof CreateContentPublicationSchema>
  ): Promise<void> {
    if (this.contentRepo) {
      const contentExists = await this.contentRepo.exists(data.contentId);
      if (!contentExists) {
        throw new ValidationError(`Referenced Content ID "${data.contentId}" does not exist`);
      }
    }

    if (this.socialAccountRepo) {
      const accountExists = await this.socialAccountRepo.exists(data.socialAccountId);
      if (!accountExists) {
        throw new ValidationError(`Referenced SocialAccount ID "${data.socialAccountId}" does not exist`);
      }
    }
  }

  protected override async beforeUpdate(
    id: string,
    data: z.infer<typeof UpdateContentPublicationSchema>
  ): Promise<void> {
    if (data.contentId && this.contentRepo) {
      const contentExists = await this.contentRepo.exists(data.contentId);
      if (!contentExists) {
        throw new ValidationError(`Referenced Content ID "${data.contentId}" does not exist`);
      }
    }

    if (data.socialAccountId && this.socialAccountRepo) {
      const accountExists = await this.socialAccountRepo.exists(data.socialAccountId);
      if (!accountExists) {
        throw new ValidationError(`Referenced SocialAccount ID "${data.socialAccountId}" does not exist`);
      }
    }
  }
}
