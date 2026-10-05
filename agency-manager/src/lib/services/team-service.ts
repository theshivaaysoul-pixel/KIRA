// src/lib/services/team-service.ts
// Phase 19 — KIRA Team Member Service
//
// Manages team member lifecycle, role hierarchy enforcement,
// last-owner protection, and security activity logging.
//
// CRITICAL RULES:
//  - Zero mock data; operates on real storage via Repositories
//  - Enforces hierarchy: non-owners cannot assign OWNER or edit OWNER accounts
//  - Enforces last-owner protection: cannot demote, suspend, or delete the last active OWNER
//  - Logs security activity for all mutations

import { getRepositories, type Repositories } from '../repositories';
import type { TeamMember, TeamRole, TeamMemberStatus } from '../types/domain';
import { CreateTeamMemberSchema, UpdateTeamMemberSchema } from '../validation';
import { ROLE_HIERARCHY, hasPermission } from '../auth/permissions';
import type { z } from 'zod';

export type CreateTeamMemberInput = z.infer<typeof CreateTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberSchema>;

export interface TeamMemberFilters {
  search?: string;
  role?: TeamRole | 'ALL';
  status?: TeamMemberStatus | 'ALL';
  sort?: 'name' | 'createdAt' | 'role' | 'email';
  order?: 'asc' | 'desc';
}

export interface TeamStats {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  inactive: number;
  roleCounts: Record<TeamRole, number>;
}

export class TeamServiceError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'TeamServiceError';
  }
}

export class TeamService {
  private readonly repos: Repositories;

  constructor(repos: Repositories = getRepositories()) {
    this.repos = repos;
  }

