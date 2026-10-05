// src/lib/services/activity-log-service.ts
// Activity Log Service for KIRA Agency Manager (Phase 12).
//
// SECURITY RULES:
//   - Never expose passwords, tokens, secrets, auth headers in metadata
//   - All sensitive fields are redacted before persistence and before API responses
//   - Activity logs are audit records — never silently deleted
//
// Real data only — no fake activities are generated.

import { getRepositories } from '@/lib/repositories';
import type { ActivityLog, ActivityAction, TeamMember } from '@/lib/types/domain';

// ─── Sensitive Key Detection ─────────────────────────────────────────────────

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|key|privatekey|credential|auth|cookie|authorization|accesstoken|refreshtoken|clientsecret/i;

/**
 * Redact sensitive keys from metadata before storage or API response.
 * Never throws — always returns a safe object.
 */
export function redactSensitiveMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      safe[k] = '[REDACTED]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

// ─── Query Types ─────────────────────────────────────────────────────────────

export interface ActivityLogFilters {
  action?: ActivityAction | 'ALL';
  userId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'createdAt';
  order?: 'asc' | 'desc';
}

export interface ActivityLogWithActor extends ActivityLog {
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
}

export interface ActivityLogQueryResult {
  items: ActivityLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

let _instance: ActivityLogService | null = null;

export function getActivityLogService(): ActivityLogService {
  if (!_instance) _instance = new ActivityLogService();
  return _instance;
}

export class ActivityLogService {
  private get repos() {
    return getRepositories();
  }

  /**
   * Query activity logs with server-side filtering, search, and pagination.
   */
  async getLogs(filters: ActivityLogFilters): Promise<ActivityLogQueryResult> {
    let logs = await this.repos.activityLogs.findAll();

    // Filter by action
    if (filters.action && filters.action !== 'ALL') {
      logs = logs.filter((l) => l.action === filters.action);
    }

    // Filter by userId
    if (filters.userId) {
      logs = logs.filter((l) => l.userId === filters.userId);
    }

    // Filter by entityType
    if (filters.entityType) {
      logs = logs.filter((l) =>
        l.entityType.toLowerCase() === filters.entityType!.toLowerCase()
      );
    }

    // Date range filter
    if (filters.from) {
      const from = new Date(filters.from).getTime();
      logs = logs.filter((l) => new Date(l.createdAt).getTime() >= from);
    }
    if (filters.to) {
      const to = new Date(filters.to).getTime();
      logs = logs.filter((l) => new Date(l.createdAt).getTime() <= to);
    }

    // Search across entityId, action, entityType, userId
    if (filters.search) {
      const q = filters.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.entityId.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q)
      );
    }

    // Sort
    const order = filters.order === 'asc' ? 1 : -1;
    logs.sort(
      (a, b) =>
        order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );

    const total = logs.length;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.limit ?? 50));
    const totalPages = Math.ceil(total / pageSize);
    const paged = logs.slice((page - 1) * pageSize, page * pageSize);

    // Resolve actors — non-fatal if team member not found
    const items = await Promise.all(paged.map((log) => this.resolveActor(log)));

    return { items, total, page, pageSize, totalPages };
  }

  /**
   * Retrieve a single log entry by ID.
   */
  async getLogById(id: string): Promise<ActivityLogWithActor | null> {
    const log = await this.repos.activityLogs.findById(id);
    if (!log) return null;
    return this.resolveActor(log);
  }

  /**
   * Get all distinct entity types seen in the log (for filter UI).
   */
  async getEntityTypes(): Promise<string[]> {
    const logs = await this.repos.activityLogs.findAll();
    const types = new Set(logs.map((l) => l.entityType));
    return Array.from(types).sort();
  }

  /**
   * Get all distinct userIds seen in the log with resolved names (for filter UI).
   */
  async getActors(): Promise<{ userId: string; name: string; email: string }[]> {
    const logs = await this.repos.activityLogs.findAll();
    const userIds = Array.from(new Set(logs.map((l) => l.userId)));
    const members = await this.repos.teamMembers.findAll();

    return userIds.map((userId) => {
      const member = members.find(
        (m) => m.id === userId || m.authUid === userId
      );
      return {
        userId,
        name: member?.name ?? 'Unknown system actor',
        email: member?.email ?? '',
      };
    });
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async resolveActor(log: ActivityLog): Promise<ActivityLogWithActor> {
    // Redact any sensitive metadata before serving
    const safeMetadata = redactSensitiveMetadata(
      log.metadata as Record<string, unknown> | undefined
    );

    const safeLog: ActivityLogWithActor = { ...log, metadata: safeMetadata };

    try {
      const members = await this.repos.teamMembers.findAll();
      const member = members.find(
        (m) => m.id === log.userId || m.authUid === log.userId
      );
      if (member) {
        safeLog.actorName = member.name;
        safeLog.actorEmail = member.email;
        safeLog.actorRole = member.role;
      }
    } catch {
      // Non-fatal — actor remains unresolved
    }

    return safeLog;
  }
}
