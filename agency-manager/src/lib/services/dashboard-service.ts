// src/lib/services/dashboard-service.ts
// Central Dashboard Service for KIRA Agency Manager (Phase 4).
// Computes real operational metrics, aggregates recent content, upcoming schedules,
// pending tasks, attention/failure indicators, and sanitized activity logs.
// Respects role scoping and never returns fake or hard-coded records.

import { getRepositories } from '@/lib/repositories';
import { getDailyTargetService } from '@/lib/services/daily-target-service';
import type {
  TeamMember,
  DashboardOverviewData,
  DashboardMetrics,
  DashboardRecentContentItem,
  DashboardUpcomingPublicationItem,
  DashboardTaskItem,
  DashboardActivityItem,
  DashboardAttentionItem,
  ActivityAction,
} from '@/lib/types/domain';

export class DashboardService {
  async getDashboardOverview(
    actor: TeamMember,
    options?: {
      contentLimit?: number;
      taskLimit?: number;
      activityLimit?: number;
      scheduleLimit?: number;
    }
  ): Promise<DashboardOverviewData> {
    const repos = getRepositories();
    const now = Date.now();

    const contentLimit = options?.contentLimit ?? 6;
    const taskLimit = options?.taskLimit ?? 6;
    const activityLimit = options?.activityLimit ?? 10;
    const scheduleLimit = options?.scheduleLimit ?? 5;

    // Concurrently fetch all necessary collections
    const [
      settings,
      platforms,
      accounts,
      contents,
      publications,
      tasks,
      activityLogs,
      teamMembers,
      assets,
      contentPlatformTargets,
    ] = await Promise.all([
      repos.settings.getSettings(),
      repos.platforms.findAll(),
      repos.socialAccounts.findAll(),
      repos.content.findAll(),
      repos.publications.findAll(),
      repos.tasks.findAll(),
      repos.activityLogs.findAll(),
      repos.teamMembers.findAll(),
      repos.contentAssets.findAll(),
      repos.contentPlatformTargets.findAll(),
    ]);

    // Fast lookup maps
    const platformMap = new Map(platforms.map((p) => [p.id, p]));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const teamMemberMap = new Map(teamMembers.map((m) => [m.id, m]));
    const contentMap = new Map(contents.map((c) => [c.id, c]));

    // Asset by contentId
    const assetByContentMap = new Map<string, string>();
    for (const asset of assets) {
      if (!assetByContentMap.has(asset.contentId)) {
        assetByContentMap.set(asset.contentId, asset.thumbnailPath || asset.storagePath);
      }
    }

    // Platforms linked to content through publications
    const platformsByContentMap = new Map<string, Set<string>>();
    for (const pub of publications) {
      const acc = accountMap.get(pub.socialAccountId);
      if (acc) {
        const plat = platformMap.get(acc.platformId);
        if (plat) {
          if (!platformsByContentMap.has(pub.contentId)) {
            platformsByContentMap.set(pub.contentId, new Set());
          }
          platformsByContentMap.get(pub.contentId)!.add(plat.name);
        }
      }
    }

    // Content platform targets lookup
    const targetsByContent = new Map<string, typeof contentPlatformTargets>();
    for (const t of contentPlatformTargets) {
      const list = targetsByContent.get(t.contentId) || [];
      list.push(t);
      targetsByContent.set(t.contentId, list);
    }

    // Helper: is a content item truly active (not in Recycle Bin, not Archived, not fully downloaded/completed)
    const isContentActive = (c: (typeof contents)[number]) => {
      if (c.deletedAt) return false;
      if (c.status === 'ARCHIVED') return false;

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
          repos.content.update(c.id, { status: 'ARCHIVED' }).catch((e) => {
            console.warn('[DashboardService] Auto-archive sync error:', e);
          });
          return false;
        }
      }

