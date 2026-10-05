// src/lib/services/calendar-service.ts
// Business logic for Content Calendar & Scheduling (Phase 9).
// Enforces: APPROVED-only scheduling, timezone-aware queries,
// account availability checks, publication lifecycle, audit logging,
// and orphan-publication prevention.

import { getRepositories } from '@/lib/repositories';
import { ValidationError } from '@/lib/repositories/base-json-repository';
import type {
  ContentPublication,
  PublicationStatus,
  SocialAccount,
  Content,
  TeamMember,
} from '@/lib/types/domain';
import { logSecurityActivity } from '@/lib/auth/authorization';

// ─── Custom Errors ─────────────────────────────────────────────────────────────

export class SchedulingError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'SCHEDULING_ERROR', status = 422) {
    super(message);
    this.name = 'SchedulingError';
    this.code = code;
    this.status = status;
  }
}

export class PublicationNotFoundError extends Error {
  readonly code = 'PUBLICATION_NOT_FOUND';
  readonly status = 404;
  constructor(public readonly publicationId: string) {
    super(`Publication with ID "${publicationId}" was not found.`);
    this.name = 'PublicationNotFoundError';
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  publication: ContentPublication;
  content: Content;
  account: SocialAccount;
  platformName: string;
  platformIcon: string;
}

export interface CalendarRangeQuery {
  /** ISO date string for range start (inclusive) */
  startDate: string;
  /** ISO date string for range end (inclusive) */
  endDate: string;
  /** IANA timezone name, e.g. "Asia/Kolkata". Defaults to agency timezone. */
  timezone?: string;
  /** Filter by status */
  status?: PublicationStatus | 'ALL';
  /** Filter by social account ID */
  socialAccountId?: string;
}

export interface SchedulePublicationInput {
  contentId: string;
  socialAccountId: string;
  scheduledAt: string; // ISO 8601 UTC timestamp
  platformSpecificCaption?: string;
  platformSpecificTitle?: string;
}

export interface ReschedulePublicationInput {
  scheduledAt: string; // ISO 8601 UTC timestamp
  platformSpecificCaption?: string;
  platformSpecificTitle?: string;
}

// ─── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Parse and validate a scheduledAt timestamp.
 * Must be a valid ISO 8601 string and must be in the future.
 */
function validateScheduledAt(scheduledAt: string): Date {
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime())) {
    throw new SchedulingError(
      'scheduledAt must be a valid ISO 8601 timestamp.',
      'INVALID_SCHEDULED_AT',
      400
    );
  }
  if (date.getTime() <= Date.now()) {
    throw new SchedulingError(
      'scheduledAt must be a future date/time.',
      'SCHEDULED_AT_IN_PAST',
      422
    );
  }
  return date;
}

// ─── List Calendar Events (Range Query) ────────────────────────────────────────

/**
 * Returns all publications that fall within the given date range.
 * Enriches each publication with its content and social account for the calendar UI.
 * Filters are applied server-side; only real persisted records are returned.
 */
export async function getCalendarEvents(
  query: CalendarRangeQuery,
  _actor: TeamMember
): Promise<CalendarEvent[]> {
  const repos = getRepositories();

  // Parse range bounds
  const start = new Date(query.startDate);
  const end = new Date(query.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new SchedulingError('startDate and endDate must be valid ISO date strings.', 'INVALID_DATE_RANGE', 400);
  }
  if (start > end) {
    throw new SchedulingError('startDate must be before or equal to endDate.', 'INVALID_DATE_RANGE', 400);
  }

  const allPublications = await repos.publications.findAll();

  const statusFilter = query.status === 'ALL' ? undefined : query.status;

  const inRange = allPublications.filter((pub) => {
    // A publication is "on calendar" if it has a scheduledAt date
    if (!pub.scheduledAt) return false;

    const dt = new Date(pub.scheduledAt);

    // Date range filter
    if (dt < start || dt > end) return false;

    // Status filter
    if (statusFilter && pub.status !== statusFilter) return false;

    // Account filter
    if (query.socialAccountId && pub.socialAccountId !== query.socialAccountId) return false;

    return true;
  });

  // Resolve relations (content + account + platform) in parallel
  const [allContent, allAccounts, allPlatforms] = await Promise.all([
    repos.content.findAll(),
    repos.socialAccounts.findAll(),
    repos.platforms.findAll(),
  ]);

  const contentMap = new Map(allContent.map((c) => [c.id, c]));
  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
  const platformMap = new Map(allPlatforms.map((p) => [p.id, p]));

  const events: CalendarEvent[] = [];

  for (const pub of inRange) {
    const content = contentMap.get(pub.contentId);
    const account = accountMap.get(pub.socialAccountId);
    if (!content || !account) {
      // Orphan guard: skip broken records — should never happen due to referential integrity
      console.warn(
        `[getCalendarEvents] Orphan publication detected: pubId=${pub.id}, contentId=${pub.contentId}, accountId=${pub.socialAccountId}`
      );
      continue;
    }
    const platform = platformMap.get(account.platformId);

    events.push({
      publication: pub,
      content,
      account,
      platformName: platform?.name ?? 'Unknown Platform',
      platformIcon: platform?.icon ?? '?',
    });
  }

  // Sort chronologically by scheduledAt
  events.sort(
    (a, b) =>
      new Date(a.publication.scheduledAt!).getTime() -
      new Date(b.publication.scheduledAt!).getTime()
  );

  return events;
}

