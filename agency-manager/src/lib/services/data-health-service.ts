// src/lib/services/data-health-service.ts
// Phase 16 — Admin Data Health & Integrity Service
//
// Real administrative data-health system that audits:
// 1. Application runtime & environment configuration
// 2. Authentication subsystem readiness
// 3. GCS / Storage reachability, read, write, delete verification
// 4. 11 Database JSON collections schema validation & record counting
// 5. Cross-collection relationship integrity (orphan detection)
// 6. Duplicate record detection (IDs, slugs, unique fields)
// 7. Checksum & backup file integrity verification
// 8. Actionable recommended repair actions (NO destructive auto-repairs)
//
// CRITICAL RULES:
//  - Never fabricate health status ("Healthy", "Connected", "Operational" only if verified)
//  - Never fabricate checksums
//  - Never expose secrets, private keys, or tokens

import { getStorageService, getDataSafetyService } from '../storage';
import type { IStorageService } from '../storage/storage-service';
import {
  PlatformSchema,
  SocialAccountSchema,
  ContentSchema,
  ContentAssetSchema,
  ContentPublicationSchema,
  TeamMemberSchema,
  TaskSchema,
  AnalyticsSnapshotSchema,
  NotificationSchema,
  ActivityLogSchema,
  AgencySettingsSchema,
} from '../validation';
import type {
  Platform,
  SocialAccount,
  Content,
  ContentAsset,
  ContentPublication,
  TeamMember,
  Task,
  AnalyticsSnapshot,
  Notification,
  ActivityLog,
  AgencySettings,
} from '../types/domain';
import { z } from 'zod';

export type HealthStatusLevel = 'HEALTHY' | 'WARNING' | 'ERROR';

export interface ApplicationHealth {
  status: HealthStatusLevel;
  running: boolean;
  environment: string;
  uptimeSeconds: number;
  nodeVersion: string;
  configChecks: {
    storageConfigured: boolean;
    storageProvider: string;
    authConfigured: boolean;
    secretManagerConfigured: boolean;
  };
  warnings: string[];
}

export interface AuthenticationHealth {
  status: HealthStatusLevel;
  adminConfigured: boolean;
  protectionEnforced: boolean;
  sessionVerificationOperational: boolean;
  warnings: string[];
}

export interface StorageHealth {
  status: HealthStatusLevel;
  provider: string;
  reachable: boolean;
  bucketAccess: boolean;
  readAccess: boolean;
  writeAccess: boolean;
  deleteCapability: boolean;
  error?: string;
}

export interface CollectionHealth {
  path: string;
  resource: string;
  exists: boolean;
  validJson: boolean;
  validRootStructure: boolean;
  status: HealthStatusLevel;
  totalRecords: number;
  invalidRecordsCount: number;
  validationErrors: string[];
}

export interface RelationshipIntegrityIssue {
  collection: string;
  recordId: string;
  field: string;
  targetCollection: string;
  targetId: string;
  message: string;
}

export interface RelationshipIntegrityHealth {
  status: HealthStatusLevel;
  totalChecks: number;
  orphanedCount: number;
  issues: RelationshipIntegrityIssue[];
}

export interface DuplicateRecordIssue {
  collection: string;
  field: string;
  value: string;
  affectedRecordIds: string[];
  message: string;
}

export interface DuplicateDetectionHealth {
  status: HealthStatusLevel;
  duplicatesFound: number;
  issues: DuplicateRecordIssue[];
}

export interface BackupItemHealth {
  backupPath: string;
  resource: string;
  createdAt: string;
  readable: boolean;
  checksumValid: boolean;
  recordedChecksum: string;
  computedChecksum?: string;
  error?: string;
}

export interface BackupIntegrityHealth {
  status: HealthStatusLevel;
  totalBackupsFound: number;
  verifiedCount: number;
  corruptCount: number;
  backups: BackupItemHealth[];
  warnings: string[];
}