      return true;
    };

    // 1. KPI Metrics (Real calculation from live records)
    const activeAccountsCount = accounts.filter((a) => a.status === 'ACTIVE').length;
    const activeContentCount = contents.filter(isContentActive).length;
    const scheduledPublicationsCount = publications.filter(
      (p) =>
        p.status === 'QUEUED' ||
        (p.scheduledAt &&
          new Date(p.scheduledAt).getTime() > now &&
          p.status !== 'CANCELLED' &&
          p.status !== 'PUBLISHED')
    ).length;
    const pendingTasksCount = tasks.filter(
      (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    ).length;
    const publishedContentCount = publications.filter((p) => p.status === 'PUBLISHED').length;
    const failedPublicationsCount = publications.filter((p) => p.status === 'FAILED').length;
    const accountConnectionErrorsCount = accounts.filter(
      (a) => a.status === 'CONNECTION_ERROR'
    ).length;
    const totalTeamMembersCount = teamMembers.filter((m) => m.status === 'ACTIVE').length;

    // Real daily platform content targets progress
    let dailyTargetsProgress: DashboardMetrics['dailyTargetsProgress'] = undefined;
    try {
      const dailyTargetService = getDailyTargetService();
      dailyTargetsProgress = await dailyTargetService.getTodayProgress();
    } catch (e) {
      console.warn('[DashboardService] Failed to calculate today targets progress:', e);
    }

    const metrics: DashboardMetrics = {
      activeAccounts: activeAccountsCount,
      activeContent: activeContentCount,
      scheduledPublications: scheduledPublicationsCount,
      pendingTasks: pendingTasksCount,
      publishedContent: publishedContentCount,
      failedPublications: failedPublicationsCount,
      accountConnectionErrors: accountConnectionErrorsCount,
      totalTeamMembers: totalTeamMembersCount,
      dailyTargetsProgress,
    };

    // 2. Attention Required Items
    const attentionItems: DashboardAttentionItem[] = [];

    // Failed publications
    const failedPubs = publications.filter((p) => p.status === 'FAILED');
    for (const fp of failedPubs.slice(0, 3)) {
      const content = contentMap.get(fp.contentId);
      const acc = accountMap.get(fp.socialAccountId);
      attentionItems.push({
        type: 'FAILED_PUBLICATION',
        title: `Publication Failed: ${content?.title || fp.id}`,
        description:
          fp.errorMessage ||
          `Delivery failure to @${acc?.username || 'social account'}. Needs review.`,
        entityId: fp.id,
        severity: 'ERROR',
      });
    }

    // Connection errors
    const errorAccounts = accounts.filter((a) => a.status === 'CONNECTION_ERROR');
    for (const ea of errorAccounts.slice(0, 3)) {
      const plat = platformMap.get(ea.platformId);
      attentionItems.push({
        type: 'CONNECTION_ERROR',
        title: `Connection Error: ${ea.accountName} (@${ea.username})`,
        description: `Integration connection lost on ${plat?.name || 'social network'}. Re-authentication required.`,
        entityId: ea.id,
        severity: 'WARNING',
      });
    }

    // 3. Recent Content
    const nonArchivedContent = contents.filter(isContentActive);
    nonArchivedContent.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const recentContent: DashboardRecentContentItem[] = nonArchivedContent
      .slice(0, contentLimit)
      .map((c) => {
        const creator = teamMemberMap.get(c.createdBy);
        const platformNames = Array.from(platformsByContentMap.get(c.id) || []);
        return {
          id: c.id,
          title: c.title,
          contentType: c.contentType,
          status: c.status,
          createdAt: c.createdAt,
          creatorName: creator?.name || 'Agency Member',
          thumbnailUrl: assetByContentMap.get(c.id),
          platformNames,
        };
      });

    // 4. Upcoming Publications Schedule
    const upcomingPubs = publications.filter(
      (p) =>
        p.status === 'QUEUED' ||
        (p.scheduledAt &&
          new Date(p.scheduledAt).getTime() > now &&
          p.status !== 'CANCELLED' &&
          p.status !== 'PUBLISHED')
    );

    upcomingPubs.sort((a, b) => {
      const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return timeA - timeB;
    });

    const upcomingPublications: DashboardUpcomingPublicationItem[] = upcomingPubs
      .slice(0, scheduleLimit)
      .map((p) => {
        const content = contentMap.get(p.contentId);
        const account = accountMap.get(p.socialAccountId);
        const platform = account ? platformMap.get(account.platformId) : null;
        return {
          id: p.id,
          contentId: p.contentId,
          contentTitle: content?.title || 'Untitled Post',
          socialAccountId: p.socialAccountId,
          accountHandle: account?.username || 'unknown',
          platformName: platform?.name || 'Social',
          platformIcon: platform?.icon,
          scheduledAt: p.scheduledAt || p.createdAt,
          status: p.status,
        };
      });

    // 5. Tasks (Role-scoped & sorted with overdue highlight)
    let candidateTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

    // Role scoping:
    // If EDITOR or DESIGNER, prioritize tasks assigned to actor
    if (['EDITOR', 'DESIGNER'].includes(actor.role)) {
      const assignedToActor = candidateTasks.filter((t) => t.assignedTo === actor.id);
      if (assignedToActor.length > 0) {
        candidateTasks = assignedToActor;
      }
    } else if (actor.role === 'MANAGER') {
      // Prioritize tasks assigned to manager or accounts they manage
      const managerAccounts = new Set(
        accounts.filter((a) => a.assignedManagerId === actor.id).map((a) => a.id)
      );
      const managerTasks = candidateTasks.filter(
        (t) =>
          t.assignedTo === actor.id ||
          (t.relatedAccountId && managerAccounts.has(t.relatedAccountId))
      );
      if (managerTasks.length > 0) {
        candidateTasks = managerTasks;
      }
    }

    const priorityWeight: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    candidateTasks.sort((a, b) => {
      const isOverdueA = a.dueDate ? new Date(a.dueDate).getTime() < now : false;
      const isOverdueB = b.dueDate ? new Date(b.dueDate).getTime() < now : false;

      // Overdue first
      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;

      // Then by priority
      const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (pDiff !== 0) return pDiff;

      // Then by dueDate
      const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dueA - dueB;
    });

    const taskItems: DashboardTaskItem[] = candidateTasks.slice(0, taskLimit).map((t) => {
      const assignee = t.assignedTo ? teamMemberMap.get(t.assignedTo) : undefined;
      const relatedContent = t.relatedContentId ? contentMap.get(t.relatedContentId) : undefined;
      const isOverdue = t.dueDate ? new Date(t.dueDate).getTime() < now : false;

      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        isOverdue,
        assignedToName: assignee?.name,
        relatedContentTitle: relatedContent?.title,
      };
    });

    // 6. Recent Activity (Sanitized human labels)
    const sortedLogs = [...activityLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const recentActivity: DashboardActivityItem[] = sortedLogs
      .slice(0, activityLimit)
      .map((log) => {
        const member = teamMemberMap.get(log.userId);
        const userName =
          member?.name || (log.userId === 'anonymous' ? 'System' : log.userId);

        return {
          id: log.id,
          action: log.action,
          label: formatActivityLabel(log.action, log.entityType),
          entityType: log.entityType,
          entityId: log.entityId,
          userName,
          timestamp: log.createdAt,
        };
      });

    return {
      metrics,
      attentionItems,
      recentContent,
      upcomingPublications,
      tasks: taskItems,
      recentActivity,
      agencySettings: {
        agencyName: settings.agencyName || 'KIRA Agency',
        timezone: settings.timezone || 'UTC',
        dateFormat: settings.dateFormat || 'YYYY-MM-DD',
        logoUrl: settings.logoUrl || '/logo.png',
      },
    };
  }
}

