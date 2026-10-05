/**
 * Google Drive Storage Service
 *
 * All file operations use YOUR Google Drive (5TB Google One quota).
 * Files are stored in a dedicated app folder structure:
 *
 *   KIRA/                        ← root app folder in your Drive
 *     users/
 *       {userId}/
 *         images/
 *         documents/
 *         videos/
 *         uploads/
 *         audio/
 *
 * Operations:
 *  - uploadFile       → upload buffer to Drive
 *  - downloadFile     → get a readable stream from Drive
 *  - deleteFile       → permanently delete a Drive file
 *  - listFiles        → list files in a user's folder
 *  - getDownloadUrl   → get a temporary authenticated download URL
 *  - getOrCreateFolder → ensures folder path exists (creates if not)
 *
 * File IDs from Drive are stored in Firestore as the reference.
 */

const path = require('path');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { getDriveClient } = require('../config/storage');

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_ROOT_FOLDER_NAME = 'KIRA';
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB per file (Drive supports this)

// MIME type allowlist
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/bmp', 'image/tiff',
  // Videos
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
  'video/webm', 'video/ogg',
  // Documents
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'application/json',
  'application/zip', 'application/x-tar',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize a filename to prevent path traversal and injection.
 */
function sanitizeFilename(filename) {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9.\-_]/g, '-').toLowerCase();
}

/**
 * Build a safe, unique filename with a UUID prefix.
 */
function buildSafeFilename(originalFilename) {
  const safe = sanitizeFilename(originalFilename);
  return `${uuidv4()}-${safe}`;
}

/**
 * Validate a file before upload.
 * Throws a structured error on failure.
 */
