// src/lib/services/platform-service.ts
// Domain service for dynamic platform management.
// Enforces slug uniqueness, capability validation, relationship safety, and audit logging.

import { getRepositories } from '@/lib/repositories';
import type {
  Platform,
  PlatformWithStats,
  PlatformCapability,
  TeamMember,
} from '@/lib/types/domain';
import { logSecurityActivity } from '@/lib/auth/authorization';
import type { z } from 'zod';
import type { CreatePlatformSchema, UpdatePlatformSchema } from '@/lib/validation';

export type CreatePlatformInput = z.infer<typeof CreatePlatformSchema>;
export type UpdatePlatformInput = z.infer<typeof UpdatePlatformSchema>;

export class PlatformInUseError extends Error {
  readonly code = 'PLATFORM_IN_USE';
  readonly status = 409;
  constructor(
    public readonly platformId: string,
    public readonly accountCount: number
  ) {
    super(
      `Cannot delete platform "${platformId}": ${accountCount} social account(s) are currently connected. Please deactivate the platform instead to preserve historical records.`
    );
    this.name = 'PlatformInUseError';
  }
}

export class PlatformNotFoundError extends Error {
  readonly code = 'PLATFORM_NOT_FOUND';
  readonly status = 404;
  constructor(public readonly platformId: string) {
    super(`Platform with ID "${platformId}" was not found.`);
    this.name = 'PlatformNotFoundError';
  }
}

export class PlatformSlugExistsError extends Error {
  readonly code = 'PLATFORM_SLUG_EXISTS';
  readonly status = 409;
  constructor(public readonly slug: string) {
    super(`A platform with slug "${slug}" already exists.`);
    this.name = 'PlatformSlugExistsError';
  }
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface PlatformQueryOptions {
  search?: string;
  isActive?: boolean | 'all';
  capability?: PlatformCapability;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'isActive';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  view?: 'active' | 'bin';
}

export interface PlatformQueryResult {
  platforms: PlatformWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    active: number;
    inactive: number;
    totalAccounts: number;
    bin: number;
  };
}

export interface PlatformSeedResult {
  created: number;
  skipped: number;
  failed: number;
  platforms: Platform[];
}

