// src/lib/validation/index.ts
// Strict server-side Zod validation schemas for all KIRA domain models.
// Enforces required fields, string lengths, ID patterns, enum validity, dates, and numbers.

import { z } from 'zod';

// ─── ID Regex Helpers ─────────────────────────────────────────────────────────
export const ID_REGEX = {
  PLATFORM: /^PLT-\d{6}$/,
  SOCIAL_ACCOUNT: /^ACC-\d{6}$/,
  CONTENT: /^CNT-\d{6}$/,
  CONTENT_ASSET: /^AST-\d{6}$/,
  PUBLICATION: /^PUB-\d{6}$/,
  TEAM_MEMBER: /^USR-\d{6}$/,
  TASK: /^TSK-\d{6}$/,
  DAILY_TARGET: /^DCT-\d{6}$/,
  CONTENT_PLATFORM_TARGET: /^CPT-\d{6}$/,
  ANALYTICS: /^ANL-\d{6}$/,
  NOTIFICATION: /^NTF-\d{6}$/,
  ACTIVITY: /^ACT-\d{6}$/,
};

const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const isoDateString = z.string().regex(dateRegex, 'Must be valid ISO date string');

// ─── 1. Platform Schema ───────────────────────────────────────────────────────
export const PlatformCapabilityEnum = z.enum([
  'text',
  'image',
  'video',
  'carousel',
  'story',
  'shortVideo',
  'live',
  'scheduling',
  'analytics',
  'publishing',
]);

export const PlatformSchema = z.object({
  id: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens (e.g. "instagram", "tiktok")'),
  icon: z.string().trim().min(1, 'Icon identifier is required').max(100),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
  capabilities: z.array(PlatformCapabilityEnum).min(1, 'At least one capability required'),
  createdAt: isoDateString,
  updatedAt: isoDateString,
  deletedAt: isoDateString.nullable().optional(),
});

export const CreatePlatformSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens (e.g. "instagram", "tiktok")'),
  icon: z.string().trim().min(1, 'Icon identifier is required').max(100),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
  capabilities: z.array(PlatformCapabilityEnum).min(1, 'At least one capability required'),
});

export const UpdatePlatformSchema = CreatePlatformSchema.partial().extend({
  deletedAt: isoDateString.nullable().optional(),
});

// ─── 2. Social Account Schema ─────────────────────────────────────────────────
export const SocialAccountStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
  'CONNECTION_ERROR',
]);

export const HttpUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine((url) => /^https?:\/\//i.test(url), {
    message: 'URL must use http:// or https:// protocol',
  })
  .optional()
  .or(z.literal(''));

