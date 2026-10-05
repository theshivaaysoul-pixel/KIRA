// src/lib/repositories/team-member-repository.ts
import { BaseJsonRepository, ConflictError } from './base-json-repository';
import type { ITeamMemberRepository } from './types';
import type { TeamMember } from '@/lib/types/domain';
import { TeamMemberSchema, CreateTeamMemberSchema, UpdateTeamMemberSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class TeamMemberRepository
  extends BaseJsonRepository<TeamMember, z.infer<typeof CreateTeamMemberSchema>, z.infer<typeof UpdateTeamMemberSchema>>
  implements ITeamMemberRepository
{
  constructor(storage: IStorageService) {
    super('database/team-members.json', 'USR', TeamMemberSchema, CreateTeamMemberSchema, storage);
  }

  async findByEmail(email: string): Promise<TeamMember | null> {
    const items = await this.findAll();
    return items.find((m) => m.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findByAuthUid(authUid: string): Promise<TeamMember | null> {
    const items = await this.findAll();
    return items.find((m) => m.authUid === authUid) || null;
  }

  async findByAuthIdentity(authUid: string, email?: string): Promise<TeamMember | null> {
    const byUid = await this.findByAuthUid(authUid);
    if (byUid) return byUid;

    if (email) {
      const byEmail = await this.findByEmail(email);
      if (byEmail) {
        if (!byEmail.authUid || byEmail.authUid !== authUid) {
          try {
            return await this.update(byEmail.id, { authUid });
          } catch {
            return byEmail;
          }
        }
        return byEmail;
      }
    }

    return null;
  }

  async countActiveOwners(): Promise<number> {
    const items = await this.findAll();
    return items.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE').length;
  }

  protected override async beforeCreate(
    data: z.infer<typeof CreateTeamMemberSchema>,
    currentItems: TeamMember[]
  ): Promise<void> {
    const existing = currentItems.find(
      (m) => m.email.toLowerCase() === data.email.toLowerCase()
    );
    if (existing) {
      throw new ConflictError(`Team member with email "${data.email}" already exists`);
    }
  }

  protected override async beforeUpdate(
    id: string,
    data: z.infer<typeof UpdateTeamMemberSchema>,
    currentItems: TeamMember[]
  ): Promise<void> {
    if (data.email) {
      const existing = currentItems.find(
        (m) => m.email.toLowerCase() === data.email!.toLowerCase() && m.id !== id
      );
      if (existing) {
        throw new ConflictError(`Team member with email "${data.email}" already exists on another record`);
      }
    }
  }
}