  /**
   * List all team members with optional search, role filter, status filter, and sorting.
   */
  async listMembers(filters?: TeamMemberFilters): Promise<TeamMember[]> {
    let members = await this.repos.teamMembers.findAll();

    if (!filters) return members;

    const { search, role, status, sort = 'name', order = 'asc' } = filters;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      );
    }

    if (role && role !== 'ALL') {
      members = members.filter((m) => m.role === role);
    }

    if (status && status !== 'ALL') {
      members = members.filter((m) => m.status === status);
    }

    members.sort((a, b) => {
      let comparison = 0;
      if (sort === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sort === 'email') {
        comparison = a.email.localeCompare(b.email);
      } else if (sort === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sort === 'role') {
        const rankA = ROLE_HIERARCHY[a.role] || 0;
        const rankB = ROLE_HIERARCHY[b.role] || 0;
        comparison = rankB - rankA;
      }
      return order === 'desc' ? -comparison : comparison;
    });

    return members;
  }

  /**
   * Get an individual team member by ID.
   */
  async getMemberById(id: string): Promise<TeamMember | null> {
    return this.repos.teamMembers.findById(id);
  }

  /**
   * Calculate aggregated team statistics.
   */
  async getStats(): Promise<TeamStats> {
    const members = await this.repos.teamMembers.findAll();

    const roleCounts: Record<TeamRole, number> = {
      OWNER: 0,
      ADMIN: 0,
      MANAGER: 0,
      EDITOR: 0,
      DESIGNER: 0,
      ANALYST: 0,
      VIEWER: 0,
      MEMBER: 0,
    };

    let active = 0;
    let invited = 0;
    let suspended = 0;
    let inactive = 0;

    for (const m of members) {
      if (roleCounts[m.role] !== undefined) {
        roleCounts[m.role]++;
      }
      if (m.status === 'ACTIVE') active++;
      else if (m.status === 'INVITED') invited++;
      else if (m.status === 'SUSPENDED') suspended++;
      else if (m.status === 'INACTIVE') inactive++;
    }

    return {
      total: members.length,
      active,
      invited,
      suspended,
      inactive,
      roleCounts,
    };
  }

  /**
   * Create / invite a new team member with hierarchy checks and audit logging.
   */
  async createMember(
    input: CreateTeamMemberInput,
    actor: { id: string; role: TeamRole }
  ): Promise<TeamMember> {
    const validated = CreateTeamMemberSchema.parse(input);

    // Only OWNER can assign OWNER role
    if (validated.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new TeamServiceError(
        'Only an existing OWNER can invite or assign the OWNER role.',
        'FORBIDDEN_CANNOT_ASSIGN_OWNER',
        403
      );
    }

    // Check duplicate email
    const existing = await this.repos.teamMembers.findByEmail(validated.email);
    if (existing) {
      throw new TeamServiceError(
        `A team member with email "${validated.email}" already exists.`,
        'EMAIL_ALREADY_EXISTS',
        409
      );
    }

    const created = await this.repos.teamMembers.create(validated);

    // Record audit activity
    try {
      await this.repos.activityLogs.log({
        userId: actor.id,
        action: 'CREATE',
        entityType: 'TeamMember',
        entityId: created.id,
        metadata: {
          role: created.role,
          status: created.status,
          email: created.email,
          name: created.name,
          createdBy: actor.id,
        },
      });
    } catch (logErr) {
      console.warn('[TeamService] Failed to record activity log for team member creation:', logErr);
    }

    return created;
  }

  /**
   * Update team member profile or role/status with last-owner and hierarchy guards.
   */
  async updateMember(
    id: string,
    updates: UpdateTeamMemberInput,
    actor: { id: string; role: TeamRole }
  ): Promise<TeamMember> {
    const validated = UpdateTeamMemberSchema.parse(updates);
    const target = await this.repos.teamMembers.findById(id);

    if (!target) {
      throw new TeamServiceError(`Team member with ID "${id}" was not found.`, 'TEAM_MEMBER_NOT_FOUND', 404);
    }

    // Role or Status modification checks
    if (validated.role !== undefined || validated.status !== undefined) {
      // 1. Permission checks
      if (validated.role !== undefined && !hasPermission(actor.role, 'team.role.update')) {
        throw new TeamServiceError('You do not have permission to update team roles.', 'FORBIDDEN', 403);
      }
      if (validated.status !== undefined && !hasPermission(actor.role, 'team.update')) {
        throw new TeamServiceError('You do not have permission to update team member status.', 'FORBIDDEN', 403);
      }

      // 2. Hierarchy rules
      if (validated.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new TeamServiceError(
          'Only an existing OWNER can assign the OWNER role to a team member.',
          'FORBIDDEN_CANNOT_ASSIGN_OWNER',
          403
        );
      }

      if (target.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new TeamServiceError('Only an OWNER can modify another OWNER account.', 'FORBIDDEN', 403);
      }

      if (actor.role !== 'OWNER') {
        const actorRank = ROLE_HIERARCHY[actor.role] || 0;
        const targetRank = ROLE_HIERARCHY[target.role] || 0;
        if (targetRank >= actorRank && actor.id !== target.id) {
          throw new TeamServiceError(
            'Cannot modify a team member of equal or higher role privilege.',
            'FORBIDDEN_HIERARCHY_VIOLATION',
            403
          );
        }
      }

      // 3. Last OWNER Protection
      if (target.role === 'OWNER' && target.status === 'ACTIVE') {
        const isDemoting = validated.role !== undefined && validated.role !== 'OWNER';
        const isDeactivating = validated.status !== undefined && validated.status !== 'ACTIVE';

        if (isDemoting || isDeactivating) {
          const activeOwnerCount = await this.repos.teamMembers.countActiveOwners();
          if (activeOwnerCount <= 1) {
            throw new TeamServiceError(
              'Cannot demote or deactivate the last remaining active agency OWNER.',
              'CANNOT_REMOVE_LAST_OWNER',
              422
            );
          }
        }
      }
    } else {
      // General profile updates
      const isSelf = actor.id === target.id;
      if (!isSelf && !['OWNER', 'ADMIN'].includes(actor.role)) {
        throw new TeamServiceError(
          'You do not have permission to update other team members.',
          'FORBIDDEN',
          403
        );
      }
    }

    const updated = await this.repos.teamMembers.update(id, validated);
    if (!updated) {
      throw new TeamServiceError('Update failed to persist.', 'INTERNAL_ERROR', 500);
    }

    // Security activity logs
    try {
      if (validated.role && validated.role !== target.role) {
        await this.repos.activityLogs.log({
          userId: actor.id,
          action: 'ROLE_CHANGED',
          entityType: 'TeamMember',
          entityId: target.id,
          metadata: {
            oldRole: target.role,
            newRole: updated.role,
            changedBy: actor.id,
          },
        });
      }

      if (validated.status && validated.status !== target.status) {
        const action =
          validated.status === 'SUSPENDED'
            ? 'TEAM_MEMBER_SUSPENDED'
            : validated.status === 'ACTIVE' && target.status === 'SUSPENDED'
            ? 'TEAM_MEMBER_REACTIVATED'
            : 'UPDATE';

        await this.repos.activityLogs.log({
          userId: actor.id,
          action,
          entityType: 'TeamMember',
          entityId: target.id,
          metadata: {
            previousStatus: target.status,
            newStatus: updated.status,
            changedBy: actor.id,
          },
        });
      }
    } catch (logErr) {
      console.warn('[TeamService] Failed to record activity log for team member update:', logErr);
    }

    return updated;
  }

  /**
   * Delete a team member with last-owner and self-deletion guards.
   */
  async deleteMember(id: string, actor: { id: string; role: TeamRole }): Promise<{ deleted: boolean }> {
    const target = await this.repos.teamMembers.findById(id);

    if (!target) {
      throw new TeamServiceError(`Team member with ID "${id}" was not found.`, 'TEAM_MEMBER_NOT_FOUND', 404);
    }

    if (actor.id === target.id) {
      throw new TeamServiceError('You cannot delete your own team member account.', 'CANNOT_DELETE_SELF', 403);
    }

    if (target.role === 'OWNER') {
      const activeOwners = await this.repos.teamMembers.countActiveOwners();
      if (activeOwners <= 1) {
        throw new TeamServiceError(
          'Cannot delete the last remaining active agency OWNER.',
          'CANNOT_REMOVE_LAST_OWNER',
          422
        );
      }
    }

    const deleted = await this.repos.teamMembers.delete(id);
    if (!deleted) {
      throw new TeamServiceError('Failed to delete team member.', 'INTERNAL_ERROR', 500);
    }

    try {
      await this.repos.activityLogs.log({
        userId: actor.id,
        action: 'DELETE',
        entityType: 'TeamMember',
        entityId: id,
        metadata: {
          deletedRole: target.role,
          deletedEmail: target.email,
          deletedName: target.name,
          deletedBy: actor.id,
        },
      });
    } catch (logErr) {
      console.warn('[TeamService] Failed to record activity log for team member deletion:', logErr);
    }

    return { deleted: true };
  }
}

let _teamService: TeamService | null = null;

export function getTeamService(): TeamService {
  if (!_teamService) {
    _teamService = new TeamService();
  }
  return _teamService;
}