export const SocialAccountSchema = z.object({
  id: z.string().regex(ID_REGEX.SOCIAL_ACCOUNT, 'Invalid SocialAccount ID format (ACC-XXXXXX)'),
  platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID reference'),
  accountName: z.string().trim().min(1, 'Account name is required').max(100, 'Account name must not exceed 100 characters'),
  username: z.string().trim().min(1, 'Username is required').max(100, 'Username must not exceed 100 characters'),
  profileUrl: HttpUrlSchema,
  avatarUrl: HttpUrlSchema,
  niche: z.string().trim().max(100, 'Niche must not exceed 100 characters').optional().or(z.literal('')),
  description: z.string().trim().max(1000, 'Description must not exceed 1000 characters').optional().or(z.literal('')),
  status: SocialAccountStatusEnum.default('ACTIVE'),
  assignedManagerId: z.string().regex(ID_REGEX.TEAM_MEMBER, 'Invalid Team Member ID format (USR-XXXXXX)').optional().or(z.literal('')),
  externalAccountId: z.string().trim().max(255, 'External account ID must not exceed 255 characters').optional().or(z.literal('')),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const CreateSocialAccountSchema = SocialAccountSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateSocialAccountSchema = CreateSocialAccountSchema.partial();

// ─── 3. Content Schema ────────────────────────────────────────────────────────
export const ContentTypeEnum = z.enum([
  'POST',
  'REEL',
  'SHORT',
  'VIDEO',
  'IMAGE',
  'CAROUSEL',
  'STORY',
  'TEXT',
  'LIVE',
  'OTHER',
]);

export const ContentStatusEnum = z.enum([
  'IDEA',
  'SCRIPT',
  'PRODUCTION',
  'EDITING',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
  'ARCHIVED',
]);

export const ContentSchema = z.object({
  id: z.string().regex(ID_REGEX.CONTENT, 'Invalid Content ID format (CNT-XXXXXX)'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  contentType: ContentTypeEnum,
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().regex(/^#?[a-zA-Z0-9_]+$/, 'Invalid hashtag format')).default([]),
  targetPlatformIds: z.array(z.string()).optional(),
  status: ContentStatusEnum,
  createdBy: z.string().min(1, 'Creator ID is required'),
  createdAt: isoDateString,
  updatedAt: isoDateString,
  deletedAt: isoDateString.optional().nullable(),
  deletedFromStatus: ContentStatusEnum.optional().nullable(),
  deletedFromPlatformIds: z.array(z.string()).optional().nullable(),
});

export const CreateContentSchema = ContentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateContentSchema = CreateContentSchema.partial();

// ─── 4. Content Asset Schema ──────────────────────────────────────────────────
export const AssetTypeEnum = z.enum([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'THUMBNAIL',
  'OTHER',
]);

export const ContentAssetSchema = z.object({
  id: z.string().regex(ID_REGEX.CONTENT_ASSET, 'Invalid ContentAsset ID format (AST-XXXXXX)'),
  contentId: z.string().regex(ID_REGEX.CONTENT, 'Invalid Content ID reference'),
  type: AssetTypeEnum,
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.string().min(1, 'MIME type is required'),
  size: z.number().int().nonnegative('Size must be non-negative'),
  storagePath: z.string().min(1, 'Storage path is required'),
  thumbnailPath: z.string().optional(),
  createdAt: isoDateString,
});

export const CreateContentAssetSchema = ContentAssetSchema.omit({
  id: true,
  createdAt: true,
});

// ─── 5. Content Publication Schema ────────────────────────────────────────────
export const PublicationStatusEnum = z.enum([
  'QUEUED',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
  'RETRYING',
  'CANCELLED',
]);

export const ContentPublicationSchema = z.object({
  id: z.string().regex(ID_REGEX.PUBLICATION, 'Invalid Publication ID format (PUB-XXXXXX)'),
  contentId: z.string().regex(ID_REGEX.CONTENT, 'Invalid Content ID reference'),
  socialAccountId: z.string().regex(ID_REGEX.SOCIAL_ACCOUNT, 'Invalid SocialAccount ID reference'),
  platformSpecificCaption: z.string().max(5000).optional(),
  platformSpecificTitle: z.string().max(200).optional(),
  scheduledAt: isoDateString.optional(),
  publishedAt: isoDateString.optional(),
  publishedUrl: z.string().url().optional(),
  status: PublicationStatusEnum,
  externalPostId: z.string().max(255).optional(),
  errorMessage: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const CreateContentPublicationSchema = ContentPublicationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateContentPublicationSchema = CreateContentPublicationSchema.partial();

// ─── 6. Team Member Schema ────────────────────────────────────────────────────
export const TeamRoleEnum = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'EDITOR',
  'DESIGNER',
  'ANALYST',
  'VIEWER',
  'MEMBER',
]);

export const TeamMemberStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'INVITED',
  'SUSPENDED',
]);

export const TeamMemberSchema = z.object({
  id: z.string().regex(ID_REGEX.TEAM_MEMBER, 'Invalid TeamMember ID format (USR-XXXXXX)'),
  authUid: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  role: TeamRoleEnum,
  status: TeamMemberStatusEnum,
  customPermissions: z.array(z.string()).optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const CreateTeamMemberSchema = TeamMemberSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial();

// ─── 7. Task Schema ───────────────────────────────────────────────────────────
export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const TaskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'COMPLETED',
  'CANCELLED',
]);

export const VALID_TASK_STATUS_TRANSITIONS: Record<z.infer<typeof TaskStatusEnum>, z.infer<typeof TaskStatusEnum>[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'REVIEW', 'CANCELLED'],
  REVIEW: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELLED: ['TODO'],
};

export const TaskSchema = z.object({
  id: z.string().regex(ID_REGEX.TASK, 'Invalid Task ID format (TSK-XXXXXX)'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  description: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().max(2000, 'Description cannot exceed 2000 characters').optional()
  ),
  assignedTo: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().regex(ID_REGEX.TEAM_MEMBER, 'Invalid TeamMember ID format (USR-XXXXXX)').optional()
  ),
  relatedContentId: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().regex(ID_REGEX.CONTENT, 'Invalid Content ID format (CNT-XXXXXX)').optional()
  ),
  relatedAccountId: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().regex(ID_REGEX.SOCIAL_ACCOUNT, 'Invalid SocialAccount ID format (ACC-XXXXXX)').optional()
  ),
  priority: TaskPriorityEnum,
  status: TaskStatusEnum,
  dueDate: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    isoDateString.optional()
  ),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  priority: TaskPriorityEnum.optional().default('MEDIUM'),
  status: TaskStatusEnum.optional().default('TODO'),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

