// src/lib/services/content-service.ts
// Business logic for Content Management (Phase 7).
// Enforces auth, permissions, workflow validation, hashtag normalization,
// relationship protection, GCS persistence, and audit logging.

import { getRepositories } from '@/lib/repositories';
import { ValidationError, NotFoundError } from '@/lib/repositories/base-json-repository';
import type {
  Content,
  ContentStatus,
  ContentType,
  ContentWithRelations,
  ContentQueryResult,
  TeamMember,
} from '@/lib/types/domain';
import { logSecurityActivity } from '@/lib/auth/authorization';
import {
  validateTransition,
  logWorkflowTransition,
  WorkflowError,
} from './content-workflow-service';

export { WorkflowError };

export class ContentNotFoundError extends Error {
  readonly code = 'CONTENT_NOT_FOUND';
  readonly status = 404;
  constructor(public readonly contentId: string) {
    super(`Content with ID "${contentId}" was not found.`);
    this.name = 'ContentNotFoundError';
  }
}

export class ContentInUseError extends Error {
  readonly code = 'CONTENT_IN_USE';
  readonly status = 409;
  constructor(
    public readonly contentId: string,
    public readonly referenceCount: number
  ) {
    super(
      `Cannot permanently delete content "${contentId}": it has ${referenceCount} reference(s) (publications, assets, or tasks). Content has been archived instead to preserve historical data.`
    );
    this.name = 'ContentInUseError';
  }
}

