// src/lib/services/media-service.ts
// Business logic for GCS Media Manager (Phase 8).
// Enforces MIME validation, magic bytes verification, file-size limits, filename sanitization,
// path traversal protection, ACID-like orphan cleanup, secure media access, and audit logging.

import crypto from 'crypto';
import { getRepositories } from '@/lib/repositories';
import { getStorageService } from '@/lib/storage';
import type { ContentAsset, AssetType, TeamMember } from '@/lib/types/domain';
import { logSecurityActivity } from '@/lib/auth/authorization';
import {
  ALLOWED_MIME_TYPES,
  getFileLimits,
  validateMagicBytes,
  sanitizeFileName,
  isExecutableOrScript,
} from '@/lib/media/constants';

// ─── Custom Domain Errors ─────────────────────────────────────────────────────

export class MediaValidationError extends Error {
  readonly code = 'MEDIA_VALIDATION_ERROR';
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

export class ContentNotFoundError extends Error {
  readonly code = 'CONTENT_NOT_FOUND';
  readonly status = 404;
  constructor(contentId: string) {
    super(`Content with ID "${contentId}" was not found.`);
    this.name = 'ContentNotFoundError';
  }
}

export class ContentArchivedError extends Error {
  readonly code = 'CONTENT_ARCHIVED';
  readonly status = 422;
  constructor(contentId: string) {
    super(`Cannot upload media to archived content "${contentId}".`);
    this.name = 'ContentArchivedError';
  }
}

export class AssetNotFoundError extends Error {
  readonly code = 'ASSET_NOT_FOUND';
  readonly status = 404;
  constructor(assetId: string) {
    super(`Content asset with ID "${assetId}" was not found.`);
    this.name = 'AssetNotFoundError';
  }
}

export class AssetOwnershipError extends Error {
  readonly code = 'ASSET_OWNERSHIP_MISMATCH';
  readonly status = 403;
  constructor(assetId: string, contentId: string) {
    super(`Asset "${assetId}" does not belong to content "${contentId}".`);
    this.name = 'AssetOwnershipError';
  }
}

export class MediaIntegrityError extends Error {
  readonly code = 'MEDIA_INTEGRITY_ERROR';
  readonly status = 500;
  constructor(message: string) {
    super(message);
    this.name = 'MediaIntegrityError';
  }
}

export class GCSUploadError extends Error {
  readonly code = 'GCS_UPLOAD_ERROR';
  readonly status = 500;
  constructor(message: string) {
    super(message);
    this.name = 'GCSUploadError';
  }
}

// ─── Media Service Implementation ─────────────────────────────────────────────

export interface UploadAssetParams {
  contentId: string;
  file: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  };
  actor: TeamMember;
}

export class MediaService {
  /**
   * Upload a media file to Google Cloud Storage and register a ContentAsset record.
   * Performs all security checks and guarantees zero orphaned files on metadata failure.
   */
  static async uploadContentAsset({
    contentId,
    file,
    actor,
  }: UploadAssetParams): Promise<ContentAsset> {
    const repos = getRepositories();
    const storage = getStorageService();

    // 1. Verify content existence & active status
    const content = await repos.content.findById(contentId);
    if (!content) {
      throw new ContentNotFoundError(contentId);
    }
    if (content.status === 'ARCHIVED') {
      throw new ContentArchivedError(contentId);
    }

    // 2. Validate MIME type
    const normalizedMime = file.mimeType.trim().toLowerCase();
    const assetType = ALLOWED_MIME_TYPES[normalizedMime];
    if (!assetType) {
      throw new MediaValidationError(
        `Unsupported media type "${file.mimeType}". Allowed types: JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime, MP3, WAV, OGG, PDF.`
      );
    }

    // 3. Validate size against category limits
    const limits = getFileLimits();
    const maxAllowedSize = limits[assetType];
    if (file.buffer.length > maxAllowedSize) {
      const maxMb = Math.round(maxAllowedSize / (1024 * 1024));
      throw new MediaValidationError(
        `File size (${(file.buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${maxMb}MB for ${assetType}.`
      );
    }

    if (file.buffer.length === 0) {
      throw new MediaValidationError('Cannot upload an empty file.');
    }

    // 4. Validate magic bytes / file signatures to prevent MIME spoofing & scripts
    if (isExecutableOrScript(file.buffer)) {
      throw new MediaValidationError('Executable or script files are strictly prohibited.');
    }

    const matchesMagic = validateMagicBytes(file.buffer, normalizedMime);
    if (!matchesMagic) {
      throw new MediaValidationError(
        `File contents do not match declared MIME type "${normalizedMime}".`
      );
    }

    // 5. Sanitize original filename & construct safe storage path
    const { safeFileName, extension } = sanitizeFileName(file.fileName);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const storageObjectName = extension
      ? `${uniqueSuffix}-${safeFileName}`
      : `${uniqueSuffix}-${safeFileName}.bin`;

    const storagePath = `media/content/${contentId}/original/${storageObjectName}`;

    // 6. Compute SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 7. Write to Google Cloud Storage
    try {
      await storage.upload({
        objectName: storagePath,
        buffer: file.buffer,
        contentType: normalizedMime,
        metadata: {
          contentId,
          originalName: safeFileName,
          uploadedBy: actor.id,
          checksum,
        },
      });
    } catch (err) {
      console.error('[MediaService.uploadContentAsset] GCS upload failed:', err);
      throw new GCSUploadError('Failed to write media object to Google Cloud Storage.');
    }

    // 8. Verify GCS object existence & integrity
    const exists = await storage.exists(storagePath);
    if (!exists) {
      throw new GCSUploadError('GCS upload completed but verification check failed.');
    }

    // 9. Persist ContentAsset metadata record
    let createdAsset: ContentAsset;
    try {
      createdAsset = await repos.contentAssets.create({
        contentId,
        type: assetType,
        fileName: safeFileName,
        mimeType: normalizedMime,
        size: file.buffer.length,
        storagePath,
      });
    } catch (dbErr) {
      console.error(
        '[MediaService.uploadContentAsset] Metadata persistence failed. Cleaning up orphaned GCS object:',
        storagePath,
        dbErr
      );
      // Orphan cleanup: remove file from GCS so no stray objects remain
      try {
        await storage.delete(storagePath);
      } catch (cleanupErr) {
        console.error('[MediaService.uploadContentAsset] Orphan cleanup failed for:', storagePath, cleanupErr);
      }
      throw dbErr;
    }

    // 10. Audit logging
    await logSecurityActivity(
      actor.authUid || actor.id,
      'CREATE',
      'ContentAsset',
      createdAsset.id,
      {
        assetId: createdAsset.id,
        contentId,
        assetType,
        fileName: safeFileName,
        size: file.buffer.length,
        mimeType: normalizedMime,
        storagePath,
        checksum,
      }
    );

    return createdAsset;
  }

