// src/lib/repositories/social-account-repository.ts
import { BaseJsonRepository, ValidationError, ConflictError } from './base-json-repository';
import type { ISocialAccountRepository, IPlatformRepository, ITeamMemberRepository } from './types';
import type { SocialAccount } from '@/lib/types/domain';
import { SocialAccountSchema, CreateSocialAccountSchema, UpdateSocialAccountSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class SocialAccountRepository
  extends BaseJsonRepository<SocialAccount, z.infer<typeof CreateSocialAccountSchema>, z.infer<typeof UpdateSocialAccountSchema>>
  implements ISocialAccountRepository
{
  constructor(
    storage: IStorageService,
    private readonly platformRepo?: IPlatformRepository,
    private readonly teamMemberRepo?: ITeamMemberRepository
  ) {
    super('database/social-accounts.json', 'ACC', SocialAccountSchema, CreateSocialAccountSchema, storage);
  }

  async findByPlatform(platformId: string): Promise<SocialAccount[]> {
    const items = await this.findAll();
    return items.filter((a) => a.platformId === platformId);
  }

  async findByUsername(platformId: string, username: string): Promise<SocialAccount | null> {
    const items = await this.findAll();
    return items.find((a) => a.platformId === platformId && a.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async findByExternalAccountId(platformId: string, externalAccountId: string): Promise<SocialAccount | null> {
    const items = await this.findAll();
    return items.find((a) => a.platformId === platformId && a.externalAccountId === externalAccountId) || null;
  }

  protected override async beforeCreate(
    data: z.infer<typeof CreateSocialAccountSchema>,
    currentItems: SocialAccount[]
  ): Promise<void> {
    // 1. Relationship validation: platformId must exist and be ACTIVE for new accounts
    if (this.platformRepo) {
      const platform = await this.platformRepo.findById(data.platformId);
      if (!platform) {
        throw new ValidationError(`Referenced Platform ID "${data.platformId}" does not exist`);
      }
      if (!platform.isActive) {
        throw new ValidationError(
          `Cannot create social account on inactive platform "${platform.name}" (${platform.id}). Please activate the platform first.`
        );
      }
    }

    // 2. Relationship validation: assignedManagerId must exist and be ACTIVE if provided
    if (data.assignedManagerId && this.teamMemberRepo) {
      const manager = await this.teamMemberRepo.findById(data.assignedManagerId);
      if (!manager) {
        throw new ValidationError(`Referenced Team Member ID "${data.assignedManagerId}" does not exist`);
      }
      if (manager.status !== 'ACTIVE') {
        throw new ValidationError(
          `Cannot assign account to ${manager.status.toLowerCase()} team member "${manager.name}". Assigned manager must be an active team member.`
        );
      }
    }

    // 3. Duplicate check: same username on the same platform
    const duplicate = currentItems.find(
      (a) => a.platformId === data.platformId && a.username.toLowerCase() === data.username.toLowerCase()
    );
    if (duplicate) {
      throw new ConflictError(`Social account "${data.username}" already exists on platform "${data.platformId}"`);
    }

    // 4. Duplicate check: same externalAccountId on the same platform if provided
    if (data.externalAccountId) {
      const duplicateExt = currentItems.find(
        (a) => a.platformId === data.platformId && a.externalAccountId === data.externalAccountId
      );
      if (duplicateExt) {
        throw new ConflictError(
          `External account ID "${data.externalAccountId}" is already connected to another account on platform "${data.platformId}"`
        );
      }
    }
  }

  protected override async beforeUpdate(
    id: string,
    data: z.infer<typeof UpdateSocialAccountSchema>,
    currentItems: SocialAccount[]
  ): Promise<void> {
    const existingItem = currentItems.find((a) => a.id === id);
    const targetPlatformId = data.platformId || existingItem?.platformId;

    // 1. Validate platform exists and is active if changing platforms
    if (data.platformId && this.platformRepo) {
      const platform = await this.platformRepo.findById(data.platformId);
      if (!platform) {
        throw new ValidationError(`Referenced Platform ID "${data.platformId}" does not exist`);
      }
      if (existingItem && existingItem.platformId !== data.platformId && !platform.isActive) {
        throw new ValidationError(
          `Cannot move social account to inactive platform "${platform.name}" (${platform.id}). Please activate the platform first.`
        );
      }
    }

    // 2. Validate manager exists and is active if changing manager
    if (data.assignedManagerId && this.teamMemberRepo) {
      const manager = await this.teamMemberRepo.findById(data.assignedManagerId);
      if (!manager) {
        throw new ValidationError(`Referenced Team Member ID "${data.assignedManagerId}" does not exist`);
      }
      if (manager.status !== 'ACTIVE') {
        throw new ValidationError(
          `Cannot assign account to ${manager.status.toLowerCase()} team member "${manager.name}". Assigned manager must be an active team member.`
        );
      }
    }

    // 3. Reactivation to ACTIVE requires referenced platform to be active
    if (data.status === 'ACTIVE' && this.platformRepo && targetPlatformId) {
      const platform = await this.platformRepo.findById(targetPlatformId);
      if (!platform || !platform.isActive) {
        throw new ValidationError(
          `Cannot set account status to ACTIVE because referenced platform "${platform ? platform.name : targetPlatformId}" is inactive. Please activate the platform first.`
        );
      }
    }

    // 4. Duplicate check: username uniqueness
    if (data.username || data.platformId) {
      const targetUsername = data.username || existingItem?.username;

      if (targetPlatformId && targetUsername) {
        const duplicate = currentItems.find(
          (a) =>
            a.id !== id &&
            a.platformId === targetPlatformId &&
            a.username.toLowerCase() === targetUsername.toLowerCase()
        );
        if (duplicate) {
          throw new ConflictError(`Social account "${targetUsername}" already exists on platform "${targetPlatformId}"`);
        }
      }
    }

    // 5. Duplicate check: externalAccountId uniqueness
    if (data.externalAccountId !== undefined || data.platformId) {
      const targetExtId = data.externalAccountId !== undefined ? data.externalAccountId : existingItem?.externalAccountId;

      if (targetPlatformId && targetExtId) {
        const duplicateExt = currentItems.find(
          (a) =>
            a.id !== id &&
            a.platformId === targetPlatformId &&
            a.externalAccountId === targetExtId
        );
        if (duplicateExt) {
          throw new ConflictError(
            `External account ID "${targetExtId}" is already connected to another account on platform "${targetPlatformId}"`
          );
        }
      }
    }
  }
}
