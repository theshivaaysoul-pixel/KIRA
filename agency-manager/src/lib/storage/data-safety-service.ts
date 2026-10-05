// src/lib/storage/data-safety-service.ts
// Core GCS/Drive Data Safety Service for KIRA Agency Manager.
// Provides safe reads, safe write pipelines with read-back verification,
// deterministic SHA-256 checksums, automated versioned backups,
// corruption detection, path traversal protection, concurrency checks, and recovery.

import crypto from 'crypto';
import { z } from 'zod';
import type { IStorageService } from './storage-service';
import {
  StorageReadError,
  StorageWriteError,
  StorageCorruptionError,
  StorageVerificationError,
  BackupError,
  RecoveryError,
  ConcurrentModificationError,
  InvalidBackupPathError,
} from './errors';
import {
  type BackupMetadata,
  type BackupReason,
  type DatabaseResourceName,
  BackupMetadataSchema,
  DATABASE_RESOURCES,
  ALLOWED_RESOURCE_NAMES,
  getResourceSchema,
} from './backup-types';

export interface SafeReadResult<T> {
  data: T;
  checksum: string;
  rawText: string;
  isNew?: boolean;
}

export interface SafeWriteResult {
  checksum: string;
  backup?: BackupMetadata;
}

export interface ListBackupsOptions {
  resource?: string;
  reason?: BackupReason;
  limit?: number;
  offset?: number;
}

export class DataSafetyService {
  private readonly storage: IStorageService;

  constructor(storage: IStorageService) {
    this.storage = storage;
  }

  /**
   * Deterministic JSON stringifier.
   * Recursively sorts object keys so identical objects always produce identical JSON and SHA-256 hashes.
   */
  static stableStringify(value: unknown): string {
    const normalize = (input: unknown): unknown => {
      if (input === null || typeof input !== 'object') {
        return input;
      }
      if (Array.isArray(input)) {
        return input.map(normalize);
      }
      const obj = input as Record<string, unknown>;
      const sortedKeys = Object.keys(obj).sort();
      const result: Record<string, unknown> = {};
      for (const key of sortedKeys) {
        if (obj[key] !== undefined) {
          result[key] = normalize(obj[key]);
        }
      }
      return result;
    };

    return JSON.stringify(normalize(value), null, 2);
  }

