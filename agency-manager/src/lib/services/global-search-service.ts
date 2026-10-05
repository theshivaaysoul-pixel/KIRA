// src/lib/services/global-search-service.ts
// Phase 17 — Global Search Service
//
// Application-wide search across real KIRA entities:
// - Platforms (name, slug, description)
// - Social Accounts (accountName, username, niche, description)
// - Content (title, description, caption, hashtags)
// - Tasks (title, description)
// - Team Members (name, email)
// - Publications (platformSpecificTitle, platformSpecificCaption, externalPostId)
// - Activity Logs (action, entityType, entityId)
//
// CRITICAL RULES:
//  - Never return fake search results or mock indexes
//  - Filter entities based on server-side user permissions
//  - Return honest empty state ("No results found") when no matches exist
//  - Server-side pagination & grouped results

import { getRepositories, type Repositories } from '../repositories';
import type { Permission } from '../auth/permissions';
import { hasPermission } from '../auth/permissions';
import type { TeamRole } from '../types/domain';

export type SearchEntityType =
  | 'platform'
  | 'account'
  | 'content'
  | 'task'
  | 'team'
  | 'publication'
  | 'activity';

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  snippet?: string;
  url: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface GroupedSearchResults {
  platforms?: SearchResultItem[];
  accounts?: SearchResultItem[];
  content?: SearchResultItem[];
  tasks?: SearchResultItem[];
  team?: SearchResultItem[];
  publications?: SearchResultItem[];
  activity?: SearchResultItem[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  results: SearchResultItem[];
  grouped: GroupedSearchResults;
}

export interface SearchOptions {
  query: string;
  type?: string;
  page?: number;
  limit?: number;
  role: TeamRole;
}

export class GlobalSearchService {
  private readonly repos: Repositories;

  constructor(repos: Repositories = getRepositories()) {
    this.repos = repos;
  }

  /**
   * Search real repository entities authorized for the given role.
   */
  async search(options: SearchOptions): Promise<GlobalSearchResponse> {
    const rawQuery = (options.query || '').trim();
    const queryLower = rawQuery.toLowerCase();
    const typeFilter = (options.type || 'all').toLowerCase();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const role = options.role;

    if (!rawQuery) {
      return {
        query: '',
        total: 0,
        page,
        limit,
        totalPages: 0,
        results: [],
        grouped: {},
      };
    }

    const items: SearchResultItem[] = [];

    // Helper: checks if user has permission
    const canRead = (perm: Permission) => hasPermission(role, perm);

    // 1. Platforms (platforms.read)
    if ((typeFilter === 'all' || typeFilter === 'platform') && canRead('platforms.read')) {
      try {
        const platforms = await this.repos.platforms.findAll();
        for (const p of platforms) {
          const matchName = p.name.toLowerCase().includes(queryLower);
          const matchSlug = p.slug.toLowerCase().includes(queryLower);
          const matchDesc = p.description?.toLowerCase().includes(queryLower);

          if (matchName || matchSlug || matchDesc) {
            items.push({
              id: p.id,
              type: 'platform',
              title: p.name,
              subtitle: `@${p.slug}`,
              snippet: p.description || undefined,
              url: `/platforms`,
              metadata: {
                slug: p.slug,
                isActive: p.isActive,
                capabilitiesCount: p.capabilities.length,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching platforms:', err);
      }
    }

    // 2. Social Accounts (accounts.read)
    if ((typeFilter === 'all' || typeFilter === 'account') && canRead('accounts.read')) {
      try {
        const accounts = await this.repos.socialAccounts.findAll();
        for (const a of accounts) {
          const matchName = a.accountName.toLowerCase().includes(queryLower);
          const matchUser = a.username.toLowerCase().includes(queryLower);
          const matchNiche = a.niche?.toLowerCase().includes(queryLower);
          const matchDesc = a.description?.toLowerCase().includes(queryLower);

          if (matchName || matchUser || matchNiche || matchDesc) {
            items.push({
              id: a.id,
              type: 'account',
              title: a.accountName,
              subtitle: `@${a.username}${a.niche ? ` • ${a.niche}` : ''}`,
              snippet: a.description || undefined,
              url: `/accounts`,
              metadata: {
                platformId: a.platformId,
                status: a.status,
                externalAccountId: a.externalAccountId,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching accounts:', err);
      }
    }

    // 3. Content (content.read)
    if ((typeFilter === 'all' || typeFilter === 'content') && canRead('content.read')) {
      try {
        const contentList = await this.repos.content.findAll();
        for (const c of contentList) {
          const matchTitle = c.title.toLowerCase().includes(queryLower);
          const matchDesc = c.description?.toLowerCase().includes(queryLower);
          const matchCaption = c.caption?.toLowerCase().includes(queryLower);
          const matchTags = c.hashtags?.some((tag) => tag.toLowerCase().includes(queryLower));

          if (matchTitle || matchDesc || matchCaption || matchTags) {
            items.push({
              id: c.id,
              type: 'content',
              title: c.title,
              subtitle: `${c.contentType} • ${c.status}`,
              snippet: c.caption || c.description || undefined,
              url: `/content`,
              metadata: {
                contentType: c.contentType,
                status: c.status,
                hashtagsCount: c.hashtags?.length || 0,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching content:', err);
      }
    }

    // 4. Tasks (tasks.read)
    if ((typeFilter === 'all' || typeFilter === 'task') && canRead('tasks.read')) {
      try {
        const tasks = await this.repos.tasks.findAll();
        for (const t of tasks) {
          const matchTitle = t.title.toLowerCase().includes(queryLower);
          const matchDesc = t.description?.toLowerCase().includes(queryLower);

          if (matchTitle || matchDesc) {
            items.push({
              id: t.id,
              type: 'task',
              title: t.title,
              subtitle: `Priority: ${t.priority} • Status: ${t.status}`,
              snippet: t.description || undefined,
              url: `/tasks`,
              metadata: {
                priority: t.priority,
                status: t.status,
                assignedTo: t.assignedTo || null,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching tasks:', err);
      }
    }

    // 5. Team Members (team.read)
    if ((typeFilter === 'all' || typeFilter === 'team') && canRead('team.read')) {
      try {
        const team = await this.repos.teamMembers.findAll();
        for (const m of team) {
          const matchName = m.name.toLowerCase().includes(queryLower);
          const matchEmail = m.email.toLowerCase().includes(queryLower);

          if (matchName || matchEmail) {
            items.push({
              id: m.id,
              type: 'team',
              title: m.name,
              subtitle: `${m.role} • ${m.email}`,
              snippet: undefined,
              url: `/team`,
              metadata: {
                role: m.role,
                status: m.status,
                email: m.email,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching team members:', err);
      }
    }

    // 6. Publications (content.read)
    if ((typeFilter === 'all' || typeFilter === 'publication') && canRead('content.read')) {
      try {
        const pubs = await this.repos.publications.findAll();
        for (const pub of pubs) {
          const matchTitle = pub.platformSpecificTitle?.toLowerCase().includes(queryLower);
          const matchCaption = pub.platformSpecificCaption?.toLowerCase().includes(queryLower);
          const matchPostId = pub.externalPostId?.toLowerCase().includes(queryLower);

          if (matchTitle || matchCaption || matchPostId) {
            items.push({
              id: pub.id,
              type: 'publication',
              title: pub.platformSpecificTitle || `Publication ${pub.id}`,
              subtitle: `Status: ${pub.status} • Account: ${pub.socialAccountId}`,
              snippet: pub.platformSpecificCaption || undefined,
              url: `/content`,
              metadata: {
                status: pub.status,
                contentId: pub.contentId,
                socialAccountId: pub.socialAccountId,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching publications:', err);
      }
    }

    // 7. Activity Logs (activity.read)
    if ((typeFilter === 'all' || typeFilter === 'activity') && canRead('activity.read')) {
      try {
        const logs = await this.repos.activityLogs.findAll();
        for (const log of logs) {
          const matchAction = log.action.toLowerCase().includes(queryLower);
          const matchEntity = log.entityType.toLowerCase().includes(queryLower);
          const matchId = log.entityId.toLowerCase().includes(queryLower);

          if (matchAction || matchEntity || matchId) {
            items.push({
              id: log.id,
              type: 'activity',
              title: `${log.action} on ${log.entityType}`,
              subtitle: `Target: ${log.entityId} • By: ${log.userId}`,
              snippet: undefined,
              url: `/activity`,
              metadata: {
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
              },
            });
          }
        }
      } catch (err) {
        console.error('[GlobalSearchService] Error searching activity logs:', err);
      }
    }

    // Score & sort relevance:
    // 1. Title starts with query
    // 2. Title includes query
    // 3. Subtitle / snippet includes query
    items.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStarts = aTitle.startsWith(queryLower);
      const bStarts = bTitle.startsWith(queryLower);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return aTitle.localeCompare(bTitle);
    });

    // Grouping: build non-empty groups from the matched items
    const grouped: GroupedSearchResults = {};
    for (const item of items) {
      const groupKey =
        item.type === 'platform'
          ? 'platforms'
          : item.type === 'account'
          ? 'accounts'
          : item.type === 'content'
          ? 'content'
          : item.type === 'task'
          ? 'tasks'
          : item.type === 'team'
          ? 'team'
          : item.type === 'publication'
          ? 'publications'
          : 'activity';

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey]!.push(item);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedResults = items.slice((page - 1) * limit, page * limit);

    return {
      query: rawQuery,
      total,
      page,
      limit,
      totalPages,
      results: paginatedResults,
      grouped,
    };
  }
}

let _globalSearchService: GlobalSearchService | null = null;

export function getGlobalSearchService(): GlobalSearchService {
  if (!_globalSearchService) {
    _globalSearchService = new GlobalSearchService();
  }
  return _globalSearchService;
}
