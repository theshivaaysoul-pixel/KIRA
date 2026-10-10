// src/lib/storage/drive-storage-service.ts
// Google Drive implementation of IStorageService.
// Uses Google Drive API (Google One / Agency Drive quota).
// Server-side only — NEVER import in client components.

import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { google, type drive_v3 } from 'googleapis';
import type { IStorageService, StorageHealthResult, StorageListItem, UploadResult } from './storage-service';

const TEST_OBJECT_NAME = '__kira_health_check_test__.txt';
const APP_ROOT_FOLDER_NAME = 'KIRA';

/**
 * Build Google Drive client using either:
 * 1. OAuth2 refresh token (personal Google account / 5TB Google One)
 * 2. Service Account key file (GOOGLE_APPLICATION_CREDENTIALS)
 */
function getDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  // Option A: OAuth2 refresh token
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:4000/oauth2callback'
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2 });
  }

  // Option B: Service Account credentials
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath) {
    const resolvedPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.resolve(process.cwd(), keyFilePath);

    if (fs.existsSync(resolvedPath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: resolvedPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      return google.drive({ version: 'v3', auth });
    }
  }

  throw new Error(
    '[Google Drive] Missing credentials. Configure either:\n' +
    '  1. GOOGLE_APPLICATION_CREDENTIALS in .env.local (Service Account JSON)\n' +
    '  2. GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN'
  );
}

export class DriveStorageService implements IStorageService {
  private drive: drive_v3.Drive | null = null;
  private folderCache = new Map<string, string>();
  private fileIdCache = new Map<string, string>();
  private bufferCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

  private getClient(): drive_v3.Drive {
    if (!this.drive) {
      this.drive = getDriveClient();
    }
    return this.drive;
  }