// ─── Schedule a New Publication ────────────────────────────────────────────────

/**
 * Schedule an APPROVED content item for a specific social account.
 * Rules:
 * 1. Content must exist and be in APPROVED or SCHEDULED status.
 * 2. Social account must exist and NOT be in CONNECTION_ERROR or ARCHIVED status.
 * 3. scheduledAt must be a future UTC timestamp.
 * 4. Duplicate detection: warn if a publication for same content+account already exists.
 * 5. After creation, transition content status to SCHEDULED if it isn't already.
 */
export async function schedulePublication(
  input: SchedulePublicationInput,
  actor: TeamMember
): Promise<ContentPublication> {
  const repos = getRepositories();

  // 1. Validate timestamp
  validateScheduledAt(input.scheduledAt);

  // 2. Validate content
  const content = await repos.content.findById(input.contentId);
  if (!content) {
    throw new SchedulingError(
      `Content "${input.contentId}" does not exist.`,
      'CONTENT_NOT_FOUND',
      404
    );
  }
  if (content.status !== 'APPROVED' && content.status !== 'SCHEDULED') {
    throw new SchedulingError(
      `Only APPROVED or SCHEDULED content can be scheduled for publication. Current status: "${content.status}".`,
      'CONTENT_NOT_APPROVED',
      422
    );
  }

  // 3. Validate social account
  const account = await repos.socialAccounts.findById(input.socialAccountId);
  if (!account) {
    throw new SchedulingError(
      `Social account "${input.socialAccountId}" does not exist.`,
      'ACCOUNT_NOT_FOUND',
      404
    );
  }
  if (account.status === 'ARCHIVED') {
    throw new SchedulingError(
      `Social account "${account.accountName}" is archived and cannot receive scheduled publications.`,
      'ACCOUNT_ARCHIVED',
      422
    );
  }
  if (account.status === 'CONNECTION_ERROR') {
    throw new SchedulingError(
      `Social account "${account.accountName}" has a CONNECTION_ERROR and may not be available for scheduling. Please resolve the connection issue first.`,
      'ACCOUNT_CONNECTION_ERROR',
      422
    );
  }
  if (account.status === 'INACTIVE') {
    throw new SchedulingError(
      `Social account "${account.accountName}" is inactive and cannot receive scheduled publications.`,
      'ACCOUNT_INACTIVE',
      422
    );
  }

  // 4. Duplicate detection — same content + same account with non-cancelled status
  const existing = await repos.publications.findByContentId(input.contentId);
  const duplicate = existing.find(
    (p) =>
      p.socialAccountId === input.socialAccountId &&
      p.status !== 'CANCELLED' &&
      p.status !== 'FAILED'
  );
  if (duplicate) {
    throw new SchedulingError(
      `A publication for content "${content.title}" on account "${account.accountName}" already exists (ID: ${duplicate.id}, status: ${duplicate.status}). Cancel or delete it before creating a new one.`,
      'DUPLICATE_PUBLICATION',
      409
    );
  }

  // 5. Create the publication record (IDs generated server-side by repository)
  const publication = await repos.publications.create({
    contentId: input.contentId,
    socialAccountId: input.socialAccountId,
    scheduledAt: input.scheduledAt,
    status: 'QUEUED',
    platformSpecificCaption: input.platformSpecificCaption?.trim() || undefined,
    platformSpecificTitle: input.platformSpecificTitle?.trim() || undefined,
  });

  // 6. Transition content to SCHEDULED if currently APPROVED
  if (content.status === 'APPROVED') {
    await repos.content.update(input.contentId, { status: 'SCHEDULED' });
  }

  // 7. Audit log
  await logSecurityActivity(
    actor.authUid || actor.id,
    'SCHEDULE',
    'ContentPublication',
    publication.id,
    {
      publicationId: publication.id,
      contentId: input.contentId,
      contentTitle: content.title,
      socialAccountId: input.socialAccountId,
      accountName: account.accountName,
      scheduledAt: input.scheduledAt,
      scheduledBy: actor.id,
    }
  );

  return publication;
}

// ─── Get Single Publication ────────────────────────────────────────────────────

