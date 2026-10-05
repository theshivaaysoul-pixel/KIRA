// src/lib/repositories/notification-repository.ts
import { BaseJsonRepository } from './base-json-repository';
import type { INotificationRepository } from './types';
import type { Notification } from '@/lib/types/domain';
import { NotificationSchema, CreateNotificationSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { z } from 'zod';

export class NotificationRepository
  extends BaseJsonRepository<Notification, z.infer<typeof CreateNotificationSchema>, Partial<z.infer<typeof CreateNotificationSchema>>>
  implements INotificationRepository
{
  constructor(storage: IStorageService) {
    super('database/notifications.json', 'NTF', NotificationSchema, CreateNotificationSchema, storage);
  }

  async findUnreadByUser(userId: string): Promise<Notification[]> {
    const items = await this.findAll();
    return items.filter((n) => n.userId === userId && !n.isRead);
  }

  async markAsRead(id: string): Promise<boolean> {
    try {
      await this.update(id, { isRead: true });
      return true;
    } catch {
      return false;
    }
  }
}
