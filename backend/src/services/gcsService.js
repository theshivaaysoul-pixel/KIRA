/**
 * Google Cloud Storage Service
 *
 * Centralizes all GCS operations:
 *  - upload (buffer or stream)
 *  - download (stream)
 *  - delete
 *  - list files (with prefix)
 *  - generate V4 signed upload URL
 *  - generate V4 signed download URL
 *
 * Object path convention:
 *  users/{userId}/{category}/{uuid}-{safeFilename}
 *  projects/{projectId}/assets/{uuid}-{safeFilename}
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getBucket, getBucketName } = require('../config/storage');

// File size limits (bytes)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  // Videos
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/ogg',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-tar',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
]);

/**
 * Sanitize a filename to prevent path traversal and object-name injection.
 * Returns only the base filename with unsafe characters replaced by hyphens.
 */
function sanitizeFilename(filename) {
  const base = path.basename(filename);
  // Replace any character that is not alphanumeric, dot, hyphen, or underscore
  return base.replace(/[^a-zA-Z0-9.\-_]/g, '-').toLowerCase();
}

/**
 * Build a GCS object name that is:
 *  - unique (UUID prefix)
 *  - safe (sanitized original name as suffix for readability)
 *  - organized by userId/category
 *
 * @param {string} userId
 * @param {string} category  e.g. 'images', 'documents', 'videos', 'uploads'
 * @param {string} originalFilename
 * @returns {string}  GCS object name, e.g. "users/uid123/images/uuid-photo.jpg"
 */
function buildObjectName(userId, category, originalFilename) {
  const safe = sanitizeFilename(originalFilename);
  const id = uuidv4();
  return `users/${userId}/${category}/${id}-${safe}`;
}

/**
 * Validate a file before upload.
 * Throws a structured error object on failure.
 */
function validateFile({ mimetype, size, originalname }) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    const err = new Error(`Unsupported file type: ${mimetype}`);
    err.status = 415;
    err.code = 'UNSUPPORTED_MIME_TYPE';
    throw err;
  }
  if (size > MAX_FILE_SIZE) {
    const err = new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
    err.status = 413;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }
  if (!originalname || originalname.trim() === '') {
    const err = new Error('Filename is required.');
    err.status = 400;
    err.code = 'MISSING_FILENAME';
    throw err;
  }
}

/**
 * Upload a file buffer to GCS.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.category
 * @param {Buffer} params.buffer   File bytes
 * @param {string} params.mimetype
 * @param {string} params.originalname
 * @param {number} params.size
 * @returns {Promise<{objectName: string, bucketName: string, publicUrl: string|null}>}
 */
async function uploadFile({ userId, category, buffer, mimetype, originalname, size }) {
  validateFile({ mimetype, size, originalname });

  const objectName = buildObjectName(userId, category, originalname);
  const bucket = getBucket();
  const file = bucket.file(objectName);

  console.log(`[GCS] Upload started: ${objectName} (${size} bytes, ${mimetype})`);

  await file.save(buffer, {
    metadata: {
      contentType: mimetype,
      metadata: {
        uploadedBy: userId,
        originalName: originalname,
      },
    },
    resumable: size > 5 * 1024 * 1024, // resumable for files > 5MB
  });

  console.log(`[GCS] Upload completed: ${objectName}`);

  return {
    objectName,
    bucketName: getBucketName(),
  };
}

/**
 * Generate a V4 signed URL for direct browser-to-GCS upload (PUT).
 * The frontend uses this URL to upload directly without passing the file through the server.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.category
 * @param {string} params.originalname
 * @param {string} params.mimetype
 * @param {number} params.size
 * @param {number} [params.expiresInMinutes=15]
 * @returns {Promise<{signedUrl: string, objectName: string, bucketName: string}>}
 */
async function generateSignedUploadUrl({
  userId,
  category,
  originalname,
  mimetype,
  size,
  expiresInMinutes = 15,
}) {
  validateFile({ mimetype, size: size || 1, originalname });

  const objectName = buildObjectName(userId, category, originalname);
  const bucket = getBucket();
  const file = bucket.file(objectName);

  const [signedUrl] = await file.generateSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    contentType: mimetype,
  });

  console.log(`[GCS] Signed upload URL generated for object: ${objectName}`);

  return {
    signedUrl,
    objectName,
    bucketName: getBucketName(),
  };
}

/**
 * Generate a V4 signed URL for downloading/reading a private GCS object.
 *
 * @param {string} objectName   GCS object path
 * @param {number} [expiresInMinutes=60]
 * @returns {Promise<string>}  Signed download URL
 */
async function generateSignedDownloadUrl(objectName, expiresInMinutes = 60) {
  const bucket = getBucket();
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error(`Object not found: ${objectName}`);
    err.status = 404;
    err.code = 'OBJECT_NOT_FOUND';
    throw err;
  }

  const [signedUrl] = await file.generateSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  console.log(`[GCS] Signed download URL generated for: ${objectName}`);
  return signedUrl;
}

/**
 * Stream a GCS object directly to an Express response.
 * Use for small files or when signed URLs are not appropriate.
 *
 * @param {string} objectName
 * @param {import('express').Response} res
 */
async function streamFileToResponse(objectName, res) {
  const bucket = getBucket();
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error(`Object not found: ${objectName}`);
    err.status = 404;
    err.code = 'OBJECT_NOT_FOUND';
    throw err;
  }

  const [metadata] = await file.getMetadata();
  res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(objectName)}"`);

  file.createReadStream().pipe(res);
  console.log(`[GCS] Streaming file to response: ${objectName}`);
}

/**
 * Delete a GCS object.
 *
 * @param {string} objectName  GCS object path
 * @returns {Promise<void>}
 */
async function deleteFile(objectName) {
  const bucket = getBucket();
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error(`Object not found: ${objectName}`);
    err.status = 404;
    err.code = 'OBJECT_NOT_FOUND';
    throw err;
  }

  await file.delete();
  console.log(`[GCS] Deleted object: ${objectName}`);
}

/**
 * List GCS objects under a given prefix (virtual folder).
 * Used to list a user's files, a project's assets, etc.
 *
 * @param {string} prefix   e.g. "users/uid123/" or "users/uid123/images/"
 * @param {number} [maxResults=100]
 * @returns {Promise<Array<{name: string, size: string, contentType: string, updated: string}>>}
 */
async function listFiles(prefix, maxResults = 100) {
  const bucket = getBucket();
  const [files] = await bucket.getFiles({ prefix, maxResults });

  return files.map((f) => ({
    name: f.name,
    size: f.metadata.size,
    contentType: f.metadata.contentType,
    updated: f.metadata.updated,
    timeCreated: f.metadata.timeCreated,
  }));
}

module.exports = {
  uploadFile,
  generateSignedUploadUrl,
  generateSignedDownloadUrl,
  streamFileToResponse,
  deleteFile,
  listFiles,
  validateFile,
  buildObjectName,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