export interface ContentQueryOptions {
  search?: string;
  contentType?: ContentType | 'ALL';
  status?: ContentStatus | 'ALL';
  platformId?: string;
  createdBy?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'status' | 'contentType';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  view?: 'active' | 'archived' | 'bin' | 'feed';
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Hashtag Normalization ────────────────────────────────────────────────────
/**
 * Normalize hashtags to # prefix, lowercase, deduplicated, max 50 tags, max 100 chars each.
 */
export function normalizeHashtags(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of raw) {
    const stripped = tag.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '_');
    if (!stripped || stripped.length > 100) continue;
    if (!/^[a-z0-9_]+$/.test(stripped)) continue;
    const normalized = `#${stripped}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
    if (result.length >= 50) break;
  }

  return result;
}

// ─── Resolve Relations ────────────────────────────────────────────────────────
async function resolveRelations(content: Content): Promise<ContentWithRelations> {
  const repos = getRepositories();

  const [creator, assets, publications, tasks, allPlatforms] = await Promise.all([
    repos.teamMembers.findById(content.createdBy),
    repos.contentAssets.findByContentId(content.id),
    repos.publications.findByContentId(content.id),
    repos.tasks.findAll().then((all) => all.filter((t) => t.relatedContentId === content.id)),
    repos.platforms.findAll(),
  ]);

  const targetPlatforms = (content.targetPlatformIds && content.targetPlatformIds.length > 0)
    ? allPlatforms.filter((p) => content.targetPlatformIds!.includes(p.id))
    : [];

  return {
    ...content,
    creator,
    assets,
    publications,
    targetPlatforms,
    assetCount: assets.length,
    publicationCount: publications.length,
    taskCount: tasks.length,
  };
}

// ─── List with Search/Filter/Sort/Pagination ─────────────────────────────────
export async function listContent(
  options: ContentQueryOptions,
  actor: TeamMember
): Promise<ContentQueryResult> {
  const repos = getRepositories();
  let all = await repos.content.findAll();

  // 1. Auto-purge expired bin items (older than 30 days)
  const now = Date.now();
  const expired = all.filter(
    (c) => c.deletedAt && now - new Date(c.deletedAt).getTime() > THIRTY_DAYS_MS
  );
  if (expired.length > 0) {
    for (const exp of expired) {
      await permanentlyDeleteContent(exp.id, actor);
    }
    all = await repos.content.findAll();
  }

  // 1b. Self-heal / auto-archive: If all targeted platforms for an active content item are completed, archive it
  try {
    const allPlatformTargets = await repos.contentPlatformTargets.findAll();
    const targetsByContent = new Map<string, typeof allPlatformTargets>();
    for (const t of allPlatformTargets) {
      const list = targetsByContent.get(t.contentId) || [];
      list.push(t);
      targetsByContent.set(t.contentId, list);
    }

    let needsRefetch = false;
    for (const c of all) {
      if (!c.deletedAt && c.status !== 'ARCHIVED') {
        const cTargets = targetsByContent.get(c.id) || [];
        const targetPlatformIds =
          Array.isArray(c.targetPlatformIds) && c.targetPlatformIds.length > 0
            ? c.targetPlatformIds
            : cTargets.filter((t) => t.enabled).map((t) => t.platformId);

        if (targetPlatformIds.length > 0) {
          const completedPlatforms = new Set(
            cTargets.filter((t) => t.completed).map((t) => t.platformId)
          );
          const allCompleted = targetPlatformIds.every((pid) => completedPlatforms.has(pid));
          if (allCompleted) {
            await repos.content.update(c.id, { status: 'ARCHIVED' });
            c.status = 'ARCHIVED';
            needsRefetch = true;
            try {
              await repos.activityLogs.log({
                action: 'ARCHIVE',
                entityType: 'Content',
                entityId: c.id,
                userId: actor?.id || 'USR-SYSTEM',
                metadata: {
                  contentTitle: c.title,
                  targetedPlatforms: targetPlatformIds,
                  reason: 'DOWNLOADED_FROM_ALL_TARGETED_PLATFORMS',
                },
              });
            } catch (logErr) {
              console.warn('[listContent] Auto-archive log error:', logErr);
            }
          }
        }
      }
    }

    if (needsRefetch) {
      all = await repos.content.findAll();
    }
  } catch (healErr) {
    console.warn('[listContent] Auto-archive check error:', healErr);
  }

  // 2. Global view counts
  const activeCount = all.filter((c) => !c.deletedAt && c.status !== 'ARCHIVED').length;
  const archivedCount = all.filter((c) => !c.deletedAt && c.status === 'ARCHIVED').length;
  const binCount = all.filter((c) => Boolean(c.deletedAt)).length;
  const counts = { active: activeCount, archived: archivedCount, bin: binCount };

  const view = options.view || 'active';
  const search = options.search?.trim().toLowerCase();
  const contentTypeFilter = options.contentType === 'ALL' ? undefined : options.contentType;
  const statusFilter = options.status === 'ALL' ? undefined : options.status;
  const platformFilter = options.platformId && options.platformId !== 'ALL' ? options.platformId : undefined;

  const filtered = all.filter((c) => {
    // View Isolation
    if (view === 'bin') {
      // ONLY show deleted content in Bin
      if (!c.deletedAt) return false;
    } else if (view === 'archived') {
      // ONLY show archived content here (and not in bin)
      if (c.deletedAt || c.status !== 'ARCHIVED') return false;
    } else if (view === 'feed') {
      // Feed view includes: Active + Archived + Soft-deleted (all non-permanently deleted content)
      // permanently deleted items are already removed from database
    } else {
      // view === 'active' (Default everywhere):
      // NEVER show archived content, and NEVER show deleted (bin) content
      if (c.deletedAt || c.status === 'ARCHIVED') return false;
    }

    if (contentTypeFilter && c.contentType !== contentTypeFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (options.createdBy && c.createdBy !== options.createdBy) return false;
    if (platformFilter && (!c.targetPlatformIds || !c.targetPlatformIds.includes(platformFilter))) return false;
    if (search) {
      const haystack = [
        c.title,
        c.description ?? '',
        c.caption ?? '',
        c.hashtags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  // Sort
  if (view === 'feed') {
    // Feed Order: 1. Latest active, 2. Latest archived, 3. Latest soft-deleted, within each category: updatedAt DESC
    filtered.sort((a, b) => {
      const getCategoryScore = (item: typeof a) => {
        if (item.deletedAt) return 3; // soft-deleted
        if (item.status === 'ARCHIVED') return 2; // archived
        return 1; // active
      };
      const catA = getCategoryScore(a);
      const catB = getCategoryScore(b);
      if (catA !== catB) return catA - catB;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  } else {
    const sortField = options.sortBy ?? 'updatedAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'contentType') cmp = a.contentType.localeCompare(b.contentType);
      else if (sortField === 'createdAt')
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return cmp * sortOrder;
    });
  }

  // Pagination
  const total = filtered.length;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Resolve relations for paginated slice only (avoids N+1 on full dataset)
  const items = await Promise.all(paginated.map(resolveRelations));

  return { items, total, page, pageSize, totalPages, counts };
}

// ─── Get single content by ID ─────────────────────────────────────────────────
export async function getContentById(
  id: string,
  _actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();
  let content = await repos.content.findById(id);
  if (!content) throw new ContentNotFoundError(id);

  if (!content.deletedAt && content.status !== 'ARCHIVED') {
    try {
      const cTargets = await repos.contentPlatformTargets.findByContentId(id);
      const targetPlatformIds =
        Array.isArray(content.targetPlatformIds) && content.targetPlatformIds.length > 0
          ? content.targetPlatformIds
          : cTargets.filter((t) => t.enabled).map((t) => t.platformId);

      if (targetPlatformIds.length > 0) {
        const completedPlatforms = new Set(
          cTargets.filter((t) => t.completed).map((t) => t.platformId)
        );
        const allCompleted = targetPlatformIds.every((pid) => completedPlatforms.has(pid));
        if (allCompleted) {
          content = await repos.content.update(id, { status: 'ARCHIVED' });
          try {
            await repos.activityLogs.log({
              action: 'ARCHIVE',
              entityType: 'Content',
              entityId: id,
              userId: _actor?.id || 'USR-SYSTEM',
              metadata: {
                contentTitle: content.title,
                targetedPlatforms: targetPlatformIds,
                reason: 'DOWNLOADED_FROM_ALL_TARGETED_PLATFORMS',
              },
            });
          } catch (logErr) {
            console.warn('[getContentById] Auto-archive log error:', logErr);
          }
        }
      }
    } catch (e) {
      console.warn('[getContentById] Auto-archive check error:', e);
    }
  }

  return resolveRelations(content);
}

// ─── Create content ───────────────────────────────────────────────────────────
export async function createContent(
  data: {
    title?: string;
    description?: string;
    contentType: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
  },
  actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();

  const normalizedHashtags = normalizeHashtags(data.hashtags ?? []);
  const resolvedTitle =
    data.title?.trim() ||
    data.caption?.trim().split('\n')[0].slice(0, 60) ||
    `${data.contentType} - ${new Date().toLocaleDateString()}`;

  const created = await repos.content.create({
    title: resolvedTitle,
    description: data.description?.trim(),
    contentType: data.contentType,
    caption: data.caption?.trim(),
    hashtags: normalizedHashtags,
    targetPlatformIds: data.targetPlatformIds,
    status: 'IDEA',          // New content always starts at IDEA
    createdBy: actor.id,     // Server-controlled — never from client
  });

  await logSecurityActivity(
    actor.authUid || actor.id,
    'CREATE',
    'Content',
    created.id,
    {
      title: created.title,
      contentType: created.contentType,
      status: created.status,
      targetPlatformIds: created.targetPlatformIds,
      createdBy: actor.id,
    }
  );

  return resolveRelations(created);
}

// ─── Update content (fields only, not status) ─────────────────────────────────
export async function updateContent(
  id: string,
  data: {
    title?: string;
    description?: string;
    contentType?: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
  },
  actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();

  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  if (existing.status === 'ARCHIVED') {
    throw new WorkflowError(
      'Archived content cannot be edited.',
      'CONTENT_ARCHIVED',
      422
    );
  }

  const patch: Partial<Content> = {};
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = data.description.trim() || undefined;
  if (data.contentType !== undefined) patch.contentType = data.contentType;
  if (data.caption !== undefined) patch.caption = data.caption.trim() || undefined;
  if (data.hashtags !== undefined) patch.hashtags = normalizeHashtags(data.hashtags);
  if (data.targetPlatformIds !== undefined) patch.targetPlatformIds = data.targetPlatformIds;

  const updated = await repos.content.update(id, patch);

  await logSecurityActivity(
    actor.authUid || actor.id,
    'UPDATE',
    'Content',
    id,
    {
      contentId: id,
      updatedFields: Object.keys(patch),
      updatedBy: actor.id,
    }
  );

  return resolveRelations(updated);
}

// ─── Transition status ────────────────────────────────────────────────────────
export async function transitionStatus(
  id: string,
  requestedStatus: ContentStatus,
  actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();

  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  // Throws WorkflowError if invalid
  validateTransition(existing, requestedStatus, actor);

  const previousStatus = existing.status;
  const updated = await repos.content.update(id, { status: requestedStatus });

  await logWorkflowTransition(actor, existing, previousStatus, requestedStatus);

  return resolveRelations(updated);
}

// ─── Bin & Archive Operations ──────────────────────────────────────────────────

/**
 * Move content to Bin (recoverable for 30 days).
 */
export async function moveToBin(
  id: string,
  actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();
  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  const updated = await repos.content.update(id, {
    deletedAt: new Date().toISOString(),
    deletedFromStatus: existing.status,
    deletedFromPlatformIds: existing.targetPlatformIds || [],
  });

  await logSecurityActivity(actor.authUid || actor.id, 'DELETE', 'Content', id, {
    contentId: id,
    action: 'MOVE_TO_BIN',
    deletedFromStatus: existing.status,
    deletedBy: actor.id,
  });

  return resolveRelations(updated);
}

/**
 * Restore content from Bin back to where it was deleted.
 * Only permitted within 30 days of deletion.
 */
export async function restoreFromBin(
  id: string,
  actor: TeamMember
): Promise<ContentWithRelations> {
  const repos = getRepositories();
  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  // Validate 30-day recovery window
  if (existing.deletedAt) {
    const elapsed = Date.now() - new Date(existing.deletedAt).getTime();
    if (elapsed > THIRTY_DAYS_MS) {
      await permanentlyDeleteContent(id, actor);
      throw new WorkflowError(
        'Content cannot be restored: 30-day recovery period has expired and content was permanently deleted.',
        'BIN_EXPIRED',
        410
      );
    }
  }

  // Restore to original status prior to deletion, or fallback to IDEA
  const restoredStatus = existing.deletedFromStatus && existing.deletedFromStatus !== 'ARCHIVED'
    ? existing.deletedFromStatus
    : (existing.deletedFromStatus === 'ARCHIVED' ? 'ARCHIVED' : 'IDEA');

  const updated = await repos.content.update(id, {
    status: restoredStatus,
    deletedAt: null,
    deletedFromStatus: null,
  });

  await logSecurityActivity(actor.authUid || actor.id, 'UPDATE', 'Content', id, {
    contentId: id,
    action: 'RESTORE_FROM_BIN',
    restoredStatus,
    restoredBy: actor.id,
  });

  return resolveRelations(updated);
}

/**
 * Restore content from Archived status back to active content.
 */
export async function restoreFromArchived(
  id: string,
  actor: TeamMember,
  targetStatus?: ContentStatus
): Promise<ContentWithRelations> {
  const repos = getRepositories();
  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  const restoredStatus = targetStatus || 'IDEA';

  const updated = await repos.content.update(id, {
    status: restoredStatus,
  });

  await logSecurityActivity(actor.authUid || actor.id, 'UPDATE', 'Content', id, {
    contentId: id,
    action: 'RESTORE_FROM_ARCHIVE',
    newStatus: restoredStatus,
    restoredBy: actor.id,
  });

  return resolveRelations(updated);
}

/**
 * Permanently delete content and its media assets from storage and records.
 */
export async function permanentlyDeleteContent(
  id: string,
  actor: TeamMember
): Promise<{ deleted: boolean }> {
  const repos = getRepositories();
  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  // 1. Delete media assets
  const assets = await repos.contentAssets.findByContentId(id);
  for (const asset of assets) {
    try {
      await repos.contentAssets.delete(asset.id);
    } catch (e) {
      console.warn(`[permanentlyDeleteContent] Failed to delete asset ${asset.id}:`, e);
    }
  }

  // 2. Delete publication records
  const publications = await repos.publications.findByContentId(id);
  for (const pub of publications) {
    try {
      await repos.publications.delete(pub.id);
    } catch (e) {
      console.warn(`[permanentlyDeleteContent] Failed to delete pub ${pub.id}:`, e);
    }
  }

  // 3. Delete content record
  await repos.content.delete(id);

  await logSecurityActivity(actor.authUid || actor.id, 'DELETE', 'Content', id, {
    contentId: id,
    contentTitle: existing.title,
    action: 'PERMANENT_DELETE',
    deletedBy: actor.id,
  });

  return { deleted: true };
}

/**
 * Empty the Recycle Bin permanently deleting all items currently in bin.
 */
export async function emptyBin(actor: TeamMember): Promise<{ deletedCount: number }> {
  const repos = getRepositories();
  const all = await repos.content.findAll();
  const binItems = all.filter((c) => Boolean(c.deletedAt));

  for (const item of binItems) {
    await permanentlyDeleteContent(item.id, actor);
  }

  return { deletedCount: binItems.length };
}

// ─── Delete or Move to Bin Handler ───────────────────────────────────────────
export async function deleteOrArchiveContent(
  id: string,
  actor: TeamMember,
  forcePermanent = false
): Promise<{ archived: boolean; deleted: boolean; movedToBin: boolean }> {
  const repos = getRepositories();
  const existing = await repos.content.findById(id);
  if (!existing) throw new ContentNotFoundError(id);

  // If already in Bin or forced permanent, permanently delete
  if (forcePermanent || existing.deletedAt) {
    await permanentlyDeleteContent(id, actor);
    return { archived: false, deleted: true, movedToBin: false };
  }

  // Otherwise, move to Bin (recoverable for 30 days)
  await moveToBin(id, actor);
  return { archived: false, deleted: true, movedToBin: true };
}