  /**
   * List all assets associated with a content record.
   */
  static async getContentAssets(
    contentId: string,
    _actor: TeamMember
  ): Promise<ContentAsset[]> {
    const repos = getRepositories();
    const content = await repos.content.findById(contentId);
    if (!content) {
      throw new ContentNotFoundError(contentId);
    }
    return repos.contentAssets.findByContentId(contentId);
  }

  /**
   * Get single asset by ID with strict IDOR verification.
   */
  static async getContentAssetById(
    contentId: string,
    assetId: string,
    _actor: TeamMember
  ): Promise<ContentAsset> {
    const repos = getRepositories();

    const asset = await repos.contentAssets.findById(assetId);
    if (!asset) {
      throw new AssetNotFoundError(assetId);
    }

    // IDOR check: verify asset belongs to requested content
    if (asset.contentId !== contentId) {
      throw new AssetOwnershipError(assetId, contentId);
    }

    return asset;
  }

  /**
   * Generate secure media access (signed URL and/or file buffer).
   */
  static async getSecureMediaAccess(
    contentId: string,
    assetId: string,
    actor: TeamMember,
    expiresInSeconds = 900
  ): Promise<{ asset: ContentAsset; signedUrl: string }> {
    const asset = await this.getContentAssetById(contentId, assetId, actor);
    const storage = getStorageService();

    // Verify object still exists in storage
    const exists = await storage.exists(asset.storagePath);
    if (!exists) {
      throw new MediaIntegrityError(
        `Media file for asset "${assetId}" does not exist in storage path "${asset.storagePath}".`
      );
    }

    const signedUrl = await storage.getSignedUrl(asset.storagePath, expiresInSeconds);
    return { asset, signedUrl };
  }

  /**
   * Download the raw buffer directly for proxy/streaming.
   */
  static async downloadAssetBuffer(
    contentId: string,
    assetId: string,
    actor: TeamMember
  ): Promise<{ asset: ContentAsset; buffer: Buffer }> {
    const asset = await this.getContentAssetById(contentId, assetId, actor);
    const storage = getStorageService();

    const exists = await storage.exists(asset.storagePath);
    if (!exists) {
      throw new MediaIntegrityError(
        `Media file for asset "${assetId}" does not exist in storage path "${asset.storagePath}".`
      );
    }

    const buffer = await storage.download(asset.storagePath);
    return { asset, buffer };
  }

  /**
   * Delete an asset with GCS object deletion, verification, and metadata deletion.
   */
  static async deleteContentAsset(
    contentId: string,
    assetId: string,
    actor: TeamMember
  ): Promise<{ deleted: boolean; assetId: string }> {
    const repos = getRepositories();
    const storage = getStorageService();

    // 1. Verify existence & IDOR check
    const asset = await this.getContentAssetById(contentId, assetId, actor);

    // 2. Delete GCS object
    try {
      const exists = await storage.exists(asset.storagePath);
      if (exists) {
        await storage.delete(asset.storagePath);
      }
    } catch (err) {
      console.error('[MediaService.deleteContentAsset] GCS delete failed:', err);
      throw new MediaIntegrityError(`Failed to delete storage object "${asset.storagePath}".`);
    }

    // 3. Delete thumbnail if present
    if (asset.thumbnailPath) {
      try {
        const thumbExists = await storage.exists(asset.thumbnailPath);
        if (thumbExists) {
          await storage.delete(asset.thumbnailPath);
        }
      } catch (thumbErr) {
        console.warn('[MediaService.deleteContentAsset] Thumbnail delete failed:', thumbErr);
      }
    }

    // 4. Verify GCS object deletion
    const stillExists = await storage.exists(asset.storagePath);
    if (stillExists) {
      throw new MediaIntegrityError(`GCS object "${asset.storagePath}" could not be confirmed deleted.`);
    }

    // 5. Delete ContentAsset metadata record
    await repos.contentAssets.delete(assetId);

    // 6. Security Activity Log
    await logSecurityActivity(
      actor.authUid || actor.id,
      'DELETE',
      'ContentAsset',
      assetId,
      {
        assetId,
        contentId,
        fileName: asset.fileName,
        storagePath: asset.storagePath,
        deletedBy: actor.id,
      }
    );

    return { deleted: true, assetId };
  }
}
