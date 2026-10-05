// src/lib/services/social-account-service.ts
// Domain service for Social Account Management in KIRA Agency Manager (Phase 6).
// Handles CRUD, relationship safety, server-side search/filter/sort/pagination,
// dynamic platform correlation, team member assignment, and security audit logging.

import { getRepositories } from '@/lib/repositories';
import type {
  SocialAccountWithRelations,
  SocialAccountQueryResult,
  SocialAccountStatus,
  Platform,
  TeamMember,
} from '@/lib/types/domain';
import { logSecurityActivity } from '@/lib/auth/authorization';
import type { z } from 'zod';
import type { CreateSocialAccountSchema, UpdateSocialAccountSchema } from '@/lib/validation';

export type CreateSocialAccountInput = z.infer<typeof CreateSocialAccountSchema>;
export type UpdateSocialAccountInput = z.infer<typeof UpdateSocialAccountSchema>;

export class AccountInUseError extends Error {
  readonly code = 'ACCOUNT_IN_USE';
  readonly status = 409;
  constructor(
    public readonly accountId: string,
    public readonly stats: {
      publicationCount: number;
      analyticsCount: number;
      taskCount: number;
    }
  ) {
    super(
      `Cannot permanently delete social account "${accountId}": It is referenced by ${stats.publicationCount} publication(s), ${stats.analyticsCount} analytics snapshot(s), and ${stats.taskCount} task(s). Please archive the account instead to preserve historical integrity.`
    );
    this.name = 'AccountInUseError';
  }
}

