// src/lib/repositories/base-json-repository.ts
// Generic storage-backed JSON collection repository.
// Provides safe reads, safe writes, ID generation, and validation.

import type { IStorageService } from '@/lib/storage/storage-service';
import { DataSafetyService } from '@/lib/storage/data-safety-service';
import type { BackupReason } from '@/lib/storage/backup-types';
import { StorageCorruptionError, StorageVerificationError } from '@/lib/storage/errors';
import { generateNextId } from '@/lib/utils/id';
import { z } from 'zod';

export class DataIntegrityError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class BaseJsonRepository<
  T extends { id: string },
  TCreate,
  TUpdate
> {
  // Simple mutex per storage path to prevent race conditions during read-modify-write
  private static fileLocks = new Map<string, Promise<unknown>>();
  // In-memory cache with short 15s TTL to eliminate redundant remote network calls for unchanged collections
  private static memoryCache = new Map<string, { data: unknown[]; checksum: string; expiresAt: number }>();
  protected readonly safetyService: DataSafetyService;
  protected lastChecksum?: string;

  static invalidateCache(storagePath?: string): void {
    if (storagePath) {
      BaseJsonRepository.memoryCache.delete(storagePath);
    } else {
      BaseJsonRepository.memoryCache.clear();
    }
  }

  constructor(
    protected readonly storagePath: string,
    protected readonly prefix: string,
    protected readonly itemSchema: z.ZodType<T>,
    protected readonly createSchema: z.ZodType<TCreate>,
    protected readonly storage: IStorageService
  ) {
    this.safetyService = new DataSafetyService(this.storage);
  }

  protected async withLock<R>(fn: () => Promise<R>): Promise<R> {
    const currentLock = BaseJsonRepository.fileLocks.get(this.storagePath) || Promise.resolve();
    let releaseLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    BaseJsonRepository.fileLocks.set(this.storagePath, newLock);
    await currentLock;

    try {
      return await fn();
    } finally {
      releaseLock();
    }
  }

  protected async readRaw(): Promise<T[]> {
    const cached = BaseJsonRepository.memoryCache.get(this.storagePath);
    if (cached && cached.expiresAt > Date.now()) {
      this.lastChecksum = cached.checksum;
      return [...(cached.data as T[])];
    }

    try {
      const result = await this.safetyService.safeReadJson(
        this.storagePath,
        z.array(this.itemSchema),
        []
      );
      this.lastChecksum = result.checksum;
      BaseJsonRepository.memoryCache.set(this.storagePath, {
        data: result.data,
        checksum: result.checksum,
        expiresAt: Date.now() + 15000,
      });
      return result.data;
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  protected async writeRaw(items: T[], reason: BackupReason = 'BEFORE_UPDATE'): Promise<void> {
    const validationResult = z.array(this.itemSchema).safeParse(items);
    if (!validationResult.success) {
      throw new ValidationError(`Validation failed before writing to ${this.storagePath}`, validationResult.error.issues);
    }

    try {
      const res = await this.safetyService.safeWriteJson({
        storagePath: this.storagePath,
        data: validationResult.data,
        schema: z.array(this.itemSchema),
        reason,
        createBackupBeforeWrite: items.length > 0,
      });
      this.lastChecksum = res.checksum;
      BaseJsonRepository.memoryCache.set(this.storagePath, {
        data: validationResult.data,
        checksum: res.checksum,
        expiresAt: Date.now() + 15000,
      });
    } catch (err) {
      if (err instanceof StorageVerificationError) {
        throw new DataIntegrityError(err.message, err);
      }
      throw err;
    }
  }

  async findAll(): Promise<T[]> {
    return this.readRaw();
  }

  async findById(id: string): Promise<T | null> {
    const items = await this.readRaw();
    return items.find((item) => item.id === id) || null;
  }

  async count(): Promise<number> {
    const items = await this.readRaw();
    return items.length;
  }

  async exists(id: string): Promise<boolean> {
    const item = await this.findById(id);
    return item !== null;
  }

  async create(data: TCreate): Promise<T> {
    return this.withLock(async () => {
      // 1. Validate create input
      const parsedData = this.createSchema.safeParse(data);
      if (!parsedData.success) {
        throw new ValidationError('Validation failed for create entity', parsedData.error.issues);
      }

      // 2. Read existing
      const items = await this.readRaw();

      // 3. Hook for custom validation (e.g. duplicate check)
      await this.beforeCreate(parsedData.data, items);

      // 4. Generate next ID
      const newId = generateNextId(this.prefix, items.map((i) => i.id));
      const now = new Date().toISOString();

      const newItem = {
        ...parsedData.data,
        id: newId,
        createdAt: now,
        updatedAt: now,
      } as unknown as T;

      // 5. Append and persist
      items.push(newItem);
      await this.writeRaw(items);

      return newItem;
    });
  }

  async update(id: string, data: TUpdate): Promise<T> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const index = items.findIndex((i) => i.id === id);

      if (index === -1) {
        throw new NotFoundError(`Entity with ID ${id} not found in ${this.storagePath}`);
      }

      const existing = items[index];

      // Hook for custom validation before update
      await this.beforeUpdate(id, data, items);

      const now = new Date().toISOString();
      const updated = {
        ...existing,
        ...data,
        id: existing.id, // prevent overwriting ID
        createdAt: (existing as Record<string, unknown>).createdAt, // preserve original createdAt
        updatedAt: now,
      } as unknown as T;

      // Validate merged object
      const parsed = this.itemSchema.safeParse(updated);
      if (!parsed.success) {
        throw new ValidationError(`Validation failed updating ${id}`, parsed.error.issues);
      }

      items[index] = parsed.data;
      await this.writeRaw(items);

      return parsed.data;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.withLock(async () => {
      const items = await this.readRaw();
      const index = items.findIndex((i) => i.id === id);

      if (index === -1) {
        return false;
      }

      // Hook for custom validation before delete
      await this.beforeDelete(id, items);

      items.splice(index, 1);
      await this.writeRaw(items, 'BEFORE_DELETE');

      return true;
    });
  }

  // Extensible hooks for subclasses
  protected async beforeCreate(_data: TCreate, _currentItems: T[]): Promise<void> {}
  protected async beforeUpdate(_id: string, _data: TUpdate, _currentItems: T[]): Promise<void> {}
  protected async beforeDelete(_id: string, _currentItems: T[]): Promise<void> {}
}
