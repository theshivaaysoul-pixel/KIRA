// src/lib/services/content-workflow-service.ts
// Centralized Content workflow transition validation.
// ALL status transition rules live here — never in routes, components, or forms.

import type { Content, ContentStatus, TeamMember } from '@/lib/types/domain';
import { CONTENT_WORKFLOW_TRANSITIONS } from '@/lib/types/domain';
import { hasPermission } from '@/lib/auth/permissions';
import { logSecurityActivity } from '@/lib/auth/authorization';

export class WorkflowError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'WORKFLOW_ERROR', status = 422) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.status = status;
  }
}

// Statuses that require content.approve permission to enter
const APPROVAL_REQUIRED_STATUSES: ContentStatus[] = ['APPROVED'];

// Statuses that indicate publishing-engine involvement (not user-settable)
const ENGINE_ONLY_STATUSES: ContentStatus[] = ['PUBLISHED', 'FAILED'];

/**
 * Validate that a status transition is permitted for the given actor.
 * Throws WorkflowError if invalid.
 */
export function validateTransition(
  content: Content,
  requestedStatus: ContentStatus,
  actor: TeamMember
): void {
  const current = content.status;

  if (current === requestedStatus) {
    throw new WorkflowError(
      `Content is already in status "${current}".`,
      'WORKFLOW_ALREADY_IN_STATUS',
      422
    );
  }

  if (ENGINE_ONLY_STATUSES.includes(requestedStatus)) {
    throw new WorkflowError(
      `Status "${requestedStatus}" is managed by the publishing engine and cannot be set manually. Publishing integration is not yet available.`,
      'WORKFLOW_ENGINE_ONLY',
      422
    );
  }

  const allowed = CONTENT_WORKFLOW_TRANSITIONS[current] ?? [];
  if (!allowed.includes(requestedStatus)) {
    throw new WorkflowError(
      `Cannot transition content from "${current}" to "${requestedStatus}". Allowed next states: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
      'WORKFLOW_INVALID_TRANSITION',
      422
    );
  }

  if (APPROVAL_REQUIRED_STATUSES.includes(requestedStatus)) {
    if (!hasPermission(actor.role, 'content.approve')) {
      throw new WorkflowError(
        `Transitioning content to "${requestedStatus}" requires the content.approve permission. Your role (${actor.role}) does not have this permission.`,
        'WORKFLOW_INSUFFICIENT_PERMISSION',
        403
      );
    }
  }
}

/**
 * Get the allowed next statuses for a content item given an actor's role.
 * Used by the UI to show only valid workflow actions.
 */
export function getAllowedTransitions(
  content: Content,
  actor: TeamMember
): ContentStatus[] {
  const raw = CONTENT_WORKFLOW_TRANSITIONS[content.status] ?? [];
  return raw.filter((s) => {
    if (ENGINE_ONLY_STATUSES.includes(s)) return false;
    if (APPROVAL_REQUIRED_STATUSES.includes(s)) {
      return hasPermission(actor.role, 'content.approve');
    }
    return true;
  });
}

/**
 * Log a workflow transition to the ActivityLog.
 */
export async function logWorkflowTransition(
  actor: TeamMember,
  content: Content,
  previousStatus: ContentStatus,
  newStatus: ContentStatus
): Promise<void> {
  await logSecurityActivity(
    actor.authUid || actor.id,
    'UPDATE',
    'Content',
    content.id,
    {
      action: 'WORKFLOW_TRANSITION',
      contentId: content.id,
      contentTitle: content.title,
      previousStatus,
      newStatus,
      performedBy: actor.id,
    }
  );
}
