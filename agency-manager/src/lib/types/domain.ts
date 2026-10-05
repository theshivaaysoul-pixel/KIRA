// src/lib/types/domain.ts
// Strict Domain Models for KIRA Agency Manager (Phase 1)
// Clean, mobile-ready, JSON-serializable TypeScript definitions.

// ─── ID Types & Prefixes ──────────────────────────────────────────────────────
export type PlatformId = string;         // Format: PLT-000001
export type SocialAccountId = string;     // Format: ACC-000001
export type ContentId = string;           // Format: CNT-000001
export type ContentAssetId = string;      // Format: AST-000001
export type PublicationId = string;       // Format: PUB-000001
export type TeamMemberId = string;        // Format: USR-000001
export type TaskId = string;              // Format: TSK-000001
export type DailyContentTargetId = string; // Format: DCT-000001
export type ContentPlatformTargetId = string; // Format: CPT-000001
export type AnalyticsSnapshotId = string; // Format: ANL-000001
export type NotificationId = string;      // Format: NTF-000001
export type ActivityLogId = string;       // Format: ACT-000001

export const ENTITY_PREFIXES = {
  PLATFORM: 'PLT',
  SOCIAL_ACCOUNT: 'ACC',
  CONTENT: 'CNT',
  CONTENT_ASSET: 'AST',
  CONTENT_PUBLICATION: 'PUB',
  TEAM_MEMBER: 'USR',
  TASK: 'TSK',
  DAILY_TARGET: 'DCT',
  CONTENT_PLATFORM_TARGET: 'CPT',
  ANALYTICS: 'ANL',
  NOTIFICATION: 'NTF',
  ACTIVITY: 'ACT',
} as const;

