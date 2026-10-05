// src/lib/repositories/index.ts
// Central factory for all KIRA repositories.
// Wires up storage service and cross-repository relationship dependencies.

import { getStorageService } from '@/lib/storage';
import { PlatformRepository } from './platform-repository';
import { SocialAccountRepository } from './social-account-repository';
import { ContentRepository } from './content-repository';
import { ContentAssetRepository } from './content-asset-repository';
import { ContentPublicationRepository } from './content-publication-repository';
import { TeamMemberRepository } from './team-member-repository';
import { TaskRepository } from './task-repository';
import { DailyTargetRepository } from './daily-target-repository';
import { ContentPlatformTargetRepository } from './content-platform-target-repository';
import { AnalyticsRepository } from './analytics-repository';
import { NotificationRepository } from './notification-repository';
import { ActivityLogRepository } from './activity-log-repository';
import { AgencySettingsRepository } from './agency-settings-repository';

export * from './types';
export * from './base-json-repository';
export * from './platform-repository';
export * from './social-account-repository';
export * from './content-repository';
export * from './content-asset-repository';
export * from './content-publication-repository';
export * from './team-member-repository';
export * from './task-repository';
export * from './daily-target-repository';
export * from './content-platform-target-repository';
export * from './analytics-repository';
export * from './notification-repository';
export * from './activity-log-repository';
export * from './agency-settings-repository';

export interface Repositories {
  platforms: PlatformRepository;
  socialAccounts: SocialAccountRepository;
  content: ContentRepository;
  contentAssets: ContentAssetRepository;
  publications: ContentPublicationRepository;
  teamMembers: TeamMemberRepository;
  tasks: TaskRepository;
  dailyTargets: DailyTargetRepository;
  contentPlatformTargets: ContentPlatformTargetRepository;
  analytics: AnalyticsRepository;
  notifications: NotificationRepository;
  activityLogs: ActivityLogRepository;
  settings: AgencySettingsRepository;
}

let _repositories: Repositories | null = null;

export function getRepositories(): Repositories {
  if (_repositories) {
    return _repositories;
  }

  const storage = getStorageService();

  const platforms = new PlatformRepository(storage);
  const teamMembers = new TeamMemberRepository(storage);
  const socialAccounts = new SocialAccountRepository(storage, platforms, teamMembers);
  const content = new ContentRepository(storage);
  const contentAssets = new ContentAssetRepository(storage, content);
  const publications = new ContentPublicationRepository(storage, content, socialAccounts);
  const tasks = new TaskRepository(storage, teamMembers, content, socialAccounts);
  const dailyTargets = new DailyTargetRepository(storage);
  const contentPlatformTargets = new ContentPlatformTargetRepository(storage);
  const analytics = new AnalyticsRepository(storage, socialAccounts, content);
  const notifications = new NotificationRepository(storage);
  const activityLogs = new ActivityLogRepository(storage);
  const settings = new AgencySettingsRepository(storage);

  _repositories = {
    platforms,
    socialAccounts,
    content,
    contentAssets,
    publications,
    teamMembers,
    tasks,
    dailyTargets,
    contentPlatformTargets,
    analytics,
    notifications,
    activityLogs,
    settings,
  };

  return _repositories;
}

export function getDailyTargetRepository(): DailyTargetRepository {
  return getRepositories().dailyTargets;
}

export function getContentPlatformTargetRepository(): ContentPlatformTargetRepository {
  return getRepositories().contentPlatformTargets;
}

export function getActivityLogRepository(): ActivityLogRepository {
  return getRepositories().activityLogs;
}

export function getTeamMemberRepository(): TeamMemberRepository {
  return getRepositories().teamMembers;
}

export function getPlatformRepository(): PlatformRepository {
  return getRepositories().platforms;
}

export function getAgencySettingsRepository(): AgencySettingsRepository {
  return getRepositories().settings;
}