export class AccountNotFoundError extends Error {
  readonly code = 'ACCOUNT_NOT_FOUND';
  readonly status = 404;
  constructor(public readonly accountId: string) {
    super(`Social account "${accountId}" was not found.`);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountUnauthorizedError extends Error {
  readonly code = 'FORBIDDEN';
  readonly status = 403;
  constructor(message = 'You do not have permission to access or modify this social account.') {
    super(message);
    this.name = 'AccountUnauthorizedError';
  }
}

export interface ListAccountsParams {
  search?: string;
  platformId?: string;
  status?: SocialAccountStatus | 'ALL';
  assignedManagerId?: string;
  sortBy?: 'accountName' | 'username' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export class SocialAccountService {
  /**
   * List social accounts with server-side search, filtering, sorting, and pagination.
   * Correlates platforms, assigned managers, and real relationship counts.
   */
  static async listAccounts(
    params: ListAccountsParams,
    _actor?: TeamMember
  ): Promise<SocialAccountQueryResult> {
    const repos = getRepositories();

    // 1. Fetch raw datasets
    const [rawAccounts, platforms, teamMembers, publications, analytics, tasks] =
      await Promise.all([
        repos.socialAccounts.findAll(),
        repos.platforms.findAll(),
        repos.teamMembers.findAll(),
        repos.publications.findAll(),
        repos.analytics.findAll(),
        repos.tasks.findAll(),
      ]);

    const platformMap = new Map<string, Platform>(platforms.map((p) => [p.id, p]));
    const memberMap = new Map<string, TeamMember>(teamMembers.map((m) => [m.id, m]));

    // Pre-calculate relationship counts per account
    const pubCountMap = new Map<string, number>();
    for (const pub of publications) {
      if (pub.socialAccountId) {
        pubCountMap.set(pub.socialAccountId, (pubCountMap.get(pub.socialAccountId) || 0) + 1);
      }
    }

    const analyticsCountMap = new Map<string, number>();
    for (const snap of analytics) {
      if (snap.socialAccountId) {
        analyticsCountMap.set(
          snap.socialAccountId,
          (analyticsCountMap.get(snap.socialAccountId) || 0) + 1
        );
      }
    }

    const taskCountMap = new Map<string, number>();
    for (const task of tasks) {
      if (task.relatedAccountId) {
        taskCountMap.set(
          task.relatedAccountId,
          (taskCountMap.get(task.relatedAccountId) || 0) + 1
        );
      }
    }

    // 2. Filter accounts
    let filtered = rawAccounts;

    // Platform filter
    if (params.platformId && params.platformId.trim() !== '') {
      filtered = filtered.filter((a) => a.platformId === params.platformId);
    }

    // Status filter
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter((a) => a.status === params.status);
    }

    // Assigned Manager filter
    if (params.assignedManagerId && params.assignedManagerId.trim() !== '') {
      if (params.assignedManagerId === 'UNASSIGNED') {
        filtered = filtered.filter((a) => !a.assignedManagerId);
      } else {
        filtered = filtered.filter((a) => a.assignedManagerId === params.assignedManagerId);
      }
    }

    // Search query filter (search accountName, username, niche, description)
    if (params.search && params.search.trim() !== '') {
      const q = params.search.trim().toLowerCase().replace(/^@+/, '');
      filtered = filtered.filter((a) => {
        const nameMatch = a.accountName.toLowerCase().includes(q);
        const usernameMatch = a.username.toLowerCase().includes(q);
        const nicheMatch = a.niche ? a.niche.toLowerCase().includes(q) : false;
        const descMatch = a.description ? a.description.toLowerCase().includes(q) : false;
        const platform = platformMap.get(a.platformId);
        const platformNameMatch = platform ? platform.name.toLowerCase().includes(q) : false;

        return nameMatch || usernameMatch || nicheMatch || descMatch || platformNameMatch;
      });
    }

    // 3. Sorting
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'accountName':
          return sortOrder * a.accountName.localeCompare(b.accountName);
        case 'username':
          return sortOrder * a.username.localeCompare(b.username);
        case 'status':
          return sortOrder * a.status.localeCompare(b.status);
        case 'updatedAt':
          return sortOrder * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        case 'createdAt':
        default:
          return sortOrder * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    const total = filtered.length;
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // 4. Paginate
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    // 5. Correlate with relations
    const items: SocialAccountWithRelations[] = paginated.map((acc) => ({
      ...acc,
      platform: platformMap.get(acc.platformId) || null,
      assignedManager: acc.assignedManagerId ? memberMap.get(acc.assignedManagerId) || null : null,
      publicationCount: pubCountMap.get(acc.id) || 0,
      analyticsCount: analyticsCountMap.get(acc.id) || 0,
      taskCount: taskCountMap.get(acc.id) || 0,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get a single social account by ID with complete relations and live counts.
   */
  static async getAccountById(
    id: string,
    _actor?: TeamMember
  ): Promise<SocialAccountWithRelations | null> {
    const repos = getRepositories();
    const account = await repos.socialAccounts.findById(id);
    if (!account) return null;

    const [platform, manager, publications, analytics, tasks] = await Promise.all([
      repos.platforms.findById(account.platformId),
      account.assignedManagerId ? repos.teamMembers.findById(account.assignedManagerId) : Promise.resolve(null),
      repos.publications.findBySocialAccountId(id),
      repos.analytics.findBySocialAccount(id),
      repos.tasks.findAll(),
    ]);

    const relatedTasks = tasks.filter((t) => t.relatedAccountId === id);

    return {
      ...account,
      platform,
      assignedManager: manager,
      publicationCount: publications.length,
      analyticsCount: analytics.length,
      taskCount: relatedTasks.length,
    };
  }

  /**
   * Create a new social account record.
   * Enforces server-side ID generation, platform existence/activity, manager status, and audit logging.
   */
  static async createAccount(
    input: CreateSocialAccountInput,
    actor: TeamMember
  ): Promise<SocialAccountWithRelations> {
    const repos = getRepositories();

    // 1. Verify Platform exists and is ACTIVE
    const platform = await repos.platforms.findById(input.platformId);
    if (!platform) {
      throw new Error(`Platform with ID "${input.platformId}" was not found.`);
    }
    if (!platform.isActive) {
      throw new Error(
        `Cannot create social account on inactive platform "${platform.name}". Please activate the platform first.`
      );
    }

    // 2. Verify Manager exists and is ACTIVE if provided
    let manager: TeamMember | null = null;
    if (input.assignedManagerId) {
      manager = await repos.teamMembers.findById(input.assignedManagerId);
      if (!manager) {
        throw new Error(`Team member with ID "${input.assignedManagerId}" was not found.`);
      }
      if (manager.status !== 'ACTIVE') {
        throw new Error(
          `Cannot assign account to ${manager.status.toLowerCase()} team member "${manager.name}".`
        );
      }
    }

    // 3. Normalize username (strip leading @)
    const normalizedUsername = input.username.trim().replace(/^@+/, '');

    // 4. Create in repository (enforces duplicate checks & GCS persistence with read-back verification)
    const created = await repos.socialAccounts.create({
      platformId: input.platformId,
      accountName: input.accountName.trim(),
      username: normalizedUsername,
      profileUrl: input.profileUrl ? input.profileUrl.trim() : undefined,
      avatarUrl: input.avatarUrl ? input.avatarUrl.trim() : undefined,
      niche: input.niche ? input.niche.trim() : undefined,
      description: input.description ? input.description.trim() : undefined,
      status: input.status || 'ACTIVE',
      assignedManagerId: input.assignedManagerId || undefined,
      externalAccountId: input.externalAccountId ? input.externalAccountId.trim() : undefined,
    });

    // 5. Audit Logging
    await logSecurityActivity(
      actor.id,
      'CREATE',
      'SocialAccount',
      created.id,
      {
        accountName: created.accountName,
        username: created.username,
        platformId: created.platformId,
        platformName: platform.name,
        status: created.status,
      }
    );

    return {
      ...created,
      platform,
      assignedManager: manager,
      publicationCount: 0,
      analyticsCount: 0,
      taskCount: 0,
    };
  }

  /**
   * Update an existing social account record.
   * Protects immutable fields (id, createdAt) and enforces platform/manager/reactivation validation.
   */
  static async updateAccount(
    id: string,
    input: UpdateSocialAccountInput,
    actor: TeamMember
  ): Promise<SocialAccountWithRelations> {
    const repos = getRepositories();
    const existing = await repos.socialAccounts.findById(id);
    if (!existing) {
      throw new AccountNotFoundError(id);
    }

    // 1. Validate platform if modified
    const targetPlatformId = input.platformId || existing.platformId;
    const targetPlatform = await repos.platforms.findById(targetPlatformId);
    if (!targetPlatform) {
      throw new Error(`Referenced Platform ID "${targetPlatformId}" does not exist.`);
    }

    if (input.platformId && input.platformId !== existing.platformId) {
      if (!targetPlatform.isActive) {
        throw new Error(
          `Cannot move social account to inactive platform "${targetPlatform.name}".`
        );
      }
    }

    // 2. Validate reactivation to ACTIVE
    if (input.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      if (!targetPlatform.isActive) {
        throw new Error(
          `Cannot reactivate social account because referenced platform "${targetPlatform.name}" is currently inactive. Please activate the platform first.`
        );
      }
    }

    // 3. Validate manager if modified
    let assignedManager: TeamMember | null = null;
    const targetManagerId =
      input.assignedManagerId !== undefined ? input.assignedManagerId : existing.assignedManagerId;

    if (targetManagerId) {
      assignedManager = await repos.teamMembers.findById(targetManagerId);
      if (!assignedManager) {
        throw new Error(`Team member with ID "${targetManagerId}" does not exist.`);
      }
      if (input.assignedManagerId && input.assignedManagerId !== existing.assignedManagerId) {
        if (assignedManager.status !== 'ACTIVE') {
          throw new Error(
            `Cannot assign account to ${assignedManager.status.toLowerCase()} team member "${assignedManager.name}".`
          );
        }
      }
    }

    // 4. Normalize username if modified
    const updatePayload: UpdateSocialAccountInput = { ...input };
    if (updatePayload.username) {
      updatePayload.username = updatePayload.username.trim().replace(/^@+/, '');
    }

    // 5. Update in repository with read-back verification
    const updated = await repos.socialAccounts.update(id, updatePayload);

    // 6. Security Activity Logging
    const isArchiveTransition = input.status === 'ARCHIVED' && existing.status !== 'ARCHIVED';
    await logSecurityActivity(
      actor.id,
      isArchiveTransition ? 'ARCHIVE' : 'UPDATE',
      'SocialAccount',
      id,
      {
        previousStatus: existing.status,
        newStatus: updated.status,
        changedFields: Object.keys(input),
      }
    );

    // 7. Correlate with relations
    const [publications, analytics, tasks] = await Promise.all([
      repos.publications.findBySocialAccountId(id),
      repos.analytics.findBySocialAccount(id),
      repos.tasks.findAll(),
    ]);

    const relatedTasks = tasks.filter((t) => t.relatedAccountId === id);

    return {
      ...updated,
      platform: targetPlatform,
      assignedManager,
      publicationCount: publications.length,
      analyticsCount: analytics.length,
      taskCount: relatedTasks.length,
    };
  }

  /**
   * Delete or archive a social account with relationship protection.
   * If references (publications, analytics, tasks) exist, physical deletion is blocked.
   * The account is instead safely archived to preserve historical data.
   */
  static async deleteOrArchiveAccount(
    id: string,
    actor: TeamMember,
    options?: { forcePermanent?: boolean }
  ): Promise<{
    archived: boolean;
    deleted: boolean;
    message?: string;
  }> {
    const repos = getRepositories();
    const existing = await repos.socialAccounts.findById(id);
    if (!existing) {
      throw new AccountNotFoundError(id);
    }

    // 1. Check existing relationships
    const [publications, analytics, tasks] = await Promise.all([
      repos.publications.findBySocialAccountId(id),
      repos.analytics.findBySocialAccount(id),
      repos.tasks.findAll(),
    ]);

    const relatedTasks = tasks.filter((t) => t.relatedAccountId === id);
    const totalRefs = publications.length + analytics.length + relatedTasks.length;

    // 2. If referenced, block physical deletion
    if (totalRefs > 0) {
      if (options?.forcePermanent) {
        throw new AccountInUseError(id, {
          publicationCount: publications.length,
          analyticsCount: analytics.length,
          taskCount: relatedTasks.length,
        });
      }

      // Safe soft archive
      await repos.socialAccounts.update(id, { status: 'ARCHIVED' });

      await logSecurityActivity(
        actor.id,
        'ARCHIVE',
        'SocialAccount',
        id,
        {
          reason: 'RELATIONSHIP_PROTECTION',
          publicationCount: publications.length,
          analyticsCount: analytics.length,
          taskCount: relatedTasks.length,
        }
      );

      return {
        archived: true,
        deleted: false,
        message: `Account is referenced by ${totalRefs} historical item(s) (${publications.length} publication(s), ${analytics.length} analytics, ${relatedTasks.length} task(s)) and was archived instead of deleted to protect historical records.`,
      };
    }

    // 3. No references exist: perform clean physical deletion
    await repos.socialAccounts.delete(id);

    await logSecurityActivity(
      actor.id,
      'DELETE',
      'SocialAccount',
      id,
      {
        accountName: existing.accountName,
        username: existing.username,
        platformId: existing.platformId,
      }
    );

    return {
      archived: false,
      deleted: true,
      message: `Account "${existing.accountName}" (@${existing.username}) was permanently deleted.`,
    };
  }
}