  /**
   * Compute a standard SHA-256 hex checksum.
   */
  static calculateChecksum(input: unknown): string {
    let buffer: Buffer;
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      buffer = Buffer.from(input, 'utf8');
    } else {
      buffer = Buffer.from(DataSafetyService.stableStringify(input), 'utf8');
    }
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Safe read pipeline.
   * Reads from storage, detects malformed JSON / corruption, validates against schema,
   * and computes SHA-256 integrity checksum.
   * NEVER silently overwrites malformed files with empty data.
   */
  async safeReadJson<T>(
    storagePath: string,
    schema: z.ZodType<T>,
    defaultValue?: T
  ): Promise<SafeReadResult<T>> {
    const exists = await this.storage.exists(storagePath);
    if (!exists) {
      if (defaultValue !== undefined) {
        const text = DataSafetyService.stableStringify(defaultValue);
        return {
          data: defaultValue,
          checksum: DataSafetyService.calculateChecksum(text),
          rawText: text,
          isNew: true,
        };
      }
      throw new StorageReadError(storagePath, `Storage file does not exist: ${storagePath}`);
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(storagePath);
    } catch (err) {
      throw new StorageReadError(storagePath, `Failed to download file from storage: ${storagePath}`, err);
    }

    const text = buffer.toString('utf8').trim();
    if (!text) {
      if (defaultValue !== undefined) {
        return {
          data: defaultValue,
          checksum: DataSafetyService.calculateChecksum(buffer),
          rawText: '',
          isNew: true,
        };
      }
      throw new StorageCorruptionError(storagePath, `Storage file is empty at ${storagePath}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error(`[DataSafetyService] Data corruption detected in ${storagePath}:`, err);
      throw new StorageCorruptionError(
        storagePath,
        `Data corruption detected in ${storagePath}: File content is not valid JSON. Live file preserved for inspection.`,
        err
      );
    }

    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      console.error(`[DataSafetyService] Schema validation violation in ${storagePath}:`, validation.error.issues);
      throw new StorageCorruptionError(
        storagePath,
        `Data integrity violation in ${storagePath}: Content does not match expected schema.`,
        validation.error
      );
    }

    return {
      data: validation.data,
      checksum: DataSafetyService.calculateChecksum(buffer),
      rawText: text,
      isNew: false,
    };
  }

  /**
   * Safe write pipeline.
   * Follows the strict 11-step sequence:
   * 1. Validate data in-memory
   * 2. Concurrency check (if expectedChecksum provided)
   * 3. Pre-write backup creation
   * 4. Stable JSON serialization
   * 5. SHA-256 calculation
   * 6. Storage upload
   * 7. Read back from storage
   * 8. Verify read-back JSON
   * 9. Verify read-back schema
   * 10. Verify read-back checksum
   * 11. Return verified result
   */
  async safeWriteJson<T>(params: {
    storagePath: string;
    data: T;
    schema: z.ZodType<T>;
    reason?: BackupReason;
    createBackupBeforeWrite?: boolean;
    expectedChecksum?: string;
  }): Promise<SafeWriteResult> {
    const { storagePath, data, schema, reason = 'BEFORE_UPDATE', createBackupBeforeWrite = true, expectedChecksum } = params;

    // 1. In-memory validation
    const validation = schema.safeParse(data);
    if (!validation.success) {
      throw new StorageWriteError(
        storagePath,
        `Validation failed before write to ${storagePath}`,
        validation.error
      );
    }

    // 2. Concurrency / overwrite check
    const exists = await this.storage.exists(storagePath);
    if (expectedChecksum && exists) {
      const currentBuffer = await this.storage.download(storagePath);
      const currentChecksum = DataSafetyService.calculateChecksum(currentBuffer);
      if (currentChecksum !== expectedChecksum) {
        throw new ConcurrentModificationError(
          storagePath,
          `Concurrent modification detected on ${storagePath}. The document was modified by another process (checksum mismatch).`
        );
      }
    }

    // 3. Pre-write backup
    let backup: BackupMetadata | undefined = undefined;
    if (createBackupBeforeWrite && exists) {
      try {
        const created = await this.createBackup(storagePath, reason);
        if (created) backup = created;
      } catch (err) {
        console.warn(`[DataSafetyService] Warning: Pre-write backup failed for ${storagePath}:`, err);
        // Do not abort if it was an empty file, but log
      }
    }

    // 4. Stable serialization
    const serialized = DataSafetyService.stableStringify(validation.data);
    const buffer = Buffer.from(serialized, 'utf8');

    // 5. Expected checksum
    const computedChecksum = DataSafetyService.calculateChecksum(buffer);

    // 6. Write to storage
    const recordCount = Array.isArray(validation.data)
      ? String(validation.data.length)
      : '1';

    try {
      await this.storage.upload({
        objectName: storagePath,
        buffer,
        contentType: 'application/json',
        metadata: {
          checksum: computedChecksum,
          recordCount,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      throw new StorageWriteError(storagePath, `Failed writing to storage at ${storagePath}`, err);
    }

    // 7. READ BACK THE SAVED DOCUMENT
    let readBackBuffer: Buffer;
    try {
      readBackBuffer = await this.storage.download(storagePath);
    } catch (err) {
      throw new StorageVerificationError(
        storagePath,
        `Write verification failed: Unable to read back saved document at ${storagePath}`,
        err
      );
    }

    // 8. Parse read-back JSON
    let readBackParsed: unknown;
    try {
      readBackParsed = JSON.parse(readBackBuffer.toString('utf8'));
    } catch (err) {
      throw new StorageVerificationError(
        storagePath,
        `Write verification failed: Read-back document from ${storagePath} is malformed JSON`,
        err
      );
    }

    // 9. Validate read-back schema
    const readBackValidation = schema.safeParse(readBackParsed);
    if (!readBackValidation.success) {
      throw new StorageVerificationError(
        storagePath,
        `Write verification failed: Read-back document from ${storagePath} failed schema validation`,
        readBackValidation.error
      );
    }

    // 10. Verify checksum
    const readBackChecksum = DataSafetyService.calculateChecksum(readBackBuffer);
    if (readBackChecksum !== computedChecksum) {
      throw new StorageVerificationError(
        storagePath,
        `Write verification failed: Checksum mismatch. Expected ${computedChecksum}, got ${readBackChecksum}`
      );
    }

    return { checksum: computedChecksum, backup };
  }

  /**
   * Create a versioned backup of a live storage file in GCS / Drive.
   * Path: database/backups/<resource>/<resource>-<timestamp>.json
   * Companion metadata: database/backups/<resource>/<resource>-<timestamp>.meta.json
   */
  async createBackup(sourcePath: string, reason: BackupReason): Promise<BackupMetadata | null> {
    const exists = await this.storage.exists(sourcePath);
    if (!exists) return null;

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(sourcePath);
    } catch (err) {
      throw new BackupError(sourcePath, `Failed to download live file for backup: ${sourcePath}`, err);
    }

    if (buffer.length === 0) return null;

    // Check valid JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      throw new StorageCorruptionError(
        sourcePath,
        `Cannot backup corrupted live file ${sourcePath}. Preserve for diagnosis.`,
        err
      );
    }

    // Derive resource folder name from path (e.g. database/platforms.json -> platforms)
    const fileName = sourcePath.split('/').pop() || sourcePath;
    const resource = fileName.replace(/\.json$/, '');

    // Timestamp formatting: YYYY-MM-DDTHHmmssZ safe for storage paths
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    const backupFileName = `${resource}-${timestamp}.json`;
    const backupPath = `database/backups/${resource}/${backupFileName}`;
    const metaPath = `database/backups/${resource}/${resource}-${timestamp}.meta.json`;

    const checksum = DataSafetyService.calculateChecksum(buffer);
    const recordCount = Array.isArray(parsed) ? parsed.length : 1;

    const metadata: BackupMetadata = {
      id: `BKP-${crypto.randomUUID().slice(0, 8)}`,
      sourcePath,
      backupPath,
      createdAt: now.toISOString(),
      reason,
      size: buffer.length,
      checksum,
      recordCount,
    };

    const validMeta = BackupMetadataSchema.parse(metadata);

    // Save backup file
    await this.storage.upload({
      objectName: backupPath,
      buffer,
      contentType: 'application/json',
      metadata: {
        backupId: validMeta.id,
        reason: validMeta.reason,
        checksum: validMeta.checksum,
        createdAt: validMeta.createdAt,
      },
    });

    // Save companion metadata file
    const metaBuffer = Buffer.from(JSON.stringify(validMeta, null, 2), 'utf8');
    await this.storage.upload({
      objectName: metaPath,
      buffer: metaBuffer,
      contentType: 'application/json',
    });

    return validMeta;
  }

  /**
   * Validate a backup path to prevent path traversal and ensure it belongs to an allowed resource.
   */
  validateBackupPath(backupPath: string): { isValid: boolean; resource: DatabaseResourceName } {
    if (!backupPath || typeof backupPath !== 'string') {
      throw new InvalidBackupPathError(String(backupPath), 'Path must be a non-empty string');
    }

    // Strict path traversal checks
    if (backupPath.includes('..') || backupPath.includes('\\') || backupPath.startsWith('/') || backupPath.includes('./')) {
      throw new InvalidBackupPathError(backupPath, 'Path contains illegal traversal sequences');
    }

    // Must match database/backups/<resource>/<resource>-<timestamp>.json
    const match = backupPath.match(/^database\/backups\/([a-z0-9-]+)\/\1-[0-9A-Za-z_-]+\.json$/);
    if (!match) {
      throw new InvalidBackupPathError(backupPath, 'Path does not match the required backup pattern');
    }

    const resource = match[1] as DatabaseResourceName;
    if (!ALLOWED_RESOURCE_NAMES.includes(resource)) {
      throw new InvalidBackupPathError(backupPath, `Unknown or unauthorized database resource: ${resource}`);
    }

    return { isValid: true, resource };
  }

  /**
   * List all backups stored in GCS / Drive with optional filtering and pagination.
   */
  async listBackups(options: ListBackupsOptions = {}): Promise<{ backups: BackupMetadata[]; total: number }> {
    const { resource, reason, limit = 50, offset = 0 } = options;
    const prefix = resource ? `database/backups/${resource}` : 'database/backups';

    const items = await this.storage.list(prefix);
    const metaFiles = items.filter((item) => item.name.endsWith('.meta.json'));

    // Sort descending by name so newest timestamps appear first
    metaFiles.sort((a, b) => b.name.localeCompare(a.name));

    // Limit download window for performance
    const targetFiles = metaFiles.slice(0, Math.max((limit + offset) * 2, 40));

    const results = await Promise.all(
      targetFiles.map(async (metaItem) => {
        try {
          const buffer = await this.storage.download(metaItem.name);
          const parsed = JSON.parse(buffer.toString('utf8'));
          const validated = BackupMetadataSchema.safeParse(parsed);
          if (validated.success) {
            // Check reason filter
            if (reason && validated.data.reason !== reason) {
              return null;
            }
            // Check resource filter
            if (resource) {
              const expectedPrefix = `database/backups/${resource}/`;
              if (!validated.data.backupPath.startsWith(expectedPrefix)) {
                return null;
              }
            }
            return validated.data;
          }
        } catch {
          // Skip unparseable metadata
        }
        return null;
      })
    );

    const parsedList = results.filter((r): r is BackupMetadata => r !== null);

    // Sort newest first
    parsedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = parsedList.length;
    const paged = parsedList.slice(offset, offset + limit);

    return { backups: paged, total };
  }

  /**
   * Controlled recovery pipeline:
   * 1. Validate backup path (path traversal prevention)
   * 2. Confirm backup exists
   * 3. Download and parse backup
   * 4. Validate schema for that resource
   * 5. Create safety backup of CURRENT live file
   * 6. Replace live data using safeWriteJson
   * 7. Verify live data
   */
  async restoreBackup(params: {
    backupPath: string;
    adminUserId: string;
  }): Promise<{ success: boolean; livePath: string; preRecoveryBackup?: BackupMetadata; checksum: string }> {
    const { backupPath } = params;

    // 1. Validate path
    const { resource } = this.validateBackupPath(backupPath);
    const livePath = DATABASE_RESOURCES[resource];

    // 2. Confirm backup exists
    const exists = await this.storage.exists(backupPath);
    if (!exists) {
      throw new RecoveryError(backupPath, `Backup file does not exist: ${backupPath}`);
    }

    // 3. Download and parse backup
    let buffer: Buffer;
    try {
      buffer = await this.storage.download(backupPath);
    } catch (err) {
      throw new RecoveryError(backupPath, `Failed to download backup file: ${backupPath}`, err);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      throw new StorageCorruptionError(backupPath, `Backup file is corrupted or invalid JSON: ${backupPath}`, err);
    }

    // 4. Validate against resource schema
    const schema = getResourceSchema(resource);
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      throw new RecoveryError(
        backupPath,
        `Backup data failed schema validation for resource "${resource}": ${JSON.stringify(validation.error.issues)}`
      );
    }

    // 5. Create backup of current live file before replacing
    let preRecoveryBackup: BackupMetadata | undefined = undefined;
    if (await this.storage.exists(livePath)) {
      const created = await this.createBackup(livePath, 'RECOVERY');
      if (created) preRecoveryBackup = created;
    }

    // 6. Write recovered data to live file with read-back verification
    const writeResult = await this.safeWriteJson({
      storagePath: livePath,
      data: validation.data,
      schema,
      reason: 'RECOVERY',
      createBackupBeforeWrite: false, // already created above
    });

    return {
      success: true,
      livePath,
      preRecoveryBackup,
      checksum: writeResult.checksum,
    };
  }

  /**
   * Backup retention cleanup.
   * Deletes backups older than retentionDays.
   * NEVER deletes live database files or backups newer than retention threshold.
   */
  async cleanupExpiredBackups(
    retentionDays?: number
  ): Promise<{ deletedCount: number; retainedCount: number; errors: string[] }> {
    const days = retentionDays ?? parseInt(process.env.GCS_BACKUP_RETENTION_DAYS || '30', 10);
    const safeDays = Math.max(1, days);
    const cutoffTime = Date.now() - safeDays * 24 * 60 * 60 * 1000;

    const items = await this.storage.list('database/backups');
    let deletedCount = 0;
    let retainedCount = 0;
    const errors: string[] = [];

    // Group files by backup base name
    for (const item of items) {
      // Safety guard: Must be inside database/backups
      if (!item.name.startsWith('database/backups/')) {
        continue;
      }

      // Check item modified/updated time
      const itemTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (itemTime > 0 && itemTime < cutoffTime) {
        try {
          await this.storage.delete(item.name);
          deletedCount++;
        } catch (err) {
          errors.push(`Failed to delete expired backup file ${item.name}: ${String(err)}`);
        }
      } else {
        retainedCount++;
      }
    }

    return { deletedCount, retainedCount, errors };
  }
}
