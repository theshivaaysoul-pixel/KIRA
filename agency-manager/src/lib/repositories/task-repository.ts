// src/lib/repositories/task-repository.ts
// Task repository for KIRA Agency Manager (Phase 10).
// Stores task data at database/tasks.json with structure { "tasks": [] }.
// Uses DataSafetyService for all writes with integrity verification and corruption detection.

import { BaseJsonRepository, ValidationError, DataIntegrityError } from './base-json-repository';
import type { ITaskRepository, ITeamMemberRepository, IContentRepository, ISocialAccountRepository } from './types';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types/domain';
import { TaskSchema, CreateTaskSchema, UpdateTaskSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import type { BackupReason } from '@/lib/storage/backup-types';
import { StorageCorruptionError, StorageVerificationError } from '@/lib/storage/errors';
import { z } from 'zod';

export class TaskRepository
  extends BaseJsonRepository<Task, z.infer<typeof CreateTaskSchema>, z.infer<typeof UpdateTaskSchema>>
  implements ITaskRepository
{
  constructor(
    storage: IStorageService,
    private readonly teamMemberRepo?: ITeamMemberRepository,
    private readonly contentRepo?: IContentRepository,
    private readonly socialAccountRepo?: ISocialAccountRepository
  ) {
    super('database/tasks.json', 'TSK', TaskSchema, CreateTaskSchema, storage);
  }

  /**
   * Safely read tasks from database/tasks.json.
   * Expects { "tasks": [] } container (or legacy array for backward compatibility).
   * Does NOT overwrite malformed files.
   */
  protected override async readRaw(): Promise<Task[]> {
    try {
      const TasksFileSchema = z.union([
        z.object({ tasks: z.array(this.itemSchema) }),
        z.array(this.itemSchema),
      ]);

      const result = await this.safetyService.safeReadJson(
        this.storagePath,
        TasksFileSchema,
        { tasks: [] }
      );
      this.lastChecksum = result.checksum;

      if (Array.isArray(result.data)) {
        return result.data;
      }
      return result.data.tasks;
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  /**
   * Safely write tasks to database/tasks.json wrapped in { "tasks": [] }.
   * Employs DataSafetyService with automated backups and read-back verification.
   */
  protected override async writeRaw(items: Task[], reason: BackupReason = 'BEFORE_UPDATE'): Promise<void> {
    const TasksContainerSchema = z.object({
      tasks: z.array(this.itemSchema),
    });

    const payload = { tasks: items };
    const validationResult = TasksContainerSchema.safeParse(payload);
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
        schema: TasksContainerSchema,
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

  async findByAssignee(userId: string): Promise<Task[]> {
    const items = await this.findAll();
    return items.filter((t) => t.assignedTo === userId);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const items = await this.findAll();
    return items.filter((t) => t.status === status);
  }

  async findByPriority(priority: TaskPriority): Promise<Task[]> {
    const items = await this.findAll();
    return items.filter((t) => t.priority === priority);
  }

  async findByContent(contentId: string): Promise<Task[]> {
    const items = await this.findAll();
    return items.filter((t) => t.relatedContentId === contentId);
  }

  async findByAccount(accountId: string): Promise<Task[]> {
    const items = await this.findAll();
    return items.filter((t) => t.relatedAccountId === accountId);
  }

  async findOverdue(): Promise<Task[]> {
    const now = new Date().toISOString();
    const items = await this.findAll();
    return items.filter(
      (t) => t.dueDate && t.dueDate < now && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );
  }

  async findDueSoon(hours = 24): Promise<Task[]> {
    const nowTime = Date.now();
    const threshold = nowTime + hours * 60 * 60 * 1000;
    const items = await this.findAll();
    return items.filter((t) => {
      if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      const dueTime = new Date(t.dueDate).getTime();
      return dueTime >= nowTime && dueTime <= threshold;
    });
  }

  async search(query: string): Promise<Task[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.findAll();
    const items = await this.findAll();
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }

  private async validateReferences(data: { assignedTo?: string; relatedContentId?: string; relatedAccountId?: string }) {
    if (data.assignedTo && this.teamMemberRepo) {
      const member = await this.teamMemberRepo.findById(data.assignedTo);
      if (!member) {
        throw new ValidationError(`Referenced Team Member ID "${data.assignedTo}" does not exist`);
      }
      if (member.status !== 'ACTIVE') {
        throw new ValidationError(`Referenced Team Member "${member.name}" is ${member.status} and cannot be assigned tasks`);
      }
    }

    if (data.relatedContentId && this.contentRepo) {
      const exists = await this.contentRepo.exists(data.relatedContentId);
      if (!exists) {
        throw new ValidationError(`Referenced Content ID "${data.relatedContentId}" does not exist`);
      }
    }

    if (data.relatedAccountId && this.socialAccountRepo) {
      const exists = await this.socialAccountRepo.exists(data.relatedAccountId);
      if (!exists) {
        throw new ValidationError(`Referenced SocialAccount ID "${data.relatedAccountId}" does not exist`);
      }
    }
  }

  protected override async beforeCreate(data: z.infer<typeof CreateTaskSchema>): Promise<void> {
    await this.validateReferences(data);
  }

  protected override async beforeUpdate(id: string, data: z.infer<typeof UpdateTaskSchema>): Promise<void> {
    await this.validateReferences(data);
  }
}