export async function getPublication(
  pubId: string,
  _actor: TeamMember
): Promise<CalendarEvent> {
  const repos = getRepositories();

  const pub = await repos.publications.findById(pubId);
  if (!pub) throw new PublicationNotFoundError(pubId);

  const [content, account, platforms] = await Promise.all([
    repos.content.findById(pub.contentId),
    repos.socialAccounts.findById(pub.socialAccountId),
    repos.platforms.findAll(),
  ]);

  if (!content || !account) {
    throw new SchedulingError(
      `Publication "${pubId}" references a missing content or account record.`,
      'ORPHAN_PUBLICATION',
      500
    );
  }

  const platform = platforms.find((p) => p.id === account.platformId);

  return {
    publication: pub,
    content,
    account,
    platformName: platform?.name ?? 'Unknown Platform',
    platformIcon: platform?.icon ?? '?',
  };
}

// ─── Reschedule Publication ────────────────────────────────────────────────────

/**
 * Update the scheduledAt time and/or platform-specific caption/title of a QUEUED publication.
 * Only QUEUED publications may be rescheduled. PUBLISHED, FAILED, CANCELLED are immutable.
 */
export async function reschedulePublication(
  pubId: string,
  input: ReschedulePublicationInput,
  actor: TeamMember
): Promise<ContentPublication> {
  const repos = getRepositories();

  const pub = await repos.publications.findById(pubId);
  if (!pub) throw new PublicationNotFoundError(pubId);

  if (pub.status !== 'QUEUED' && pub.status !== 'RETRYING') {
    throw new SchedulingError(
      `Only QUEUED or RETRYING publications can be rescheduled. Current status: "${pub.status}".`,
      'PUBLICATION_NOT_RESCHEDULABLE',
      422
    );
  }

  // Validate new timestamp
  validateScheduledAt(input.scheduledAt);

  const patch: Partial<ContentPublication> = {
    scheduledAt: input.scheduledAt,
  };
  if (input.platformSpecificCaption !== undefined) {
    patch.platformSpecificCaption = input.platformSpecificCaption.trim() || undefined;
  }
  if (input.platformSpecificTitle !== undefined) {
    patch.platformSpecificTitle = input.platformSpecificTitle.trim() || undefined;
  }

  const updated = await repos.publications.update(pubId, patch);

  await logSecurityActivity(
    actor.authUid || actor.id,
    'UPDATE',
    'ContentPublication',
    pubId,
    {
      publicationId: pubId,
      previousScheduledAt: pub.scheduledAt,
      newScheduledAt: input.scheduledAt,
      rescheduledBy: actor.id,
    }
  );

  return updated;
}

// ─── Cancel Publication ────────────────────────────────────────────────────────

/**
 * Cancel a QUEUED or RETRYING publication.
 * Optionally re-evaluates content status: if all publications for the content
 * are CANCELLED or FAILED, content status is rolled back to APPROVED.
 */
export async function cancelPublication(
  pubId: string,
  actor: TeamMember
): Promise<ContentPublication> {
  const repos = getRepositories();

  const pub = await repos.publications.findById(pubId);
  if (!pub) throw new PublicationNotFoundError(pubId);

  if (pub.status !== 'QUEUED' && pub.status !== 'RETRYING') {
    throw new SchedulingError(
      `Only QUEUED or RETRYING publications can be cancelled. Current status: "${pub.status}".`,
      'PUBLICATION_NOT_CANCELLABLE',
      422
    );
  }

  const cancelled = await repos.publications.update(pubId, { status: 'CANCELLED' });

  // Roll back content status if no remaining active publications exist
  const allPubs = await repos.publications.findByContentId(pub.contentId);
  const activePublications = allPubs.filter(
    (p) => p.id !== pubId && p.status !== 'CANCELLED' && p.status !== 'FAILED'
  );
  if (activePublications.length === 0) {
    const content = await repos.content.findById(pub.contentId);
    if (content && content.status === 'SCHEDULED') {
      await repos.content.update(pub.contentId, { status: 'APPROVED' });
    }
  }

  await logSecurityActivity(
    actor.authUid || actor.id,
    'UPDATE',
    'ContentPublication',
    pubId,
    {
      publicationId: pubId,
      contentId: pub.contentId,
      previousStatus: pub.status,
      newStatus: 'CANCELLED',
      cancelledBy: actor.id,
    }
  );

  return cancelled;
}

// ─── Agency Timezone Helper ─────────────────────────────────────────────────────

/**
 * Fetch the agency's configured timezone. Falls back to 'UTC' if unset.
 */
export async function getAgencyTimezone(): Promise<string> {
  const repos = getRepositories();
  try {
    const settings = await repos.settings.getSettings();
    return settings?.timezone || 'UTC';
  } catch {
    return 'UTC';
  }
}
