// src/lib/storage/gcs-storage-service.ts
// Google Cloud Storage implementation of IStorageService.
// NEVER import this file from client components — server-side only.

import path from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import type { IStorageService, StorageHealthResult, StorageListItem, UploadResult } from './storage-service';

const TEST_OBJECT_NAME = '__kira_health_check_test__.txt';

/**
 * Build the GCS Storage client from environment variables.
 * Supports both:
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to JSON key file)
 *   - Inline GOOGLE_CLOUD_CLIENT_EMAIL + GOOGLE_CLOUD_PRIVATE_KEY
 *   - Application Default Credentials (GCP-hosted environments: Cloud Run, GKE, etc.)
 */
function buildStorageClient(): Storage {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // 1. Direct JSON string or Base64 encoded Service Account
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawServiceAccount && typeof rawServiceAccount === 'string') {
    try {
      const trimmed = rawServiceAccount.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(jsonStr);
      if (serviceAccount.project_id && serviceAccount.private_key) {
        return new Storage({
          projectId: serviceAccount.project_id,
          credentials: serviceAccount,
        });
      }
    } catch {}
  }

  // 2. If a key file path is given and exists on disk, use it
  if (keyFilePath && typeof keyFilePath === 'string' && !keyFilePath.trim().startsWith('{')) {
    const resolvedPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.resolve(process.cwd(), keyFilePath);
    if (fs.existsSync(resolvedPath)) {
      return new Storage({ projectId, keyFilename: resolvedPath });
    }
  }

  // 3. If inline credentials are provided, use them
  if (clientEmail && rawPrivateKey) {
    let privateKey = rawPrivateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    return new Storage({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
  }

  // Fall back to Application Default Credentials (Cloud Run, GKE Workload Identity, etc.)
  // This is the preferred method on GCP-hosted environments.
  if (projectId) {
    return new Storage({ projectId });
  }

  throw new Error(
    '[GCS] Missing storage credentials. Set one of:\n' +
    '  1. GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n' +
    '  2. GOOGLE_CLOUD_CLIENT_EMAIL + GOOGLE_CLOUD_PRIVATE_KEY\n' +
    '  3. GOOGLE_CLOUD_PROJECT_ID (for Application Default Credentials on GCP)\n' +
    'See .env.example for details.'
  );
}

function getBucketName(): string {
  const bucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      '[GCS] GOOGLE_CLOUD_STORAGE_BUCKET is not set. ' +
      'Add it to your .env.local file.'
    );
  }
  return bucket;
}

let _storageClient: Storage | null = null;
function getStorageClient(): Storage {
  if (!_storageClient) {
    _storageClient = buildStorageClient();
  }
  return _storageClient;
}

export class GCSStorageService implements IStorageService {
  async healthCheck(): Promise<StorageHealthResult> {
    const result: StorageHealthResult = {
      connection: false,
      bucketAccess: false,
      readTest: false,
      writeTest: false,
      deleteTest: false,
    };

    let storage: Storage;
    let bucketName: string;

    // Step 1: Connection check
    try {
      storage = getStorageClient();
      bucketName = getBucketName();
      result.connection = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GCS Health] Connection setup failed:', message);
      result.error = 'Storage configuration error. Check server logs.';
      return result;
    }

    // Step 2: Bucket access check
    try {
      const [exists] = await storage.bucket(bucketName).exists();
      if (!exists) {
        result.error = `Bucket "${bucketName}" does not exist.`;
        console.error('[GCS Health] Bucket not found:', bucketName);
        return result;
      }
      result.bucketAccess = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GCS Health] Bucket access failed:', message);
      result.error = 'Bucket access denied. Check IAM permissions.';
      return result;
    }

    const testContent = `KIRA Agency Manager health check — ${new Date().toISOString()}`;

    // Step 3: Write test
    try {
      await storage
        .bucket(bucketName)
        .file(TEST_OBJECT_NAME)
        .save(testContent, { contentType: 'text/plain' });
      result.writeTest = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GCS Health] Write test failed:', message);
      result.error = 'Storage write failed. Check bucket permissions.';
      return result;
    }

    // Step 4: Read test
    try {
      const [buffer] = await storage.bucket(bucketName).file(TEST_OBJECT_NAME).download();
      if (buffer.toString() === testContent) {
        result.readTest = true;
      } else {
        result.error = 'Read test returned unexpected content.';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GCS Health] Read test failed:', message);
      result.error = 'Storage read failed.';
    }

    // Step 5: Delete test (always attempt cleanup)
    try {
      await storage.bucket(bucketName).file(TEST_OBJECT_NAME).delete();
      result.deleteTest = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GCS Health] Delete test failed:', message);
      if (!result.error) {
        result.error = 'Storage delete failed. Test file may remain.';
      }
    }

    return result;
  }

  async upload(params: {
    objectName: string;
    buffer: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<UploadResult> {
    const storage = getStorageClient();
    const bucketName = getBucketName();

    await storage.bucket(bucketName).file(params.objectName).save(params.buffer, {
      contentType: params.contentType,
      metadata: params.metadata,
    });

    return { objectName: params.objectName, bucket: bucketName };
  }

  async download(objectName: string): Promise<Buffer> {
    const storage = getStorageClient();
    const bucketName = getBucketName();
    const [buffer] = await storage.bucket(bucketName).file(objectName).download();
    return buffer;
  }

  async delete(objectName: string): Promise<void> {
    const storage = getStorageClient();
    const bucketName = getBucketName();
    await storage.bucket(bucketName).file(objectName).delete();
  }

  async exists(objectName: string): Promise<boolean> {
    const storage = getStorageClient();
    const bucketName = getBucketName();
    const [fileExists] = await storage.bucket(bucketName).file(objectName).exists();
    return fileExists;
  }

  async list(prefix: string): Promise<StorageListItem[]> {
    const storage = getStorageClient();
    const bucketName = getBucketName();
    try {
      const [files] = await storage.bucket(bucketName).getFiles({ prefix });
      return files.map((f) => ({
        name: f.name,
        size: typeof f.metadata.size === 'string' ? parseInt(f.metadata.size, 10) : Number(f.metadata.size || 0),
        updatedAt: (f.metadata.updated as string) || undefined,
        generation: (f.metadata.generation as string) || undefined,
        metadata: (f.metadata.metadata as Record<string, string>) || undefined,
      }));
    } catch (err) {
      console.error('[GCSStorageService] list failed for prefix:', prefix, err);
      return [];
    }
  }

  async getSignedUrl(objectName: string, expiresInSeconds = 3600): Promise<string> {
    const storage = getStorageClient();
    const bucketName = getBucketName();
    const [url] = await storage.bucket(bucketName).file(objectName).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return url;
  }
}