let _dashboardService: DashboardService | null = null;
export function getDashboardService(): DashboardService {
  if (!_dashboardService) {
    _dashboardService = new DashboardService();
  }
  return _dashboardService;
}

function formatActivityLabel(action: ActivityAction, entityType: string): string {
  switch (action) {
    case 'CREATE':
      return `Created ${entityType}`;
    case 'UPDATE':
      return `Updated ${entityType}`;
    case 'DELETE':
      return `Deleted ${entityType}`;
    case 'ARCHIVE':
      return `Archived ${entityType}`;
    case 'SCHEDULE':
      return `Scheduled ${entityType}`;
    case 'PUBLISH_ATTEMPT':
      return `Publishing ${entityType}...`;
    case 'PUBLISH_SUCCESS':
      return `Successfully published ${entityType}`;
    case 'PUBLISH_FAILED':
      return `Failed to publish ${entityType}`;
    case 'ROLE_CHANGED':
      return `Team role updated`;
    case 'ACCESS_DENIED':
      return `Access denied`;
    case 'TEAM_MEMBER_SUSPENDED':
      return `Team member suspended`;
    case 'TEAM_MEMBER_REACTIVATED':
      return `Team member reactivated`;
    case 'SETTINGS_UPDATED':
      return `Agency settings updated`;
    case 'LOGIN':
      return `Signed in to manager`;
    case 'LOGOUT':
      return `Signed out`;
    default:
      return `${action} on ${entityType}`;
  }
}
