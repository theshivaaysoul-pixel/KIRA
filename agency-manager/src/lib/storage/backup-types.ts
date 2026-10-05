// src/lib/storage/backup-types.ts
// Domain and metadata types for storage backup and recovery.

import { z } from 'zod';

export const BACKUP_REASONS = [
  'BEFORE_UPDATE',
  'BEFORE_DELETE',
  'MANUAL_BACKUP',
  'RECOVERY',
  'SYSTEM_SAFETY',
] as const;

export type BackupReason = (typeof BACKUP_REASONS)[number];

export const BackupReasonSchema = z.enum(BACKUP_REASONS);

export interface BackupMetadata {
  id: string;
  sourcePath: string;
  backupPath: string;
  createdAt: string;
  reason: BackupReason;
  size: number;
  checksum: string; // SHA-256 hex string
  recordCount?: number;
}

export const BackupMetadataSchema = z.object({
  id: z.string().min(1),
  sourcePath: z.string().min(1),
  backupPath: z.string().min(1),
  createdAt: z.string().datetime(),
  reason: BackupReasonSchema,
  size: z.number().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a valid 64-character SHA-256 hex string'),
  recordCount: z.number().int().nonnegative().optional(),
});

/**
 * Allowed database resources with their live storage paths.
 * Prevents path traversal and unauthorized file access.
 */
export const DATABASE_RESOURCES = {
  platforms: 'database/platforms.json',
  'social-accounts': 'database/social-accounts.json',
  content: 'database/content.json',
  'content-assets': 'database/content-assets.json',
  'content-publications': 'database/content-publications.json',
  'team-members': 'database/team-members.json',
  tasks: 'database/tasks.json',
  'daily-targets': 'database/daily-targets.json',
  'content-platform-targets': 'database/content-platform-targets.json',
  analytics: 'database/analytics.json',
  notifications: 'database/notifications.json',
  'activity-logs': 'database/activity-logs.json',
  settings: 'database/settings.json',
} as const;

export type DatabaseResourceName = keyof typeof DATABASE_RESOURCES;

export const ALLOWED_RESOURCE_NAMES = Object.keys(DATABASE_RESOURCES) as DatabaseResourceName[];

import {
  PlatformSchema,
  SocialAccountSchema,
  ContentSchema,
  ContentAssetSchema,
  ContentPublicationSchema,
  TeamMemberSchema,
  TaskSchema,
  DailyContentTargetSchema,
  ContentPlatformTargetSchema,
  AnalyticsSnapshotSchema,
  NotificationSchema,
  ActivityLogSchema,
  AgencySettingsSchema,
} from '../validation';

export function getResourceSchema(resource: DatabaseResourceName): z.ZodType<unknown> {
  switch (resource) {
    case 'platforms':
      return z.array(PlatformSchema);
    case 'social-accounts':
      return z.array(SocialAccountSchema);
    case 'content':
      return z.array(ContentSchema);
    case 'content-assets':
      return z.array(ContentAssetSchema);
    case 'content-publications':
      return z.array(ContentPublicationSchema);
    case 'team-members':
      return z.array(TeamMemberSchema);
    case 'tasks':
      return z.union([z.object({ tasks: z.array(TaskSchema) }), z.array(TaskSchema)]);
    case 'daily-targets':
      return z.array(DailyContentTargetSchema);
    case 'content-platform-targets':
      return z.array(ContentPlatformTargetSchema);
    case 'analytics':
      return z.array(AnalyticsSnapshotSchema);
    case 'notifications':
      return z.array(NotificationSchema);
    case 'activity-logs':
      return z.array(ActivityLogSchema);
    case 'settings':
      return AgencySettingsSchema;
    default:
      throw new Error(`Unknown database resource: ${resource}`);
  }
}

