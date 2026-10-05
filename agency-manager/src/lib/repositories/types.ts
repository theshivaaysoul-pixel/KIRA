// src/lib/repositories/types.ts
// Repository interfaces for KIRA Agency Manager (Phase 1).

import type {
  Platform,
  SocialAccount,
  Content,
  ContentAsset,
  ContentPublication,
  TeamMember,
  Task,
  TaskPriority,
  TaskStatus,
  AnalyticsSnapshot,
  Notification,
  ActivityLog,
  AgencySettings,
} from '@/lib/types/domain';

export interface IRepository<T extends { id: string }, TCreate, TUpdate> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  exists(id: string): Promise<boolean>;
}

export interface IPlatformRepository extends IRepository<Platform, Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<Platform, 'id' | 'createdAt' | 'updatedAt'>>> {
  findBySlug(slug: string): Promise<Platform | null>;
}

export interface ISocialAccountRepository extends IRepository<SocialAccount, Omit<SocialAccount, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<SocialAccount, 'id' | 'createdAt' | 'updatedAt'>>> {
  findByPlatform(platformId: string): Promise<SocialAccount[]>;
  findByUsername(platformId: string, username: string): Promise<SocialAccount | null>;
}

export interface IContentRepository extends IRepository<Content, Omit<Content, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>>> {
  findByStatus(status: Content['status']): Promise<Content[]>;
}

export interface IContentAssetRepository extends IRepository<ContentAsset, Omit<ContentAsset, 'id' | 'createdAt'>, Partial<Omit<ContentAsset, 'id' | 'createdAt'>>> {
  findByContentId(contentId: string): Promise<ContentAsset[]>;
}

export interface IContentPublicationRepository extends IRepository<ContentPublication, Omit<ContentPublication, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<ContentPublication, 'id' | 'createdAt' | 'updatedAt'>>> {
  findByContentId(contentId: string): Promise<ContentPublication[]>;
  findBySocialAccountId(accountId: string): Promise<ContentPublication[]>;
}

export interface ITeamMemberRepository extends IRepository<TeamMember, Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>>> {
  findByEmail(email: string): Promise<TeamMember | null>;
  findByAuthUid(authUid: string): Promise<TeamMember | null>;
  findByAuthIdentity(authUid: string, email?: string): Promise<TeamMember | null>;
  countActiveOwners(): Promise<number>;
}

export interface ITaskRepository extends IRepository<Task, Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>> {
  findByAssignee(userId: string): Promise<Task[]>;
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findByPriority(priority: TaskPriority): Promise<Task[]>;
  findByContent(contentId: string): Promise<Task[]>;
  findByAccount(accountId: string): Promise<Task[]>;
  findOverdue(): Promise<Task[]>;
  findDueSoon(hours?: number): Promise<Task[]>;
  search(query: string): Promise<Task[]>;
}

export interface IAnalyticsRepository extends IRepository<AnalyticsSnapshot, Omit<AnalyticsSnapshot, 'id'>, Partial<Omit<AnalyticsSnapshot, 'id'>>> {
  findBySocialAccount(accountId: string): Promise<AnalyticsSnapshot[]>;
}

export interface INotificationRepository extends IRepository<Notification, Omit<Notification, 'id' | 'createdAt'>, Partial<Omit<Notification, 'id' | 'createdAt'>>> {
  findUnreadByUser(userId: string): Promise<Notification[]>;
  markAsRead(id: string): Promise<boolean>;
}

export interface IActivityLogRepository {
  findAll(): Promise<ActivityLog[]>;
  findById(id: string): Promise<ActivityLog | null>;
  log(entry: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog>;
  findByUser(userId: string): Promise<ActivityLog[]>;
  count(): Promise<number>;
}

export interface IAgencySettingsRepository {
  getSettings(): Promise<AgencySettings>;
  updateSettings(data: Partial<AgencySettings>): Promise<AgencySettings>;
}