function validateFile({ mimetype, size, originalname }) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    const err = new Error(`Unsupported file type: ${mimetype}`);
    err.status = 415;
    err.code = 'UNSUPPORTED_MIME_TYPE';
    throw err;
  }
  if (size > MAX_FILE_SIZE) {
    const err = new Error(`File too large. Maximum size is 5 GB.`);
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

// ─── Folder Management ────────────────────────────────────────────────────────

// In-memory cache of folder IDs to avoid repeated Drive API lookups
const folderCache = new Map();

/**
 * Find a Drive folder by name within a parent folder.
 * Returns the folder ID if found, null otherwise.
 */
async function findFolder(name, parentId) {
  const drive = getDriveClient();
  const cacheKey = `${parentId}/${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const folder = res.data.files?.[0];
  if (folder) {
    folderCache.set(cacheKey, folder.id);
    return folder.id;
  }
  return null;
}

/**
 * Create a Drive folder inside a parent.
 * Returns the new folder ID.
 */
async function createFolder(name, parentId) {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  const id = res.data.id;
  folderCache.set(`${parentId}/${name}`, id);
  return id;
}

/**
 * Get or create a folder by name inside a parent.
 * Returns the folder ID.
 */
async function getOrCreateFolder(name, parentId) {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

/**
 * Get or create the entire folder path for a user + category.
 * Creates: KIRA/ → users/ → {userId}/ → {category}/
 *
 * @param {string} userId
 * @param {string} category  e.g. 'images', 'documents', 'videos'
 * @returns {Promise<string>}  The Drive folder ID for uploads
 */
async function ensureUserCategoryFolder(userId, category) {
  // Get Drive root ('root' is the special Drive root ID)
  const kiraId = await getOrCreateFolder(APP_ROOT_FOLDER_NAME, 'root');
  const usersId = await getOrCreateFolder('users', kiraId);
  const userFolderId = await getOrCreateFolder(userId, usersId);
  const categoryFolderId = await getOrCreateFolder(category, userFolderId);
  return categoryFolderId;
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Upload a file buffer to Google Drive.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.category
 * @param {Buffer} params.buffer
 * @param {string} params.mimetype
 * @param {string} params.originalname
 * @param {number} params.size
 * @returns {Promise<{driveFileId: string, driveName: string, webViewLink: string}>}
 */
async function uploadFile({ userId, category, buffer, mimetype, originalname, size }) {
  validateFile({ mimetype, size, originalname });

  const folderId = await ensureUserCategoryFolder(userId, category);
  const safeName = buildSafeFilename(originalname);
  const drive = getDriveClient();

  console.log(`[Drive] Upload started: ${safeName} (${size} bytes, ${mimetype}) → folder ${folderId}`);

  // Convert buffer to readable stream for Drive API
  const bufferStream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: safeName,
      parents: [folderId],
      description: JSON.stringify({ originalName: originalname, uploadedBy: userId }),
    },
    media: {
      mimeType: mimetype,
      body: bufferStream,
    },
    fields: 'id, name, webViewLink, size, mimeType',
  });

  const file = res.data;
  console.log(`[Drive] Upload completed: ${safeName} (Drive ID: ${file.id})`);

  return {
    driveFileId: file.id,
    driveName: safeName,
    webViewLink: file.webViewLink,
  };
}

/**
 * Get a short-lived download URL for a Drive file.
 * Sets the file to be readable by "anyone with the link" temporarily,
 * then returns the Drive download URL.
 *
 * NOTE: For private files, we stream through the backend instead (see streamFileToResponse).
 * Use this only for temporary sharing.
 *
 * @param {string} driveFileId
 * @returns {Promise<string>}  Direct download URL (requires auth header)
 */
async function getDownloadUrl(driveFileId) {
  // Return the authenticated download URL — backend adds auth via googleapis
  return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
}

/**
 * Stream a Google Drive file directly to an Express response.
 * The backend acts as an authenticated proxy — the browser never
 * needs a Drive token.
 *
 * @param {string} driveFileId
 * @param {import('express').Response} res
 */
async function streamFileToResponse(driveFileId, res) {
  const drive = getDriveClient();

  // First get metadata for content-type and filename
  const meta = await drive.files.get({
    fileId: driveFileId,
    fields: 'name, mimeType, size',
  });

  const { name, mimeType, size } = meta.data;

  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  if (size) res.setHeader('Content-Length', size);

  // Stream the file content
  const fileRes = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'stream' }
  );

  fileRes.data.pipe(res);
  console.log(`[Drive] Streaming file to response: ${name} (${driveFileId})`);
}

/**
 * Delete a file from Google Drive.
 *
 * @param {string} driveFileId
 * @returns {Promise<void>}
 */
async function deleteFile(driveFileId) {
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId: driveFileId });
    console.log(`[Drive] Deleted file: ${driveFileId}`);
  } catch (err) {
    if (err.code === 404 || err.status === 404) {
      const e = new Error(`File not found in Drive: ${driveFileId}`);
      e.status = 404;
      e.code = 'FILE_NOT_FOUND';
      throw e;
    }
    throw err;
  }
}

/**
 * List Drive files in a user's folder (by category, optional).
 *
 * @param {string} userId
 * @param {string} [category]
 * @returns {Promise<Array<{driveFileId, name, mimeType, size, modifiedTime}>>}
 */
async function listUserFiles(userId, category) {
  const drive = getDriveClient();

  // Build the folder path to query
  let folderId;
  try {
    const kiraId = await findFolder(APP_ROOT_FOLDER_NAME, 'root');
    if (!kiraId) return [];
    const usersId = await findFolder('users', kiraId);
    if (!usersId) return [];
    const userFolderId = await findFolder(userId, usersId);
    if (!userFolderId) return [];

    if (category) {
      folderId = await findFolder(category, userFolderId);
      if (!folderId) return [];
    } else {
      folderId = userFolderId;
    }
  } catch {
    return [];
  }

  const q = category
    ? `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`
    : `'${folderId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, size, modifiedTime, description)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
  });

  return (res.data.files || []).map((f) => ({
    driveFileId: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? parseInt(f.size) : 0,
    modifiedTime: f.modifiedTime,
  }));
}

module.exports = {
  uploadFile,
  getDownloadUrl,
  streamFileToResponse,
  deleteFile,
  listUserFiles,
  validateFile,
  buildSafeFilename,
  sanitizeFilename,
  ensureUserCategoryFolder,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