  private async getRootFolderId(): Promise<string> {
    const customFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (customFolderId) {
      const drive = this.getClient();
      await drive.files.get({ fileId: customFolderId, fields: 'id, name' });
      return customFolderId;
    }

    const cacheKey = 'root/KIRA';
    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey)!;
    }

    const drive = this.getClient();
    const res = await drive.files.list({
      q: `name='${APP_ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      const id = res.data.files[0].id!;
      this.folderCache.set(cacheKey, id);
      return id;
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: APP_ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const newId = createRes.data.id!;
    this.folderCache.set(cacheKey, newId);
    return newId;
  }

  async healthCheck(): Promise<StorageHealthResult> {
    const result: StorageHealthResult = {
      connection: false,
      bucketAccess: false,
      readTest: false,
      writeTest: false,
      deleteTest: false,
    };

    let drive: drive_v3.Drive;
    let rootFolderId: string;

    // Step 1: Connection check
    try {
      drive = this.getClient();
      await drive.about.get({ fields: 'user, storageQuota' });
      result.connection = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Google Drive Health] Connection check failed:', message);
      if (message.includes('has not been used in project') || message.includes('disabled')) {
        result.error = 'Google Drive API is disabled. Enable it in Google Cloud Console.';
      } else {
        result.error = `Google Drive connection error: ${message}`;
      }
      return result;
    }

    // Step 2: Folder access check
    try {
      rootFolderId = await this.getRootFolderId();
      result.bucketAccess = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Google Drive Health] Root folder access failed:', message);
      result.error = `Root folder access error: ${message}`;
      return result;
    }

    const testContent = `KIRA Agency Manager health check — ${new Date().toISOString()}`;
    let createdFileId: string | null = null;

    // Step 3: Write test
    try {
      const stream = Readable.from(Buffer.from(testContent));
      const res = await drive.files.create({
        requestBody: {
          name: TEST_OBJECT_NAME,
          parents: [rootFolderId],
        },
        media: {
          mimeType: 'text/plain',
          body: stream,
        },
        fields: 'id',
      });
      createdFileId = res.data.id || null;
      if (createdFileId) {
        result.writeTest = true;
      } else {
        result.error = 'File write returned empty ID.';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Google Drive Health] Write test failed:', message);
      result.error = `Google Drive write failed: ${message}`;
      return result;
    }

    // Step 4: Read test
    if (createdFileId) {
      try {
        const res = await drive.files.get(
          { fileId: createdFileId, alt: 'media' },
          { responseType: 'text' }
        );
        if (res.data === testContent) {
          result.readTest = true;
        } else {
          result.error = 'Read test returned unexpected content.';
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Google Drive Health] Read test failed:', message);
        result.error = `Google Drive read failed: ${message}`;
      }

      // Step 5: Delete test (cleanup)
      try {
        await drive.files.delete({ fileId: createdFileId });
        result.deleteTest = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Google Drive Health] Delete test failed:', message);
        if (!result.error) {
          result.error = `Google Drive delete cleanup failed: ${message}`;
        }
      }
    }

    return result;
  }

  private async resolvePathAndFolder(objectName: string): Promise<{ folderId: string; fileName: string }> {
    const parts = objectName.replace(/\\/g, '/').split('/').filter(Boolean);
    const fileName = parts.pop() || objectName;
    let currentFolderId = await this.getRootFolderId();

    const drive = this.getClient();
    for (const folderName of parts) {
      const cacheKey = `${currentFolderId}/${folderName}`;
      if (this.folderCache.has(cacheKey)) {
        currentFolderId = this.folderCache.get(cacheKey)!;
        continue;
      }

      const res = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (res.data.files && res.data.files.length > 0) {
        currentFolderId = res.data.files[0].id!;
      } else {
        const createRes = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentFolderId],
          },
          fields: 'id',
        });
        currentFolderId = createRes.data.id!;
      }
      this.folderCache.set(cacheKey, currentFolderId);
    }

    return { folderId: currentFolderId, fileName };
  }

  private async findFileInFolder(fileName: string, parentFolderId: string): Promise<string | null> {
    const cacheKey = `${parentFolderId}/${fileName}`;
    if (this.fileIdCache.has(cacheKey)) {
      return this.fileIdCache.get(cacheKey)!;
    }

    const drive = this.getClient();
    const escapedFileName = fileName.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `name='${escapedFileName}' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1,
    });
    const id = res.data.files && res.data.files.length > 0 ? res.data.files[0].id! : null;
    if (id) {
      this.fileIdCache.set(cacheKey, id);
    }
    return id;
  }

  async exists(objectName: string): Promise<boolean> {
    try {
      const cached = this.bufferCache.get(objectName);
      if (cached && cached.expiresAt > Date.now()) return true;

      const { folderId, fileName } = await this.resolvePathAndFolder(objectName);
      const fileId = await this.findFileInFolder(fileName, folderId);
      return fileId !== null;
    } catch {
      return false;
    }
  }

  async upload(params: {
    objectName: string;
    buffer: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<UploadResult> {
    const drive = this.getClient();
    const { folderId, fileName } = await this.resolvePathAndFolder(params.objectName);
    const existingFileId = await this.findFileInFolder(fileName, folderId);
    const stream = Readable.from(params.buffer);

    let fileId: string;
    let webViewLink: string | undefined;

    if (existingFileId) {
      const res = await drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType: params.contentType,
          body: stream,
        },
        fields: 'id, name, webViewLink',
      });
      fileId = res.data.id || existingFileId;
      webViewLink = res.data.webViewLink || undefined;
    } else {
      const res = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          description: params.metadata ? JSON.stringify(params.metadata) : undefined,
        },
        media: {
          mimeType: params.contentType,
          body: stream,
        },
        fields: 'id, name, webViewLink',
      });
      fileId = res.data.id || params.objectName;
      webViewLink = res.data.webViewLink || undefined;
    }

    // Cache fileId and buffer for instant subsequent reads & streaming
    this.fileIdCache.set(`${folderId}/${fileName}`, fileId);
    this.bufferCache.set(params.objectName, {
      buffer: params.buffer,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins cache
    });

    return {
      objectName: params.objectName,
      bucket: 'Google Drive',
      publicUrl: webViewLink,
    };
  }

  async download(objectName: string): Promise<Buffer> {
    // Return from in-memory cache if fresh
    const cached = this.bufferCache.get(objectName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.buffer;
    }

    const drive = this.getClient();
    let fileId = objectName;

    if (objectName.includes('/') || objectName.endsWith('.json') || objectName.endsWith('.txt')) {
      const { folderId, fileName } = await this.resolvePathAndFolder(objectName);
      const foundId = await this.findFileInFolder(fileName, folderId);
      if (!foundId) {
        throw new Error(`[Google Drive] File not found: ${objectName}`);
      }
      fileId = foundId;
    }

    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);

    // Cache the downloaded buffer so video seeking/range requests are instant
    this.bufferCache.set(objectName, {
      buffer,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return buffer;
  }

  async delete(objectName: string): Promise<void> {
    this.bufferCache.delete(objectName);
    const drive = this.getClient();
    let fileId = objectName;

    if (objectName.includes('/') || objectName.endsWith('.json') || objectName.endsWith('.txt')) {
      const { folderId, fileName } = await this.resolvePathAndFolder(objectName);
      this.fileIdCache.delete(`${folderId}/${fileName}`);
      const foundId = await this.findFileInFolder(fileName, folderId);
      if (!foundId) return; // already deleted
      fileId = foundId;
    }

    await drive.files.delete({ fileId });
  }

  private async resolveFolder(folderPath: string): Promise<string> {
    const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
    let currentFolderId = await this.getRootFolderId();
    const drive = this.getClient();

    for (const folderName of parts) {
      const cacheKey = `${currentFolderId}/${folderName}`;
      if (this.folderCache.has(cacheKey)) {
        currentFolderId = this.folderCache.get(cacheKey)!;
        continue;
      }

      const res = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (res.data.files && res.data.files.length > 0) {
        currentFolderId = res.data.files[0].id!;
      } else {
        const createRes = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentFolderId],
          },
          fields: 'id',
        });
        currentFolderId = createRes.data.id!;
      }
      this.folderCache.set(cacheKey, currentFolderId);
    }

    return currentFolderId;
  }

  private async listFolderContents(currentId: string, currentPrefix: string, results: StorageListItem[]): Promise<void> {
    const drive = this.getClient();
    let pageToken: string | undefined = undefined;
    do {
      const listResponse: { data: drive_v3.Schema$FileList } = await drive.files.list({
        q: `'${currentId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, description)',
        spaces: 'drive',
        pageToken,
        pageSize: 1000,
      });
      const files = listResponse.data.files || [];

      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          await this.listFolderContents(file.id!, `${currentPrefix}/${file.name}`, results);
        } else {
          let meta: Record<string, string> | undefined = undefined;
          if (file.description) {
            try {
              meta = JSON.parse(file.description);
            } catch {
              // ignore description parse error
            }
          }
          results.push({
            name: `${currentPrefix}/${file.name}`,
            size: file.size ? parseInt(file.size, 10) : 0,
            updatedAt: file.modifiedTime || undefined,
            generation: file.id || undefined,
            metadata: meta,
          });
        }
      }
      pageToken = listResponse.data.nextPageToken || undefined;
    } while (pageToken);
  }

  async list(prefix: string): Promise<StorageListItem[]> {
    try {
      const folderId = await this.resolveFolder(prefix);
      const results: StorageListItem[] = [];
      await this.listFolderContents(folderId, prefix.replace(/\/+$/, ''), results);
      return results;
    } catch (err) {
      console.error('[DriveStorageService] list failed for prefix:', prefix, err);
      return [];
    }
  }

  async getSignedUrl(objectName: string): Promise<string> {
    const drive = this.getClient();
    let fileId = objectName;

    if (objectName.includes('/') || objectName.endsWith('.json') || objectName.endsWith('.txt')) {
      const { folderId, fileName } = await this.resolvePathAndFolder(objectName);
      const foundId = await this.findFileInFolder(fileName, folderId);
      if (foundId) fileId = foundId;
    }

    const res = await drive.files.get({
      fileId,
      fields: 'webViewLink',
    });
    return res.data.webViewLink || `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }
}
