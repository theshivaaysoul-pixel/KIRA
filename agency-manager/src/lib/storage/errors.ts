// src/lib/storage/errors.ts
// Structured storage and data safety error types.
// Server-side errors MUST NOT leak internal credentials, stack traces, or bucket details to clients.

export class StorageError extends Error {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

export class StorageReadError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(message || `Failed to read storage path: ${storagePath}`, originalError);
    this.name = 'StorageReadError';
    this.storagePath = storagePath;
  }
}

export class StorageWriteError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(message || `Failed to write storage path: ${storagePath}`, originalError);
    this.name = 'StorageWriteError';
    this.storagePath = storagePath;
  }
}

export class StorageDeleteError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(message || `Failed to delete storage path: ${storagePath}`, originalError);
    this.name = 'StorageDeleteError';
    this.storagePath = storagePath;
  }
}

export class StorageCorruptionError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(
      message || `Data corruption detected in ${storagePath}. The file is malformed or invalid JSON.`,
      originalError
    );
    this.name = 'StorageCorruptionError';
    this.storagePath = storagePath;
  }
}

export class StorageVerificationError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(
      message || `Write verification failed for ${storagePath}. Read-back data did not match written content.`,
      originalError
    );
    this.name = 'StorageVerificationError';
    this.storagePath = storagePath;
  }
}

export class BackupError extends StorageError {
  public readonly sourcePath: string;

  constructor(sourcePath: string, message?: string, originalError?: unknown) {
    super(message || `Backup operation failed for ${sourcePath}`, originalError);
    this.name = 'BackupError';
    this.sourcePath = sourcePath;
  }
}

export class RecoveryError extends StorageError {
  public readonly backupPath: string;

  constructor(backupPath: string, message?: string, originalError?: unknown) {
    super(message || `Recovery operation failed for backup: ${backupPath}`, originalError);
    this.name = 'RecoveryError';
    this.backupPath = backupPath;
  }
}

export class ConcurrentModificationError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, message?: string, originalError?: unknown) {
    super(
      message || `Concurrent modification detected on ${storagePath}. The document was updated by another request.`,
      originalError
    );
    this.name = 'ConcurrentModificationError';
    this.storagePath = storagePath;
  }
}

export class InvalidBackupPathError extends StorageError {
  public readonly invalidPath: string;

  constructor(invalidPath: string, reason?: string) {
    super(`Invalid backup path "${invalidPath}": ${reason || 'Path traversal or disallowed resource detected'}`);
    this.name = 'InvalidBackupPathError';
    this.invalidPath = invalidPath;
  }
}