// ─── 7b. Daily Content Target Schema ──────────────────────────────────────────
export const PlatformTargetItemSchema = z.object({
  platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
  targetCount: z.number().int().min(0, 'Target count must be a non-negative integer'),
  completedCount: z.number().int().min(0, 'Completed count must be a non-negative integer'),
  completedContentIds: z.array(z.string().regex(ID_REGEX.CONTENT)).optional().default([]),
});

export const DailyContentTargetSchema = z.object({
  id: z.string().regex(ID_REGEX.DAILY_TARGET, 'Invalid Daily Target ID format (DCT-XXXXXX)'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  platformTargets: z.array(PlatformTargetItemSchema),
  createdBy: z.string().regex(ID_REGEX.TEAM_MEMBER, 'Invalid TeamMember ID format (USR-XXXXXX)'),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const UpdateDailyTargetsInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  platformTargets: z.array(
    z.object({
      platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
      targetCount: z.number().int().min(0, 'Target count must be a non-negative integer'),
    })
  ),
});

// ─── 7c. Content Platform Target Schema ───────────────────────────────────────
export const ContentPlatformTargetSchema = z.object({
  id: z.string().regex(ID_REGEX.CONTENT_PLATFORM_TARGET, 'Invalid Content Platform Target ID format (CPT-XXXXXX)'),
  contentId: z.string().regex(ID_REGEX.CONTENT, 'Invalid Content ID format (CNT-XXXXXX)'),
  platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
  enabled: z.boolean(),
  completed: z.boolean(),
  completedAt: isoDateString.nullable(),
  completedBy: z.string().regex(ID_REGEX.TEAM_MEMBER).nullable().optional(),
  source: z.enum(['DOWNLOAD', 'PUBLISH', 'MANUAL']).nullable().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const SetContentPlatformTargetInputSchema = z.object({
  platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
  enabled: z.boolean(),
});

export const CompletePlatformInputSchema = z.object({
  platformId: z.string().regex(ID_REGEX.PLATFORM, 'Invalid Platform ID format (PLT-XXXXXX)'),
  source: z.enum(['DOWNLOAD', 'PUBLISH', 'MANUAL']).default('DOWNLOAD'),
});

// ─── 8. Analytics Snapshot Schema ─────────────────────────────────────────────
export const AnalyticsSnapshotSchema = z.object({
  id: z.string().regex(ID_REGEX.ANALYTICS, 'Invalid Analytics ID format (ANL-XXXXXX)'),
  socialAccountId: z.string().regex(ID_REGEX.SOCIAL_ACCOUNT, 'Invalid SocialAccount reference'),
  contentId: z.string().regex(ID_REGEX.CONTENT).optional(),
  recordedAt: isoDateString,
  followers: z.number().int().nonnegative().optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  saves: z.number().int().nonnegative().optional(),
  engagementRate: z.number().min(0).max(100).optional(),
});

export const CreateAnalyticsSnapshotSchema = AnalyticsSnapshotSchema.omit({
  id: true,
});

// ─── 9. Notification Schema ───────────────────────────────────────────────────
export const NotificationTypeEnum = z.enum([
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'CONTENT_APPROVED',
  'CONTENT_REJECTED',
  'PUBLICATION_SUCCESS',
  'PUBLICATION_FAILED',
  'ACCOUNT_CONNECTION_ERROR',
  'SYSTEM_ERROR',
]);

export const NotificationSchema = z.object({
  id: z.string().regex(ID_REGEX.NOTIFICATION, 'Invalid Notification ID format (NTF-XXXXXX)'),
  userId: z.string().min(1, 'User ID is required'),
  type: NotificationTypeEnum,
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
  isRead: z.boolean().default(false),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z.string().max(100).optional(),
  createdAt: isoDateString,
});

export const CreateNotificationSchema = NotificationSchema.omit({
  id: true,
  createdAt: true,
});

// ─── 10. Activity Log Schema ──────────────────────────────────────────────────
export const ActivityActionEnum = z.enum([
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'ARCHIVE',
  'SCHEDULE',
  'PUBLISH_ATTEMPT',
  'PUBLISH_SUCCESS',
  'PUBLISH_FAILED',
  'SETTINGS_UPDATED',
  'ROLE_CHANGED',
  'ACCESS_DENIED',
  'TEAM_MEMBER_SUSPENDED',
  'TEAM_MEMBER_REACTIVATED',
  'PLATFORM_AUDIT_RUN',
  'DAILY_TARGET_CONFIGURED',
  'CONTENT_PLATFORM_TARGETED',
  'CONTENT_PLATFORM_UNTARGETED',
  'CONTENT_PLATFORM_COMPLETED',
]);

export const ActivityLogSchema = z.object({
  id: z.string().regex(ID_REGEX.ACTIVITY, 'Invalid Activity ID format (ACT-XXXXXX)'),
  userId: z.string().min(1, 'User ID is required'),
  action: ActivityActionEnum,
  entityType: z.string().min(1, 'Entity type is required').max(50),
  entityId: z.string().min(1, 'Entity ID is required').max(100),
  // NEVER allow passwords, tokens, API secrets, or private keys in metadata!
  metadata: z
    .record(z.string(), z.unknown())
    .refine((data) => {
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'privateKey', 'credential'];
      const keys = Object.keys(data);
      return !keys.some((k) =>
        sensitiveKeys.some((s) => k.toLowerCase().includes(s.toLowerCase()))
      );
    }, 'Activity metadata must never contain sensitive keys, passwords, or credentials')
    .optional(),
  createdAt: isoDateString,
});

export const CreateActivityLogSchema = ActivityLogSchema.omit({
  id: true,
  createdAt: true,
});

// ─── 11. Agency Settings Schema ───────────────────────────────────────────────
export const AgencySettingsSchema = z.object({
  agencyName: z.string().min(1, 'Agency name is required').max(100),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((val) => val === '' || val.startsWith('/') || /^https?:\/\//i.test(val), {
      message: 'Logo must be a valid http(s) URL or relative path (e.g. /logo.png)',
    })
    .optional()
    .or(z.literal('')),
  timezone: z.string().min(1, 'Timezone is required').default('Asia/Kolkata'),
  language: z.string().min(2).max(10).default('en'),
  dateFormat: z.string().min(1).default('YYYY-MM-DD'),
  updatedAt: isoDateString,
});
