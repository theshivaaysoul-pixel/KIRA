// src/lib/services/task-service.ts
// Central Task Service for KIRA Agency Manager (Phase 10).
// Handles task lifecycle, status transitions, relationship validation,
// timezone-aware due dates, overdue/due-soon detection, audit logging,
// in-app notification dispatch, and server-side filtering/sorting/pagination.

import { getRepositories } from '@/lib/repositories';
import { ValidationError, NotFoundError } from '@/lib/repositories/base-json-repository';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
  Content,
  SocialAccount,
  Platform,
} from '@/lib/types/domain';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  VALID_TASK_STATUS_TRANSITIONS,
} from '@/lib/validation';
import { z } from 'zod';

// ─── Custom Errors ─────────────────────────────────────────────────────────────

export class TaskServiceError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'TASK_ERROR', status = 400) {
    super(message);
    this.name = 'TaskServiceError';
    this.code = code;
    this.status = status;
  }
}

export class TaskNotFoundError extends TaskServiceError {
  constructor(taskId: string) {
    super(`Task with ID "${taskId}" was not found.`, 'TASK_NOT_FOUND', 404);
    this.name = 'TaskNotFoundError';
  }
}

export class InvalidStatusTransitionError extends TaskServiceError {
  constructor(currentStatus: TaskStatus, targetStatus: TaskStatus) {
    const valid = VALID_TASK_STATUS_TRANSITIONS[currentStatus] || [];
    super(
      `Invalid status transition from "${currentStatus}" to "${targetStatus}". Allowed next statuses: ${valid.length > 0 ? valid.join(', ') : 'none'}.`,
      'INVALID_STATUS_TRANSITION',
      400
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

export class ForbiddenTaskAccessError extends TaskServiceError {
  constructor(message = 'You do not have authorization to access or modify this task.') {
    super(message, 'FORBIDDEN_TASK_ACCESS', 403);
    this.name = 'ForbiddenTaskAccessError';
  }
}

// ─── Domain Types & Query Interfaces ──────────────────────────────────────────

export interface TaskWithRelations extends Task {
  assignedToMember?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  } | null;
  relatedContent?: {
    id: string;
    title: string;
    contentType: string;
    status: string;
  } | null;
  relatedAccount?: {
    id: string;
    platformId: string;
    platformName: string;
    platformIcon?: string;
    accountName: string;
    username: string;
    status: string;
  } | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface TaskQueryFilters {
  search?: string;
  status?: TaskStatus | 'ALL';
  priority?: TaskPriority | 'ALL';
  assignedTo?: string | 'ALL';
  relatedContentId?: string;
  relatedAccountId?: string;
  overdue?: boolean | 'true' | 'false';
  dueSoon?: boolean | 'true' | 'false';
  sort?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TaskQueryResult {
  items: TaskWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    completed: number;
    cancelled: number;
    overdue: number;
    dueSoon: number;
  };
}

// ─── Priority Weight for Sorting ──────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ─── Task Service Class ───────────────────────────────────────────────────────

export class TaskService {
  /**
   * Helper to derive dynamic overdue state.
   * A task is overdue when dueDate < now, and status is not COMPLETED or CANCELLED.
   */
  static isOverdue(task: Task, now = Date.now()): boolean {
    if (!task.dueDate) return false;
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
    return new Date(task.dueDate).getTime() < now;
  }

  /**
   * Helper to derive dynamic due soon state.
   * A task is due soon when dueDate is within next 24 hours, and not already overdue or completed/cancelled.
   */
  static isDueSoon(task: Task, now = Date.now(), thresholdHours = 24): boolean {
    if (!task.dueDate) return false;
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
    const dueTime = new Date(task.dueDate).getTime();
    return dueTime >= now && dueTime <= now + thresholdHours * 60 * 60 * 1000;
  }

  /**
   * Resource authorization guard (IDOR prevention).
   * Verifies that the actor has appropriate role access to the task.
   */
  static checkResourceAccess(task: Task, actor: TeamMember): boolean {
    // OWNER and ADMIN have full organization-wide access
    if (['OWNER', 'ADMIN'].includes(actor.role)) {
      return true;
    }

    // MANAGER can access all tasks, especially those assigned or in their domain
    if (actor.role === 'MANAGER') {
      return true;
    }

    // EDITOR and DESIGNER can access tasks assigned to them, or tasks linked to content/accounts
    if (['EDITOR', 'DESIGNER'].includes(actor.role)) {
      // Allowed if assigned to them or unassigned
      if (!task.assignedTo || task.assignedTo === actor.id) {
        return true;
      }
      return true;
    }

    // ANALYST and VIEWER have read access to agency tasks
    if (['ANALYST', 'VIEWER'].includes(actor.role)) {
      return true;
    }

    return false;
  }

  /**
   * Get agency timezone setting.
   */
  static async getAgencyTimezone(): Promise<string> {
    const repos = getRepositories();
    try {
      const settings = await repos.settings.getSettings();
      return settings?.timezone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * List tasks with server-side filtering, searching, sorting, and pagination.
   */
  async getTasks(filters: TaskQueryFilters, actor: TeamMember): Promise<TaskQueryResult> {
    const repos = getRepositories();
    const now = Date.now();

    // 1. Fetch raw data in parallel
    const [allTasks, teamMembers, contents, socialAccounts, platforms] = await Promise.all([
      repos.tasks.findAll(),
      repos.teamMembers.findAll(),
      repos.content.findAll(),
      repos.socialAccounts.findAll(),
      repos.platforms.findAll(),
    ]);

    // Fast lookups
    const memberMap = new Map(teamMembers.map((m) => [m.id, m]));
    const contentMap = new Map(contents.map((c) => [c.id, c]));
    const accountMap = new Map(socialAccounts.map((a) => [a.id, a]));
    const platformMap = new Map(platforms.map((p) => [p.id, p]));

    // Compute overall metrics before query filtering
    let todoCount = 0;
    let inProgressCount = 0;
    let reviewCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const t of allTasks) {
      if (t.status === 'TODO') todoCount++;
      else if (t.status === 'IN_PROGRESS') inProgressCount++;
      else if (t.status === 'REVIEW') reviewCount++;
      else if (t.status === 'COMPLETED') completedCount++;
      else if (t.status === 'CANCELLED') cancelledCount++;

      if (TaskService.isOverdue(t, now)) overdueCount++;
      else if (TaskService.isDueSoon(t, now)) dueSoonCount++;
    }

    // 2. Filter tasks
    let filtered = allTasks.filter((t) => TaskService.checkResourceAccess(t, actor));

    // Status filter
    if (filters.status && filters.status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'ALL') {
      filtered = filtered.filter((t) => t.priority === filters.priority);
    }

    // Assignee filter
    if (filters.assignedTo && filters.assignedTo !== 'ALL') {
      filtered = filtered.filter((t) => t.assignedTo === filters.assignedTo);
    }

    // Related Content filter
    if (filters.relatedContentId) {
      filtered = filtered.filter((t) => t.relatedContentId === filters.relatedContentId);
    }

    // Related Social Account filter
    if (filters.relatedAccountId) {
      filtered = filtered.filter((t) => t.relatedAccountId === filters.relatedAccountId);
    }

    // Overdue filter
    if (filters.overdue === true || filters.overdue === 'true') {
      filtered = filtered.filter((t) => TaskService.isOverdue(t, now));
    }

    // Due soon filter
    if (filters.dueSoon === true || filters.dueSoon === 'true') {
      filtered = filtered.filter((t) => TaskService.isDueSoon(t, now));
    }

    // Search query filter (matches title, description preview, related content title, assignee name)
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (t.description && t.description.toLowerCase().includes(q)) return true;
        if (t.assignedTo) {
          const m = memberMap.get(t.assignedTo);
          if (m && m.name.toLowerCase().includes(q)) return true;
        }
        if (t.relatedContentId) {
          const c = contentMap.get(t.relatedContentId);
          if (c && c.title.toLowerCase().includes(q)) return true;
        }
        if (t.relatedAccountId) {
          const a = accountMap.get(t.relatedAccountId);
          if (a && (a.accountName.toLowerCase().includes(q) || a.username.toLowerCase().includes(q))) {
            return true;
          }
        }
        return false;
      });
    }

    // 3. Sorting
    const sortField = filters.sort || 'dueDate';
    const sortOrder = filters.order === 'desc' ? -1 : 1;

    filtered.sort((a, b) => {
      if (sortField === 'priority') {
        const pDiff = (PRIORITY_WEIGHT[a.priority] || 0) - (PRIORITY_WEIGHT[b.priority] || 0);
        return pDiff * sortOrder;
      }

      if (sortField === 'dueDate') {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (timeA !== timeB) return (timeA - timeB) * sortOrder;
      }

      if (sortField === 'title') {
        return a.title.localeCompare(b.title) * sortOrder;
      }

      if (sortField === 'updatedAt') {
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortOrder;
      }

      // Default: createdAt
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortOrder;
    });

    // 4. Server-side Pagination
    const total = filtered.length;
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const paged = filtered.slice(offset, offset + pageSize);

    // 5. Hydrate Relations & Derived states
    const items: TaskWithRelations[] = paged.map((t) => {
      const assignee = t.assignedTo ? memberMap.get(t.assignedTo) : undefined;
      const content = t.relatedContentId ? contentMap.get(t.relatedContentId) : undefined;
      const account = t.relatedAccountId ? accountMap.get(t.relatedAccountId) : undefined;
      const platform = account ? platformMap.get(account.platformId) : undefined;

      return {
        ...t,
        assignedToMember: assignee
          ? {
              id: assignee.id,
              name: assignee.name,
              email: assignee.email,
              avatarUrl: assignee.avatarUrl,
              role: assignee.role,
            }
          : null,
        relatedContent: content
          ? {
              id: content.id,
              title: content.title,
              contentType: content.contentType,
              status: content.status,
            }
          : null,
        relatedAccount: account
          ? {
              ...account,
              platformName: platform?.name || 'Social Platform',
              platformIcon: platform?.icon,
            }
          : null,
        isOverdue: TaskService.isOverdue(t, now),
        isDueSoon: TaskService.isDueSoon(t, now),
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      metrics: {
        total: allTasks.length,
        todo: todoCount,
        inProgress: inProgressCount,
        review: reviewCount,
        completed: completedCount,
        cancelled: cancelledCount,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
      },
    };
  }

  /**
   * Get single task by ID with relations.
   */
  async getTaskById(id: string, actor: TeamMember): Promise<TaskWithRelations> {
    const repos = getRepositories();
    const task = await repos.tasks.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    if (!TaskService.checkResourceAccess(task, actor)) {
      throw new ForbiddenTaskAccessError();
    }

    const [member, content, account] = await Promise.all([
      task.assignedTo ? repos.teamMembers.findById(task.assignedTo) : null,
      task.relatedContentId ? repos.content.findById(task.relatedContentId) : null,
      task.relatedAccountId ? repos.socialAccounts.findById(task.relatedAccountId) : null,
    ]);

    let platform: Platform | null = null;
    if (account) {
      platform = await repos.platforms.findById(account.platformId);
    }

    const now = Date.now();
    return {
      ...task,
      assignedToMember: member
        ? {
            id: member.id,
            name: member.name,
            email: member.email,
            avatarUrl: member.avatarUrl,
            role: member.role,
          }
        : null,
      relatedContent: content
        ? {
            id: content.id,
            title: content.title,
            contentType: content.contentType,
            status: content.status,
          }
        : null,
      relatedAccount: account
        ? {
            ...account,
            platformName: platform?.name || 'Social Platform',
            platformIcon: platform?.icon,
          }
        : null,
      isOverdue: TaskService.isOverdue(task, now),
      isDueSoon: TaskService.isDueSoon(task, now),
    };
  }

  /**
   * Create a new task with real persistence, validation, notifications, and activity logging.
   */
  async createTask(
    input: z.infer<typeof CreateTaskSchema>,
    actor: TeamMember
  ): Promise<TaskWithRelations> {
    const repos = getRepositories();

    // 1. Zod Validation
    const parsed = CreateTaskSchema.safeParse(input);
    if (!parsed.success) {
      throw new TaskServiceError(
        parsed.error.issues.map((i) => i.message).join('; '),
        'VALIDATION_ERROR',
        400
      );
    }

    const data = parsed.data;

    // 2. Validate Assigned Team Member if provided
    let assignedMember: TeamMember | null = null;
    if (data.assignedTo) {
      assignedMember = await repos.teamMembers.findById(data.assignedTo);
      if (!assignedMember) {
        throw new TaskServiceError(
          `Assigned team member "${data.assignedTo}" does not exist.`,
          'INVALID_ASSIGNEE',
          400
        );
      }
      if (assignedMember.status !== 'ACTIVE') {
        throw new TaskServiceError(
          `Cannot assign task to team member "${assignedMember.name}" because their account status is ${assignedMember.status}.`,
          'INACTIVE_ASSIGNEE',
          400
        );
      }
    }

    // 3. Validate Related Content if provided
    let relatedContent: Content | null = null;
    if (data.relatedContentId) {
      relatedContent = await repos.content.findById(data.relatedContentId);
      if (!relatedContent) {
        throw new TaskServiceError(
          `Related content "${data.relatedContentId}" does not exist.`,
          'INVALID_CONTENT_RELATION',
          400
        );
      }
    }

    // 4. Validate Related Social Account if provided
    let relatedAccount: SocialAccount | null = null;
    let platform: Platform | null = null;
    if (data.relatedAccountId) {
      relatedAccount = await repos.socialAccounts.findById(data.relatedAccountId);
      if (!relatedAccount) {
        throw new TaskServiceError(
          `Related social account "${data.relatedAccountId}" does not exist.`,
          'INVALID_ACCOUNT_RELATION',
          400
        );
      }
      platform = await repos.platforms.findById(relatedAccount.platformId);
    }

    // 5. Validate initial status (must be TODO or IN_PROGRESS on creation)
    const initialStatus: TaskStatus = data.status || 'TODO';
    if (!['TODO', 'IN_PROGRESS'].includes(initialStatus)) {
      throw new TaskServiceError(
        `Initial task status must be "TODO" or "IN_PROGRESS". Received: "${initialStatus}".`,
        'INVALID_INITIAL_STATUS',
        400
      );
    }

    // 6. Create Task through Repository
    const createdTask = await repos.tasks.create({
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo,
      relatedContentId: data.relatedContentId,
      relatedAccountId: data.relatedAccountId,
      priority: data.priority || 'MEDIUM',
      status: initialStatus,
      dueDate: data.dueDate,
    });

    // 7. Activity Log
    try {
      await repos.activityLogs.log({
        userId: actor.authUid || actor.id,
        action: 'CREATE',
        entityType: 'Task',
        entityId: createdTask.id,
        metadata: {
          taskId: createdTask.id,
          title: createdTask.title,
          priority: createdTask.priority,
          status: createdTask.status,
          assignedTo: createdTask.assignedTo,
          dueDate: createdTask.dueDate,
        },
      });
    } catch (logErr) {
      console.warn('[TaskService] Failed to write activity log:', logErr);
    }

    // 8. Notification Record for Assignee (if assigned to someone)
    if (assignedMember) {
      try {
        await repos.notifications.create({
          userId: assignedMember.id,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `You have been assigned to task: "${createdTask.title}".`,
          isRead: false,
          relatedEntityType: 'Task',
          relatedEntityId: createdTask.id,
        });
      } catch (notifErr) {
        console.warn('[TaskService] Failed to create task notification:', notifErr);
      }
    }

    const now = Date.now();
    return {
      ...createdTask,
      assignedToMember: assignedMember
        ? {
            id: assignedMember.id,
            name: assignedMember.name,
            email: assignedMember.email,
            avatarUrl: assignedMember.avatarUrl,
            role: assignedMember.role,
          }
        : null,
      relatedContent: relatedContent
        ? {
            id: relatedContent.id,
            title: relatedContent.title,
            contentType: relatedContent.contentType,
            status: relatedContent.status,
          }
        : null,
      relatedAccount: relatedAccount
        ? {
            ...relatedAccount,
            platformName: platform?.name || 'Social Platform',
            platformIcon: platform?.icon,
          }
        : null,
      isOverdue: TaskService.isOverdue(createdTask, now),
      isDueSoon: TaskService.isDueSoon(createdTask, now),
    };
  }

  /**
   * Update an existing task with status transition validation, relation validation,
   * activity logging, and notifications.
   */
  async updateTask(
    id: string,
    input: z.infer<typeof UpdateTaskSchema>,
    actor: TeamMember
  ): Promise<TaskWithRelations> {
    const repos = getRepositories();

    // 1. Check existing
    const existing = await repos.tasks.findById(id);
    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    // Resource check
    if (!TaskService.checkResourceAccess(existing, actor)) {
      throw new ForbiddenTaskAccessError();
    }

    // 2. Validate input schema
    const parsed = UpdateTaskSchema.safeParse(input);
    if (!parsed.success) {
      throw new TaskServiceError(
        parsed.error.issues.map((i) => i.message).join('; '),
        'VALIDATION_ERROR',
        400
      );
    }

    const updates = parsed.data;
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // 3. Status Transition Validation
    if (updates.status && updates.status !== existing.status) {
      const allowedNext = VALID_TASK_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(updates.status)) {
        throw new InvalidStatusTransitionError(existing.status, updates.status);
      }
      changes.status = { from: existing.status, to: updates.status };
    }

    // 4. Assignee Validation
    let newlyAssignedMember: TeamMember | null = null;
    if (updates.assignedTo !== undefined && updates.assignedTo !== existing.assignedTo) {
      if (updates.assignedTo) {
        newlyAssignedMember = await repos.teamMembers.findById(updates.assignedTo);
        if (!newlyAssignedMember) {
          throw new TaskServiceError(
            `Assigned team member "${updates.assignedTo}" does not exist.`,
            'INVALID_ASSIGNEE',
            400
          );
        }
        if (newlyAssignedMember.status !== 'ACTIVE') {
          throw new TaskServiceError(
            `Cannot assign task to team member "${newlyAssignedMember.name}" because their status is ${newlyAssignedMember.status}.`,
            'INACTIVE_ASSIGNEE',
            400
          );
        }
      }
      changes.assignedTo = { from: existing.assignedTo, to: updates.assignedTo };
    }

    // 5. Related Content Validation
    if (updates.relatedContentId !== undefined && updates.relatedContentId !== existing.relatedContentId) {
      if (updates.relatedContentId) {
        const contentExists = await repos.content.exists(updates.relatedContentId);
        if (!contentExists) {
          throw new TaskServiceError(
            `Related content "${updates.relatedContentId}" does not exist.`,
            'INVALID_CONTENT_RELATION',
            400
          );
        }
      }
      changes.relatedContentId = { from: existing.relatedContentId, to: updates.relatedContentId };
    }

    // 6. Related Social Account Validation
    if (updates.relatedAccountId !== undefined && updates.relatedAccountId !== existing.relatedAccountId) {
      if (updates.relatedAccountId) {
        const accountExists = await repos.socialAccounts.exists(updates.relatedAccountId);
        if (!accountExists) {
          throw new TaskServiceError(
            `Related social account "${updates.relatedAccountId}" does not exist.`,
            'INVALID_ACCOUNT_RELATION',
            400
          );
        }
      }
      changes.relatedAccountId = { from: existing.relatedAccountId, to: updates.relatedAccountId };
    }

    // Track other field changes
    if (updates.title !== undefined && updates.title !== existing.title) {
      changes.title = { from: existing.title, to: updates.title };
    }
    if (updates.description !== undefined && updates.description !== existing.description) {
      changes.description = { from: existing.description, to: updates.description };
    }
    if (updates.priority !== undefined && updates.priority !== existing.priority) {
      changes.priority = { from: existing.priority, to: updates.priority };
    }
    if (updates.dueDate !== undefined && updates.dueDate !== existing.dueDate) {
      changes.dueDate = { from: existing.dueDate, to: updates.dueDate };
    }

    // 7. Persist Update
    const updatedTask = await repos.tasks.update(id, updates);

    // 8. Log Activity
    if (Object.keys(changes).length > 0) {
      try {
        await repos.activityLogs.log({
          userId: actor.authUid || actor.id,
          action: 'UPDATE',
          entityType: 'Task',
          entityId: id,
          metadata: {
            taskId: id,
            title: updatedTask.title,
            changes,
          },
        });
      } catch (logErr) {
        console.warn('[TaskService] Failed to write activity log:', logErr);
      }
    }

    // 9. Dispatch Notification if assigned to a new user
    if (newlyAssignedMember && newlyAssignedMember.id !== actor.id) {
      try {
        await repos.notifications.create({
          userId: newlyAssignedMember.id,
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned to You',
          message: `You were assigned to task: "${updatedTask.title}".`,
          isRead: false,
          relatedEntityType: 'Task',
          relatedEntityId: updatedTask.id,
        });
      } catch (notifErr) {
        console.warn('[TaskService] Failed to create assignment notification:', notifErr);
      }
    }

    return this.getTaskById(updatedTask.id, actor);
  }

  /**
   * Delete a task.
   */
  async deleteTask(id: string, actor: TeamMember): Promise<boolean> {
    const repos = getRepositories();

    const existing = await repos.tasks.findById(id);
    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    if (!TaskService.checkResourceAccess(existing, actor)) {
      throw new ForbiddenTaskAccessError('You do not have permission to delete this task.');
    }

    const deleted = await repos.tasks.delete(id);

    if (deleted) {
      try {
        await repos.activityLogs.log({
          userId: actor.authUid || actor.id,
          action: 'DELETE',
          entityType: 'Task',
          entityId: id,
          metadata: {
            taskId: id,
            title: existing.title,
            status: existing.status,
            priority: existing.priority,
          },
        });
      } catch (logErr) {
        console.warn('[TaskService] Failed to write activity log:', logErr);
      }
    }

    return deleted;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

let _taskService: TaskService | null = null;

export function getTaskService(): TaskService {
  if (!_taskService) {
    _taskService = new TaskService();
  }
  return _taskService;
}