// ─── 1. Platform Model ────────────────────────────────────────────────────────
export const PLATFORM_CAPABILITIES = [
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
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

export interface Platform {
  id: PlatformId;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  isActive: boolean;
  capabilities: PlatformCapability[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PlatformWithStats extends Platform {
  accountCount: number;
}

export interface PlatformQueryResult {
  platforms: PlatformWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    active: number;
    inactive: number;
    totalAccounts: number;
    bin: number;
  };
}

export interface PlatformSeedResult {
  created: number;
  skipped: number;
  failed: number;
  platforms: Platform[];
}

// ─── 2. Social Account Model ──────────────────────────────────────────────────
export type SocialAccountStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED'
  | 'CONNECTION_ERROR';

export interface SocialAccount {
  id: SocialAccountId;
  platformId: PlatformId;
  accountName: string;
  username: string;
  profileUrl?: string;
  avatarUrl?: string;
  niche?: string;
  description?: string;
  status: SocialAccountStatus;
  assignedManagerId?: TeamMemberId;
  externalAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAccountWithRelations extends SocialAccount {
  platform: Platform | null;
  assignedManager: TeamMember | null;
  publicationCount: number;
  analyticsCount: number;
  taskCount: number;
}

export interface SocialAccountQueryResult {
  items: SocialAccountWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── 3. Content Model ─────────────────────────────────────────────────────────
export type ContentType =
  | 'POST'
  | 'REEL'
  | 'SHORT'
  | 'VIDEO'
  | 'IMAGE'
  | 'CAROUSEL'
  | 'STORY'
  | 'TEXT'
  | 'LIVE'
  | 'OTHER';

export type ContentStatus =
  | 'IDEA'
  | 'SCRIPT'
  | 'PRODUCTION'
  | 'EDITING'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export interface Content {
  id: ContentId;
  title: string;
  description?: string;
  contentType: ContentType;
  caption?: string;
  hashtags: string[];
  status: ContentStatus;
  targetPlatformIds?: PlatformId[];
  createdBy: TeamMemberId;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedFromStatus?: ContentStatus | null;
  deletedFromPlatformIds?: PlatformId[] | null;
}

export interface ContentWithRelations extends Content {
  creator: TeamMember | null;
  assets: ContentAsset[];
  publications: ContentPublication[];
  targetPlatforms?: Platform[];
  assetCount: number;
  publicationCount: number;
  taskCount: number;
}

export interface ContentQueryResult {
  items: ContentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts?: {
    active: number;
    archived: number;
    bin: number;
  };
}

// Allowed status transitions for the Content workflow engine
export const CONTENT_WORKFLOW_TRANSITIONS: Partial<Record<ContentStatus, ContentStatus[]>> = {
  IDEA:       ['SCRIPT', 'ARCHIVED'],
  SCRIPT:     ['PRODUCTION', 'IDEA', 'ARCHIVED'],
  PRODUCTION: ['EDITING', 'SCRIPT', 'ARCHIVED'],
  EDITING:    ['REVIEW', 'PRODUCTION', 'ARCHIVED'],
  REVIEW:     ['APPROVED', 'EDITING', 'ARCHIVED'],
  APPROVED:   ['SCHEDULED', 'REVIEW', 'ARCHIVED'],
  SCHEDULED:  ['APPROVED', 'ARCHIVED'],
  PUBLISHED:  ['ARCHIVED'],
  FAILED:     ['APPROVED', 'ARCHIVED'],
  ARCHIVED:   ['IDEA', 'APPROVED', 'PUBLISHED'],
};


// ─── 4. Content Asset Model ───────────────────────────────────────────────────
export type AssetType =
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'THUMBNAIL'
  | 'OTHER';

export interface ContentAsset {
  id: ContentAssetId;
  contentId: ContentId;
  type: AssetType;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  thumbnailPath?: string;
  createdAt: string;
}

// ─── 5. Content Publication Model ─────────────────────────────────────────────
export type PublicationStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

export interface ContentPublication {
  id: PublicationId;
  contentId: ContentId;
  socialAccountId: SocialAccountId;
  platformSpecificCaption?: string;
  platformSpecificTitle?: string;
  scheduledAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  status: PublicationStatus;
  externalPostId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 6. Team Member Model ─────────────────────────────────────────────────────
export type TeamRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'EDITOR'
  | 'DESIGNER'
  | 'ANALYST'
  | 'VIEWER'
  | 'MEMBER';

export type TeamMemberStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'INVITED'
  | 'SUSPENDED';

export interface TeamMember {
  id: TeamMemberId;
  authUid?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: TeamRole;
  status: TeamMemberStatus;
  customPermissions?: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── 7. Task Model ────────────────────────────────────────────────────────────
export type TaskPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  assignedTo?: TeamMemberId;
  relatedContentId?: ContentId;
  relatedAccountId?: SocialAccountId;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 8. Analytics Snapshot Model ──────────────────────────────────────────────
export interface AnalyticsSnapshot {
  id: AnalyticsSnapshotId;
  socialAccountId: SocialAccountId;
  contentId?: ContentId;
  recordedAt: string;
  followers?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  engagementRate?: number;
}

// ─── 9. Notification Model ────────────────────────────────────────────────────
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'CONTENT_APPROVED'
  | 'CONTENT_REJECTED'
  | 'PUBLICATION_SUCCESS'
  | 'PUBLICATION_FAILED'
  | 'ACCOUNT_CONNECTION_ERROR'
  | 'SYSTEM_ERROR';

export interface Notification {
  id: NotificationId;
  userId: TeamMemberId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
}

// ─── 10. Activity Log Model ───────────────────────────────────────────────────
export type ActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'SCHEDULE'
  | 'PUBLISH_ATTEMPT'
  | 'PUBLISH_SUCCESS'
  | 'PUBLISH_FAILED'
  | 'SETTINGS_UPDATED'
  | 'ROLE_CHANGED'
  | 'ACCESS_DENIED'
  | 'TEAM_MEMBER_SUSPENDED'
  | 'TEAM_MEMBER_REACTIVATED'
  | 'PLATFORM_AUDIT_RUN'
  | 'DAILY_TARGET_CONFIGURED'
  | 'CONTENT_PLATFORM_TARGETED'
  | 'CONTENT_PLATFORM_UNTARGETED'
  | 'CONTENT_PLATFORM_COMPLETED';

export interface ActivityLog {
  id: ActivityLogId;
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  // Metadata MUST NEVER store passwords, tokens, API secrets, or private keys.
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── 11. Agency Settings Model (Singleton) ───────────────────────────────────
export interface AgencySettings {
  agencyName: string;
  logoUrl?: string;
  timezone: string;
  language: string;
  dateFormat: string;
  updatedAt: string;
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  agencyName: 'KIRA Agency',
  logoUrl: '/logo.png',
  timezone: 'Asia/Kolkata',
  language: 'en',
  dateFormat: 'YYYY-MM-DD',
  updatedAt: new Date().toISOString(),
};

// ─── 11b. Daily Content Target Models ──────────────────────────────────────────
export interface PlatformTargetItem {
  platformId: PlatformId;
  targetCount: number;
  completedCount: number;
  completedContentIds?: string[];
}

export type PlatformTargetStatus = 'NOT_TARGETED' | 'IN_PROGRESS' | 'COMPLETE';

export interface DailyContentTarget {
  id: DailyContentTargetId;
  date: string; // ISO date "YYYY-MM-DD", unique per agency calendar date
  platformTargets: PlatformTargetItem[];
  createdBy: TeamMemberId;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTargetDetail {
  platform: Platform;
  targetCount: number;
  completedCount: number;
  remaining: number;
  status: PlatformTargetStatus;
  percentage: number;
  completedContentIds: string[];
}

export interface DailyContentTargetWithRelations extends DailyContentTarget {
  platforms: PlatformTargetDetail[];
  overallTarget: number;
  overallCompleted: number;
  overallRemaining: number;
  overallPercentage: number;
}

// ─── 11c. Content Platform Target Relationship ───────────────────────────────
export interface ContentPlatformTarget {
  id: ContentPlatformTargetId;
  contentId: ContentId;
  platformId: PlatformId;
  enabled: boolean;       // Targeted (ON / OFF)
  completed: boolean;     // Completed (✓)
  completedAt: string | null;
  completedBy?: TeamMemberId | null;
  source?: 'DOWNLOAD' | 'PUBLISH' | 'MANUAL' | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPlatformTargetWithPlatform extends ContentPlatformTarget {
  platform: Platform;
}

// ─── 12. Dashboard Overview Aggregations (Phase 4) ─────────────────────────────
export interface DashboardMetrics {
  activeAccounts: number;
  activeContent: number;
  scheduledPublications: number;
  pendingTasks: number;
  publishedContent: number;
  failedPublications: number;
  accountConnectionErrors: number;
  totalTeamMembers: number;
  dailyTargetsProgress?: {
    totalTarget: number;
    totalCompleted: number;
    totalRemaining: number;
    overallPercentage: number;
    hasTarget: boolean;
    date: string;
  } | null;
}

export interface DashboardRecentContentItem {
  id: ContentId;
  title: string;
  contentType: ContentType;
  status: ContentStatus;
  createdAt: string;
  creatorName: string;
  thumbnailUrl?: string;
  platformNames: string[];
}

export interface DashboardUpcomingPublicationItem {
  id: PublicationId;
  contentId: ContentId;
  contentTitle: string;
  socialAccountId: SocialAccountId;
  accountHandle: string;
  platformName: string;
  platformIcon?: string;
  scheduledAt: string;
  status: PublicationStatus;
}

export interface DashboardTaskItem {
  id: TaskId;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  isOverdue: boolean;
  assignedToName?: string;
  relatedContentTitle?: string;
}

export interface DashboardActivityItem {
  id: ActivityLogId;
  action: ActivityAction;
  label: string;
  entityType: string;
  entityId: string;
  userName: string;
  timestamp: string;
}

export interface DashboardAttentionItem {
  type: 'FAILED_PUBLICATION' | 'CONNECTION_ERROR';
  title: string;
  description: string;
  entityId: string;
  severity: 'WARNING' | 'ERROR';
}

export interface DashboardOverviewData {
  metrics: DashboardMetrics;
  attentionItems: DashboardAttentionItem[];
  recentContent: DashboardRecentContentItem[];
  upcomingPublications: DashboardUpcomingPublicationItem[];
  tasks: DashboardTaskItem[];
  recentActivity: DashboardActivityItem[];
  agencySettings: {
    agencyName: string;
    timezone: string;
    dateFormat: string;
    logoUrl?: string;
  };
}
