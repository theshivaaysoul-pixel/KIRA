// src/lib/content/workflow-transitions.ts
// Pure, isomorphic content workflow transition rules.
// Safe to import in both server and client code.
// No Next.js or server-only imports allowed here.

import type { ContentStatus, TeamMember } from '@/lib/types/domain';
import { CONTENT_WORKFLOW_TRANSITIONS } from '@/lib/types/domain';
import { hasPermission } from '@/lib/auth/permissions';

const APPROVAL_REQUIRED_STATUSES: ContentStatus[] = ['APPROVED'];
const ENGINE_ONLY_STATUSES: ContentStatus[] = ['PUBLISHED', 'FAILED'];

/**
 * Get allowed next statuses for a content item given an actor's role.
 * Returns only statuses the actor has permission to transition to.
 * Safe to call from client components.
 */
export function getAllowedTransitions(
  currentStatus: ContentStatus,
  actor: Pick<TeamMember, 'role'>
): ContentStatus[] {
  if (currentStatus === 'ARCHIVED') return [];

  const raw = CONTENT_WORKFLOW_TRANSITIONS[currentStatus] ?? [];
  return raw.filter((s) => {
    if (ENGINE_ONLY_STATUSES.includes(s)) return false;
    if (APPROVAL_REQUIRED_STATUSES.includes(s)) {
      return hasPermission(actor.role, 'content.approve');
    }
    return true;
  });
}

export const STATUS_TRANSITION_LABELS: Partial<Record<ContentStatus, string>> = {
  IDEA:       'Move back to Idea',
  SCRIPT:     'Move to Script',
  PRODUCTION: 'Move to Production',
  EDITING:    'Move to Editing',
  REVIEW:     'Send for Review',
  APPROVED:   'Approve',
  SCHEDULED:  'Mark as Scheduled',
  ARCHIVED:   'Archive',
};