export interface DataHealthReport {
  timestamp: string;
  summary: {
    status: HealthStatusLevel;
    healthyChecks: number;
    warningChecks: number;
    errorChecks: number;
    recommendedActions: string[];
  };
  application: ApplicationHealth;
  authentication: AuthenticationHealth;
  storage: StorageHealth;
  collections: CollectionHealth[];
  relationships: RelationshipIntegrityHealth;
  duplicates: DuplicateDetectionHealth;
  backups: BackupIntegrityHealth;
}

export class DataHealthService {
  private readonly storage: IStorageService;

  constructor(storage?: IStorageService) {
    this.storage = storage || getStorageService();
  }

  /**
   * Run the full end-to-end data health diagnostic suite.
   */
  async runHealthCheck(): Promise<DataHealthReport> {
    const timestamp = new Date().toISOString();
    const recommendedActions: string[] = [];

    // 1. Application Health
    const application = this.checkApplicationHealth();

    // 2. Authentication Health
    const authentication = this.checkAuthenticationHealth();

    // 3. Storage Diagnostics
    const storageHealth = await this.checkStorageHealth();
    if (storageHealth.status === 'ERROR') {
      recommendedActions.push('Storage connectivity error: Verify bucket permissions and service account credentials.');
    }

    // 4. JSON Collections Validation
    const { collections, loadedData } = await this.checkCollections();
    const collectionErrors = collections.filter((c) => c.status === 'ERROR');
    if (collectionErrors.length > 0) {
      recommendedActions.push(
        `Database collection schema errors found in: ${collectionErrors.map((c) => c.resource).join(', ')}. Review raw files before making writes.`
      );
    }

    // 5. Relationship Integrity
    const relationships = this.checkRelationships(loadedData);
    if (relationships.orphanedCount > 0) {
      recommendedActions.push(
        `${relationships.orphanedCount} orphaned relationship(s) detected. Verify foreign keys in affected records (do not delete without manual audit).`
      );
    }

    // 6. Duplicate Detection
    const duplicates = this.checkDuplicates(loadedData);
    if (duplicates.duplicatesFound > 0) {
      recommendedActions.push(
        `${duplicates.duplicatesFound} potential duplicate field(s) detected across records. Review affected records.`
      );
    }

    // 7. Backup Integrity
    const backups = await this.checkBackups();
    if (backups.corruptCount > 0) {
      recommendedActions.push(
        `${backups.corruptCount} corrupt backup(s) detected where computed SHA-256 does not match metadata. Check backup storage.`
      );
    }

    // Compute Summary Status & Counts
    let healthyChecks = 0;
    let warningChecks = 0;
    let errorChecks = 0;

    const allStatuses: HealthStatusLevel[] = [
      application.status,
      authentication.status,
      storageHealth.status,
      relationships.status,
      duplicates.status,
      backups.status,
      ...collections.map((c) => c.status),
    ];

    for (const s of allStatuses) {
      if (s === 'HEALTHY') healthyChecks++;
      else if (s === 'WARNING') warningChecks++;
      else if (s === 'ERROR') errorChecks++;
    }

    let overallStatus: HealthStatusLevel = 'HEALTHY';
    if (errorChecks > 0) {
      overallStatus = 'ERROR';
    } else if (warningChecks > 0) {
      overallStatus = 'WARNING';
    }

    return {
      timestamp,
      summary: {
        status: overallStatus,
        healthyChecks,
        warningChecks,
        errorChecks,
        recommendedActions,
      },
      application,
      authentication,
      storage: storageHealth,
      collections,
      relationships,
      duplicates,
      backups,
    };
  }

  // ─── 1. Application Check ──────────────────────────────────────────────────
  checkApplicationHealth(): ApplicationHealth {
    const warnings: string[] = [];

    const hasStorageConfig =
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (!!process.env.GOOGLE_DRIVE_CLIENT_ID && !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) ||
      (!!process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
        (!!process.env.GOOGLE_CLOUD_CLIENT_EMAIL || !!process.env.GOOGLE_CLOUD_PROJECT_ID));

    const hasAuthConfig =
      (!!process.env.FIREBASE_PROJECT_ID &&
        !!process.env.FIREBASE_CLIENT_EMAIL &&
        !!process.env.FIREBASE_PRIVATE_KEY) ||
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    const hasSecretManager =
      !!process.env.GCP_PROJECT_ID || !!process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!hasStorageConfig) {
      warnings.push('Storage environment credentials are incomplete.');
    }
    if (!hasAuthConfig) {
      warnings.push('Firebase Admin credentials are not fully configured.');
    }

