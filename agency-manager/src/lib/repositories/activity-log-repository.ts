// src/lib/repositories/activity-log-repository.ts
import { BaseJsonRepository } from './base-json-repository';
import type { IActivityLogRepository } from './types';
import type { ActivityLog } from '@/lib/types/domain';
import { ActivityLogSchema, CreateActivityLogSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class ActivityLogRepository
  extends BaseJsonRepository<ActivityLog, z.infer<typeof CreateActivityLogSchema>, Partial<z.infer<typeof CreateActivityLogSchema>>>
  implements IActivityLogRepository
{
  constructor(storage: IStorageService) {
    super('database/activity-logs.json', 'ACT', ActivityLogSchema, CreateActivityLogSchema, storage);
  }

  async log(entry: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    return this.create(entry);
  }

  async findByUser(userId: string): Promise<ActivityLog[]> {
    const items = await this.findAll();
    return items.filter((log) => log.userId === userId);
  }
}