export const DEFAULT_PLATFORMS: Array<{
  name: string;
  slug: string;
  icon: string;
  description: string;
  capabilities: PlatformCapability[];
  isActive: boolean;
}> = [
  {
    name: 'Instagram',
    slug: 'instagram',
    icon: '/logos/Instagram.png',
    description: 'Visual photo and video sharing platform with Stories and Reels',
    capabilities: ['image', 'video', 'carousel', 'story', 'shortVideo', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'TikTok',
    slug: 'tiktok',
    icon: '/logos/Tiktok.png',
    description: 'Short-form mobile video creation and discovery network',
    capabilities: ['video', 'shortVideo', 'live', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'X',
    slug: 'x',
    icon: '/logos/X.png',
    description: 'Real-time microblogging, breaking discussions, and multimedia threads',
    capabilities: ['text', 'image', 'video', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'YouTube',
    slug: 'youtube',
    icon: '/logos/Youtube.png',
    description: 'Global long-form video broadcasting and YouTube Shorts network',
    capabilities: ['video', 'shortVideo', 'live', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'Facebook',
    slug: 'facebook',
    icon: '/logos/Facebook.png',
    description: 'Connected community pages, feeds, reels, and video broadcasting',
    capabilities: ['text', 'image', 'video', 'carousel', 'story', 'live', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'Threads',
    slug: 'threads',
    icon: '/logos/Threads.png',
    description: 'Text-based conversations, public discussions, and creator updates',
    capabilities: ['text', 'image', 'video', 'scheduling', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'Kick',
    slug: 'kick',
    icon: '/logos/KICK.png',
    description: 'Interactive creator live streaming and broadcasting community',
    capabilities: ['video', 'live', 'analytics', 'publishing'],
    isActive: true,
  },
  {
    name: 'Snapchat',
    slug: 'snapchat',
    icon: '/logos/Snapchat.png',
    description: 'Ephemeral multimedia stories and vertical Spotlight video discovery',
    capabilities: ['image', 'video', 'story', 'shortVideo', 'publishing'],
    isActive: true,
  },
];

export class PlatformService {
  private get repos() {
    return getRepositories();
  }

  /**
   * List platforms with server-side search, filtering, sorting, and pagination.
   */
  async listPlatforms(options: PlatformQueryOptions = {}): Promise<PlatformQueryResult> {
    const [initialPlatforms, allAccounts] = await Promise.all([
      this.repos.platforms.findAll(),
      this.repos.socialAccounts.findAll(),
    ]);
    let allPlatforms = initialPlatforms;

    // 1. Auto-purge expired bin platforms (older than 30 days)
    const now = Date.now();
    const expired = allPlatforms.filter(
      (p) => p.deletedAt && now - new Date(p.deletedAt).getTime() > THIRTY_DAYS_MS
    );
    if (expired.length > 0) {
      for (const exp of expired) {
        try {
          const accounts = await this.repos.socialAccounts.findByPlatform(exp.id);
          if (accounts.length === 0) {
            await this.repos.platforms.delete(exp.id);
          }
        } catch (e) {
          console.warn(`[PlatformService] Auto-purge failed for ${exp.id}:`, e);
        }
      }
      allPlatforms = await this.repos.platforms.findAll();
    }

    // Map account count per platformId
    const accountCountMap = new Map<string, number>();
    for (const account of allAccounts) {
      const current = accountCountMap.get(account.platformId) || 0;
      accountCountMap.set(account.platformId, current + 1);
    }

    const totalAccounts = allAccounts.length;
    const binCount = allPlatforms.filter((p) => Boolean(p.deletedAt)).length;
    const activeNonDeleted = allPlatforms.filter((p) => !p.deletedAt && p.isActive).length;
    const inactiveNonDeleted = allPlatforms.filter((p) => !p.deletedAt && !p.isActive).length;
    const totalNonDeleted = allPlatforms.filter((p) => !p.deletedAt).length;

    const view = options.view || 'active';

    // Filter
    let filtered = allPlatforms.map((p) => ({
      ...p,
      accountCount: accountCountMap.get(p.id) || 0,
    }));

    filtered = filtered.filter((p) => {
      // View isolation: 'bin' shows ONLY deleted platforms; 'active' shows ONLY non-deleted platforms
      if (view === 'bin') {
        if (!p.deletedAt) return false;
      } else {
        if (p.deletedAt) return false;
      }

      if (options.isActive !== undefined && options.isActive !== 'all') {
        const activeFilter = Boolean(options.isActive);
        if (p.isActive !== activeFilter) return false;
      }

      if (options.capability && !p.capabilities.includes(options.capability)) {
        return false;
      }

      if (options.search && options.search.trim()) {
        const term = options.search.trim().toLowerCase();
        const matches =
          p.name.toLowerCase().includes(term) ||
          p.slug.toLowerCase().includes(term) ||
          Boolean(p.description && p.description.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });

    // Sort
    const sortField = options.sort || 'name';
    const sortOrder = options.order === 'desc' ? -1 : 1;

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortField === 'isActive') {
        comparison = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1);
      }
      return comparison * sortOrder;
    });

    // Pagination
    const total = filtered.length;
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 50));
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      platforms: paginated,
      total,
      page,
      limit,
      totalPages,
      stats: {
        total: totalNonDeleted,
        active: activeNonDeleted,
        inactive: inactiveNonDeleted,
        totalAccounts,
        bin: binCount,
      },
    };
  }

  /**
   * Retrieve single platform by ID with connected account count.
   */
  async getPlatformById(id: string): Promise<PlatformWithStats | null> {
    const platform = (await this.repos.platforms.findById(id)) || (await this.repos.platforms.findBySlug(id));
    if (!platform) return null;

    const accounts = await this.repos.socialAccounts.findByPlatform(platform.id);
    return {
      ...platform,
      accountCount: accounts.length,
    };
  }

  /**
   * Retrieve platform by slug.
   */
  async getPlatformBySlug(slug: string): Promise<Platform | null> {
    return this.repos.platforms.findBySlug(slug);
  }

  /**
   * Create a new platform.
   */
  async createPlatform(
    actor: TeamMember,
    data: CreatePlatformInput
  ): Promise<Platform> {
    // Validate slug uniqueness
    const existing = await this.repos.platforms.findBySlug(data.slug);
    if (existing) {
      throw new PlatformSlugExistsError(data.slug);
    }

    const created = await this.repos.platforms.create(data);

    await logSecurityActivity(
      actor.authUid || actor.id,
      'CREATE',
      'Platform',
      created.id,
      {
        name: created.name,
        slug: created.slug,
        capabilities: created.capabilities,
        isActive: created.isActive,
        createdBy: actor.id,
      }
    );

    return created;
  }

  /**
   * Update an existing platform.
   */
  async updatePlatform(
    actor: TeamMember,
    id: string,
    data: UpdatePlatformInput
  ): Promise<Platform> {
    const existing = await this.repos.platforms.findById(id);
    if (!existing) {
      throw new PlatformNotFoundError(id);
    }

    if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const slugMatch = await this.repos.platforms.findBySlug(data.slug);
      if (slugMatch && slugMatch.id !== id) {
        throw new PlatformSlugExistsError(data.slug);
      }
    }

    const updated = await this.repos.platforms.update(id, data);

    await logSecurityActivity(
      actor.authUid || actor.id,
      'UPDATE',
      'Platform',
      updated.id,
      {
        changes: Object.keys(data),
        name: updated.name,
        slug: updated.slug,
        isActive: updated.isActive,
        updatedBy: actor.id,
      }
    );

    return updated;
  }

  /**
   * Deactivate a platform safely (soft deactivation).
   * Preserves all connected accounts and historical content.
   */
  async deactivatePlatform(actor: TeamMember, id: string): Promise<Platform> {
    return this.updatePlatform(actor, id, { isActive: false });
  }

  /**
   * Move a platform to the Bin (recoverable for 30 days).
   * Deactivates the platform and sets deletedAt timestamp.
   */
  async moveToBin(actor: TeamMember, id: string): Promise<Platform> {
    const platform = await this.repos.platforms.findById(id);
    if (!platform) {
      throw new PlatformNotFoundError(id);
    }

    const updated = await this.repos.platforms.update(id, {
      deletedAt: new Date().toISOString(),
      isActive: false,
    });

    await logSecurityActivity(
      actor.authUid || actor.id,
      'DELETE',
      'Platform',
      id,
      {
        name: platform.name,
        slug: platform.slug,
        action: 'MOVE_TO_BIN',
        deletedBy: actor.id,
      }
    );

    return updated;
  }

  /**
   * Restore platform from Bin back to active status.
   * Only permitted within 30 days of deletion.
   */
  async restoreFromBin(actor: TeamMember, id: string): Promise<Platform> {
    const platform = await this.repos.platforms.findById(id);
    if (!platform) {
      throw new PlatformNotFoundError(id);
    }

    if (platform.deletedAt) {
      const elapsed = Date.now() - new Date(platform.deletedAt).getTime();
      if (elapsed > THIRTY_DAYS_MS) {
        // Expired: attempt permanent delete and reject restore
        const accounts = await this.repos.socialAccounts.findByPlatform(id);
        if (accounts.length === 0) {
          await this.repos.platforms.delete(id);
        }
        throw new Error(
          'Platform cannot be restored: 30-day recovery period has expired and platform was permanently deleted.'
        );
      }
    }

    const updated = await this.repos.platforms.update(id, {
      deletedAt: null,
      isActive: true,
    });

    await logSecurityActivity(
      actor.authUid || actor.id,
      'UPDATE',
      'Platform',
      id,
      {
        name: platform.name,
        slug: platform.slug,
        action: 'RESTORE_FROM_BIN',
        restoredBy: actor.id,
      }
    );

    return updated;
  }

  /**
   * Empty the Recycle Bin permanently deleting all platforms in bin.
   * Enforces relationship protection if any accounts are still connected.
   */
  async emptyBin(actor: TeamMember): Promise<{ deletedCount: number; blockedCount: number }> {
    const all = await this.repos.platforms.findAll();
    const binItems = all.filter((p) => Boolean(p.deletedAt));
    let deletedCount = 0;
    let blockedCount = 0;

    for (const item of binItems) {
      const accounts = await this.repos.socialAccounts.findByPlatform(item.id);
      if (accounts.length > 0) {
        blockedCount++;
        continue;
      }
      try {
        await this.repos.platforms.delete(item.id);
        deletedCount++;
        await logSecurityActivity(
          actor.authUid || actor.id,
          'DELETE',
          'Platform',
          item.id,
          {
            name: item.name,
            slug: item.slug,
            action: 'PERMANENT_DELETE_EMPTY_BIN',
            deletedBy: actor.id,
          }
        );
      } catch (err) {
        console.warn(`[emptyBin] Failed to delete ${item.id}:`, err);
      }
    }

    return { deletedCount, blockedCount };
  }

  /**
   * Delete or move a platform to the Bin.
   * If forcePermanent or already in Bin, permanently deletes with relationship protection.
   * Otherwise moves to Bin (recoverable for 30 days).
   */
  async deletePlatform(
    actor: TeamMember,
    id: string,
    forcePermanent = false
  ): Promise<{ success: boolean; deletedId: string; movedToBin: boolean }> {
    const platform = await this.repos.platforms.findById(id);
    if (!platform) {
      throw new PlatformNotFoundError(id);
    }

    const isAlreadyInBin = Boolean(platform.deletedAt);

    if (forcePermanent || isAlreadyInBin) {
      // Check relationship protection: SocialAccount.platformId
      const accounts = await this.repos.socialAccounts.findByPlatform(id);
      if (accounts.length > 0) {
        throw new PlatformInUseError(id, accounts.length);
      }

      await this.repos.platforms.delete(id);

      await logSecurityActivity(
        actor.authUid || actor.id,
        'DELETE',
        'Platform',
        id,
        {
          name: platform.name,
          slug: platform.slug,
          action: 'PERMANENT_DELETE',
          deletedBy: actor.id,
        }
      );

      return { success: true, deletedId: id, movedToBin: false };
    }

    // Move to Bin (recoverable for 30 days)
    await this.moveToBin(actor, id);
    return { success: true, deletedId: id, movedToBin: true };
  }

  /**
   * Idempotent seed mechanism for default social platforms.
   * Creates missing platforms, skips existing ones, and never creates duplicates.
   */
  async seedDefaultPlatforms(actor?: TeamMember): Promise<PlatformSeedResult> {
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const finalPlatforms: Platform[] = [];

    const existingPlatforms = await this.repos.platforms.findAll();
    const existingSlugs = new Set(existingPlatforms.map((p) => p.slug.toLowerCase()));

    for (const def of DEFAULT_PLATFORMS) {
      if (existingSlugs.has(def.slug.toLowerCase())) {
        skippedCount++;
        const found = existingPlatforms.find((p) => p.slug.toLowerCase() === def.slug.toLowerCase());
        if (found) finalPlatforms.push(found);
        continue;
      }

      try {
        const created = await this.repos.platforms.create(def);
        createdCount++;
        existingSlugs.add(created.slug.toLowerCase());
        finalPlatforms.push(created);

        if (actor) {
          await logSecurityActivity(
            actor.authUid || actor.id,
            'CREATE',
            'Platform',
            created.id,
            {
              seed: true,
              name: created.name,
              slug: created.slug,
            }
          );
        }
      } catch (err) {
        console.error(`[PlatformService.seed] Failed to seed platform "${def.slug}":`, err);
        failedCount++;
      }
    }

    return {
      created: createdCount,
      skipped: skippedCount,
      failed: failedCount,
      platforms: finalPlatforms,
    };
  }
}

// Singleton export
let _platformService: PlatformService | null = null;

export function getPlatformService(): PlatformService {
  if (!_platformService) {
    _platformService = new PlatformService();
  }
  return _platformService;
}