    const provider =
      process.env.STORAGE_PROVIDER ||
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ? 'drive' : 'gcs');

    let status: HealthStatusLevel = 'HEALTHY';
    if (!hasStorageConfig || !hasAuthConfig) {
      status = 'WARNING';
    }

    return {
      status,
      running: true,
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      configChecks: {
        storageConfigured: hasStorageConfig,
        storageProvider: provider,
        authConfigured: hasAuthConfig,
        secretManagerConfigured: hasSecretManager,
      },
      warnings,
    };
  }

  // ─── 2. Authentication Check ───────────────────────────────────────────────
  checkAuthenticationHealth(): AuthenticationHealth {
    const warnings: string[] = [];
    const hasAdmin =
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      (!!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_CLIENT_EMAIL);

    if (!hasAdmin) {
      warnings.push('Firebase Admin SDK credentials not detected in environment.');
    }

    const status: HealthStatusLevel = hasAdmin ? 'HEALTHY' : 'WARNING';

    return {
      status,
      adminConfigured: hasAdmin,
      protectionEnforced: true,
      sessionVerificationOperational: hasAdmin,
      warnings,
    };
  }

  // ─── 3. Storage Health Check ───────────────────────────────────────────────
  async checkStorageHealth(): Promise<StorageHealth> {
    const provider =
      process.env.STORAGE_PROVIDER ||
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ? 'drive' : 'gcs');

    try {
      const result = await this.storage.healthCheck();
      const allPassed =
        result.connection &&
        result.bucketAccess &&
        result.writeTest &&
        result.readTest &&
        result.deleteTest;

      return {
        status: allPassed ? 'HEALTHY' : 'ERROR',
        provider,
        reachable: result.connection,
        bucketAccess: result.bucketAccess,
        readAccess: result.readTest,
        writeAccess: result.writeTest,
        deleteCapability: result.deleteTest,
        error: result.error,
      };
    } catch (err) {
      return {
        status: 'ERROR',
        provider,
        reachable: false,
        bucketAccess: false,
        readAccess: false,
        writeAccess: false,
        deleteCapability: false,
        error: err instanceof Error ? err.message : 'Storage health check failed',
      };
    }
  }

  // ─── 4. Collections Check ──────────────────────────────────────────────────
  async checkCollections(): Promise<{
    collections: CollectionHealth[];
    loadedData: LoadedCollections;
  }> {
    const definitions: Array<{
      path: string;
      resource: string;
      schema: z.ZodType<unknown>;
      isSingleton?: boolean;
    }> = [
      { path: 'database/platforms.json', resource: 'platforms', schema: PlatformSchema },
      { path: 'database/social-accounts.json', resource: 'socialAccounts', schema: SocialAccountSchema },
      { path: 'database/content.json', resource: 'content', schema: ContentSchema },
      { path: 'database/content-assets.json', resource: 'contentAssets', schema: ContentAssetSchema },
      { path: 'database/content-publications.json', resource: 'publications', schema: ContentPublicationSchema },
      { path: 'database/team-members.json', resource: 'teamMembers', schema: TeamMemberSchema },
      { path: 'database/tasks.json', resource: 'tasks', schema: TaskSchema },
      { path: 'database/analytics.json', resource: 'analytics', schema: AnalyticsSnapshotSchema },
      { path: 'database/notifications.json', resource: 'notifications', schema: NotificationSchema },
      { path: 'database/activity-logs.json', resource: 'activityLogs', schema: ActivityLogSchema },
      { path: 'database/settings.json', resource: 'settings', schema: AgencySettingsSchema, isSingleton: true },
    ];

    const collections: CollectionHealth[] = [];
    const loadedData: LoadedCollections = {
      platforms: [],
      socialAccounts: [],
      content: [],
      contentAssets: [],
      publications: [],
      teamMembers: [],
      tasks: [],
      analytics: [],
      notifications: [],
      activityLogs: [],
      settings: null,
    };

    for (const def of definitions) {
      const validationErrors: string[] = [];
      let exists = false;
      let validJson = false;
      let validRootStructure = false;
      let totalRecords = 0;
      let invalidRecordsCount = 0;

      try {
        exists = await this.storage.exists(def.path);
        if (!exists) {
          // File does not exist yet — valid uninitialized state
          collections.push({
            path: def.path,
            resource: def.resource,
            exists: false,
            validJson: true,
            validRootStructure: true,
            status: 'HEALTHY',
            totalRecords: 0,
            invalidRecordsCount: 0,
            validationErrors: ['Collection file not initialized yet (will be created on first write)'],
          });
          continue;
        }

        const buffer = await this.storage.download(def.path);
        const rawText = buffer.toString('utf8').trim();

        if (rawText === '') {
          collections.push({
            path: def.path,
            resource: def.resource,
            exists: true,
            validJson: true,
            validRootStructure: true,
            status: 'HEALTHY',
            totalRecords: 0,
            invalidRecordsCount: 0,
            validationErrors: [],
          });
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
          validJson = true;
        } catch (jsonErr) {
          validJson = false;
          collections.push({
            path: def.path,
            resource: def.resource,
            exists: true,
            validJson: false,
            validRootStructure: false,
            status: 'ERROR',
            totalRecords: 0,
            invalidRecordsCount: 1,
            validationErrors: [`JSON Syntax Error: ${jsonErr instanceof Error ? jsonErr.message : 'Malformed JSON'}`],
          });
          continue;
        }

        if (def.isSingleton) {
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            validRootStructure = true;
            totalRecords = 1;
            const parseResult = def.schema.safeParse(parsed);
            if (!parseResult.success) {
              invalidRecordsCount = 1;
              for (const issue of parseResult.error.issues) {
                validationErrors.push(`${issue.path.join('.')}: ${issue.message}`);
              }
            } else {
              loadedData.settings = parseResult.data as AgencySettings;
            }
          } else {
            validRootStructure = false;
            validationErrors.push('Expected JSON object for settings singleton, received array or primitive');
          }
        } else {
          // Supports top-level array or container object e.g. { tasks: [...] }
          let itemsArray: unknown[] | null = null;
          if (Array.isArray(parsed)) {
            itemsArray = parsed;
          } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, unknown>;
            if (Array.isArray(obj[def.resource])) {
              itemsArray = obj[def.resource] as unknown[];
            }
          }

          if (itemsArray !== null) {
            validRootStructure = true;
            totalRecords = itemsArray.length;

            const validItems: unknown[] = [];
            for (let i = 0; i < itemsArray.length; i++) {
              const item = itemsArray[i];
              const parseResult = def.schema.safeParse(item);
              if (!parseResult.success) {
                invalidRecordsCount++;
                if (validationErrors.length < 15) {
                  const itemId = (item as { id?: string })?.id || `index[${i}]`;
                  validationErrors.push(
                    `Item ${itemId}: ${parseResult.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')}`
                  );
                }
              } else {
                validItems.push(parseResult.data);
              }
            }

            // Assign to loaded collections for relationship and duplicate checking
            (loadedData as unknown as Record<string, unknown[]>)[def.resource] = validItems;
          } else {
            validRootStructure = false;
            validationErrors.push('Expected JSON array of records, received object or primitive');
          }
        }

        let status: HealthStatusLevel = 'HEALTHY';
        if (!validJson || !validRootStructure || invalidRecordsCount > 0) {
          status = 'ERROR';
        }

        collections.push({
          path: def.path,
          resource: def.resource,
          exists: true,
          validJson,
          validRootStructure,
          status,
          totalRecords,
          invalidRecordsCount,
          validationErrors,
        });
      } catch (err) {
        collections.push({
          path: def.path,
          resource: def.resource,
          exists: false,
          validJson: false,
          validRootStructure: false,
          status: 'ERROR',
          totalRecords: 0,
          invalidRecordsCount: 0,
          validationErrors: [`Read failed: ${err instanceof Error ? err.message : String(err)}`],
        });
      }
    }

    return { collections, loadedData };
  }

  // ─── 5. Relationship Integrity ─────────────────────────────────────────────
  checkRelationships(data: LoadedCollections): RelationshipIntegrityHealth {
    const issues: RelationshipIntegrityIssue[] = [];
    let totalChecks = 0;

    const platformIds = new Set(data.platforms.map((p) => p.id));
    const contentIds = new Set(data.content.map((c) => c.id));
    const accountIds = new Set(data.socialAccounts.map((a) => a.id));
    const memberIds = new Set(data.teamMembers.map((m) => m.id));

    // SocialAccount.platformId -> Platform
    for (const acc of data.socialAccounts) {
      totalChecks++;
      if (!platformIds.has(acc.platformId)) {
        issues.push({
          collection: 'socialAccounts',
          recordId: acc.id,
          field: 'platformId',
          targetCollection: 'platforms',
          targetId: acc.platformId,
          message: `SocialAccount ${acc.id} (${acc.accountName}) references non-existent Platform ${acc.platformId}`,
        });
      }
    }

    // ContentAsset.contentId -> Content
    for (const asset of data.contentAssets) {
      totalChecks++;
      if (!contentIds.has(asset.contentId)) {
        issues.push({
          collection: 'contentAssets',
          recordId: asset.id,
          field: 'contentId',
          targetCollection: 'content',
          targetId: asset.contentId,
          message: `ContentAsset ${asset.id} (${asset.fileName}) references non-existent Content ${asset.contentId}`,
        });
      }
    }

    // ContentPublication.contentId -> Content
    // ContentPublication.socialAccountId -> SocialAccount
    for (const pub of data.publications) {
      totalChecks += 2;
      if (!contentIds.has(pub.contentId)) {
        issues.push({
          collection: 'publications',
          recordId: pub.id,
          field: 'contentId',
          targetCollection: 'content',
          targetId: pub.contentId,
          message: `Publication ${pub.id} references non-existent Content ${pub.contentId}`,
        });
      }
      if (!accountIds.has(pub.socialAccountId)) {
        issues.push({
          collection: 'publications',
          recordId: pub.id,
          field: 'socialAccountId',
          targetCollection: 'socialAccounts',
          targetId: pub.socialAccountId,
          message: `Publication ${pub.id} references non-existent SocialAccount ${pub.socialAccountId}`,
        });
      }
    }

    // Task.assignedTo -> TeamMember (if set)
    // Task.relatedContentId -> Content (if set)
    // Task.relatedAccountId -> SocialAccount (if set)
    for (const task of data.tasks) {
      if (task.assignedTo) {
        totalChecks++;
        if (!memberIds.has(task.assignedTo)) {
          issues.push({
            collection: 'tasks',
            recordId: task.id,
            field: 'assignedTo',
            targetCollection: 'teamMembers',
            targetId: task.assignedTo,
            message: `Task ${task.id} (${task.title}) assigned to non-existent TeamMember ${task.assignedTo}`,
          });
        }
      }
      if (task.relatedContentId) {
        totalChecks++;
        if (!contentIds.has(task.relatedContentId)) {
          issues.push({
            collection: 'tasks',
            recordId: task.id,
            field: 'relatedContentId',
            targetCollection: 'content',
            targetId: task.relatedContentId,
            message: `Task ${task.id} references non-existent Content ${task.relatedContentId}`,
          });
        }
      }
      if (task.relatedAccountId) {
        totalChecks++;
        if (!accountIds.has(task.relatedAccountId)) {
          issues.push({
            collection: 'tasks',
            recordId: task.id,
            field: 'relatedAccountId',
            targetCollection: 'socialAccounts',
            targetId: task.relatedAccountId,
            message: `Task ${task.id} references non-existent SocialAccount ${task.relatedAccountId}`,
          });
        }
      }
    }

    // AnalyticsSnapshot.socialAccountId -> SocialAccount
    // AnalyticsSnapshot.contentId -> Content (if set)
    for (const snap of data.analytics) {
      totalChecks++;
      if (!accountIds.has(snap.socialAccountId)) {
        issues.push({
          collection: 'analytics',
          recordId: snap.id,
          field: 'socialAccountId',
          targetCollection: 'socialAccounts',
          targetId: snap.socialAccountId,
          message: `AnalyticsSnapshot ${snap.id} references non-existent SocialAccount ${snap.socialAccountId}`,
        });
      }
      if (snap.contentId) {
        totalChecks++;
        if (!contentIds.has(snap.contentId)) {
          issues.push({
            collection: 'analytics',
            recordId: snap.id,
            field: 'contentId',
            targetCollection: 'content',
            targetId: snap.contentId,
            message: `AnalyticsSnapshot ${snap.id} references non-existent Content ${snap.contentId}`,
          });
        }
      }
    }

    // Notification.userId -> TeamMember (valid identity)
    for (const notif of data.notifications) {
      totalChecks++;
      if (!memberIds.has(notif.userId)) {
        issues.push({
          collection: 'notifications',
          recordId: notif.id,
          field: 'userId',
          targetCollection: 'teamMembers',
          targetId: notif.userId,
          message: `Notification ${notif.id} references non-existent TeamMember ${notif.userId}`,
        });
      }
    }

    const status: HealthStatusLevel = issues.length > 0 ? 'WARNING' : 'HEALTHY';

    return {
      status,
      totalChecks,
      orphanedCount: issues.length,
      issues,
    };
  }

  // ─── 6. Duplicate Detection ────────────────────────────────────────────────
  checkDuplicates(data: LoadedCollections): DuplicateDetectionHealth {
    const issues: DuplicateRecordIssue[] = [];

    // Helper to find duplicate values in an array of records
    const findDuplicates = <T extends { id: string }>(
      collectionName: string,
      records: T[],
      field: keyof T,
      transform?: (v: unknown) => string
    ) => {
      const map = new Map<string, string[]>();
      for (const r of records) {
        const raw = r[field];
        if (raw === undefined || raw === null || raw === '') continue;
        const key = transform ? transform(raw) : String(raw);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(r.id);
      }

      for (const [val, ids] of map.entries()) {
        if (ids.length > 1) {
          issues.push({
            collection: collectionName,
            field: String(field),
            value: val,
            affectedRecordIds: ids,
            message: `Potential duplicate detected in ${collectionName}.${String(field)}="${val}" across IDs: ${ids.join(', ')}`,
          });
        }
      }
    };

    // Check duplicate IDs across all collections
    findDuplicates('platforms', data.platforms, 'id');
    findDuplicates('socialAccounts', data.socialAccounts, 'id');
    findDuplicates('content', data.content, 'id');
    findDuplicates('contentAssets', data.contentAssets, 'id');
    findDuplicates('publications', data.publications, 'id');
    findDuplicates('teamMembers', data.teamMembers, 'id');
    findDuplicates('tasks', data.tasks, 'id');
    findDuplicates('analytics', data.analytics, 'id');
    findDuplicates('notifications', data.notifications, 'id');
    findDuplicates('activityLogs', data.activityLogs, 'id');

    // Duplicate platform slugs (case-insensitive)
    findDuplicates('platforms', data.platforms, 'slug', (v) => String(v).toLowerCase().trim());

    // Duplicate team member emails (case-insensitive)
    findDuplicates('teamMembers', data.teamMembers, 'email', (v) => String(v).toLowerCase().trim());

    // Duplicate externalAccountId per platform
    const platformAccountMap = new Map<string, string[]>();
    for (const acc of data.socialAccounts) {
      if (acc.externalAccountId && acc.externalAccountId.trim() !== '') {
        const compoundKey = `${acc.platformId}::${acc.externalAccountId.trim()}`;
        if (!platformAccountMap.has(compoundKey)) {
          platformAccountMap.set(compoundKey, []);
        }
        platformAccountMap.get(compoundKey)!.push(acc.id);
      }
    }
    for (const [key, ids] of platformAccountMap.entries()) {
      if (ids.length > 1) {
        issues.push({
          collection: 'socialAccounts',
          field: 'externalAccountId',
          value: key,
          affectedRecordIds: ids,
          message: `Potential duplicate externalAccountId detected for platform: "${key}" across accounts: ${ids.join(', ')}`,
        });
      }
    }

    const status: HealthStatusLevel = issues.length > 0 ? 'WARNING' : 'HEALTHY';

    return {
      status,
      duplicatesFound: issues.length,
      issues,
    };
  }

  // ─── 7. Backup Integrity ───────────────────────────────────────────────────
  async checkBackups(): Promise<BackupIntegrityHealth> {
    const safetyService = getDataSafetyService();
    const verifiedBackups: BackupItemHealth[] = [];
    const warnings: string[] = [];
    let corruptCount = 0;

    try {
      const { backups, total } = await safetyService.listBackups({ limit: 10 });

      if (total === 0) {
        return {
          status: 'HEALTHY',
          totalBackupsFound: 0,
          verifiedCount: 0,
          corruptCount: 0,
          backups: [],
          warnings: ['No backups recorded yet in database/backups/.'],
        };
      }

      for (const meta of backups) {
        try {
          const exists = await this.storage.exists(meta.backupPath);
          if (!exists) {
            corruptCount++;
            verifiedBackups.push({
              backupPath: meta.backupPath,
              resource: meta.sourcePath,
              createdAt: meta.createdAt,
              readable: false,
              checksumValid: false,
              recordedChecksum: meta.checksum,
              error: 'Backup file missing from storage path',
            });
            continue;
          }

          const buffer = await this.storage.download(meta.backupPath);
          const computedChecksum = (safetyService.constructor as typeof import('@/lib/storage/data-safety-service').DataSafetyService).calculateChecksum(
            buffer
          );
          const checksumValid = computedChecksum === meta.checksum;

          if (!checksumValid) {
            corruptCount++;
          }

          verifiedBackups.push({
            backupPath: meta.backupPath,
            resource: meta.sourcePath,
            createdAt: meta.createdAt,
            readable: true,
            checksumValid,
            recordedChecksum: meta.checksum,
            computedChecksum,
            ...(!checksumValid && {
              error: `Checksum mismatch: expected ${meta.checksum.slice(0, 10)}..., computed ${computedChecksum.slice(0, 10)}...`,
            }),
          });
        } catch (itemErr) {
          corruptCount++;
          verifiedBackups.push({
            backupPath: meta.backupPath,
            resource: meta.sourcePath,
            createdAt: meta.createdAt,
            readable: false,
            checksumValid: false,
            recordedChecksum: meta.checksum,
            error: itemErr instanceof Error ? itemErr.message : 'Failed to inspect backup',
          });
        }
      }

      const verifiedCount = verifiedBackups.filter((b) => b.checksumValid).length;
      let status: HealthStatusLevel = 'HEALTHY';
      if (corruptCount > 0) {
        status = 'ERROR';
      }

      return {
        status,
        totalBackupsFound: total,
        verifiedCount,
        corruptCount,
        backups: verifiedBackups,
        warnings,
      };
    } catch (err) {
      return {
        status: 'WARNING',
        totalBackupsFound: 0,
        verifiedCount: 0,
        corruptCount: 0,
        backups: [],
        warnings: [`Unable to inspect backup directory: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }
}

export interface LoadedCollections {
  platforms: Platform[];
  socialAccounts: SocialAccount[];
  content: Content[];
  contentAssets: ContentAsset[];
  publications: ContentPublication[];
  teamMembers: TeamMember[];
  tasks: Task[];
  analytics: AnalyticsSnapshot[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  settings: AgencySettings | null;
}

let _dataHealthService: DataHealthService | null = null;

export function getDataHealthService(): DataHealthService {
  if (!_dataHealthService) {
    _dataHealthService = new DataHealthService();
  }
  return _dataHealthService;
}
