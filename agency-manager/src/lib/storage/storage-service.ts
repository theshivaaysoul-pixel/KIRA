// src/lib/storage/storage-service.ts
// Storage abstraction interface — the rest of the app depends only on this.
// The underlying implementation (GCS, S3, etc.) can be swapped without changing callers.

export interface UploadResult {
  objectName: string;
  bucket: string;
  publicUrl?: string;
}

export interface StorageHealthResult {
  connection: boolean;
  bucketAccess: boolean;
  readTest: boolean;
  writeTest: boolean;
  deleteTest: boolean;
  error?: string;
}

export interface StorageListItem {
  name: string;
  size?: number;
  updatedAt?: string;
  generation?: string;
  metadata?: Record<string, string>;
}

export interface IStorageService {
  /**
   * Run a full health check: connect → write test object → read it → delete it.
   * Never permanently stores files.
   */
  healthCheck(): Promise<StorageHealthResult>;

  /**
   * Upload a file buffer to storage.
   */
  upload(params: {
    objectName: string;
    buffer: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<UploadResult>;

  /**
   * Download a file from storage as a Buffer.
   */
  download(objectName: string): Promise<Buffer>;

  /**
   * Delete a file from storage.
   */
  delete(objectName: string): Promise<void>;

  /**
   * Check if a file or object exists in storage.
   */
  exists(objectName: string): Promise<boolean>;

  /**
   * List files or objects under a given path prefix.
   */
  list(prefix: string): Promise<StorageListItem[]>;

  /**
   * Generate a signed URL for temporary direct access.
   */
  getSignedUrl(objectName: string, expiresInSeconds?: number): Promise<string>;
}

