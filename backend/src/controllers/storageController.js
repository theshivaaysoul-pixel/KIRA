/**
 * Storage Controller — Google Drive backend
 *
 * All file operations delegate to driveService (Google Drive API)
 * and metadataService (Firestore).
 *
 * Drive replaces GCS. There are no signed upload URLs —
 * all uploads are backend-mediated (Drive API requires server-side auth).
 * Downloads are streamed through the backend as an authenticated proxy.
 */

const driveService = require('../services/driveService');
const metadataService = require('../services/metadataService');

/**
 * POST /api/storage/upload
 * Upload a file through the backend to Google Drive.
 * Body: multipart/form-data with field "file" and optional "category"
 */
async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided.' });
    }

    const userId = req.user.uid;
    const category = req.body.category || 'uploads';
    const { buffer, mimetype, originalname, size } = req.file;

    const { driveFileId, driveName } = await driveService.uploadFile({
      userId,
      category,
      buffer,
      mimetype,
      originalname,
      size,
    });

    const metadata = await metadataService.createFileMetadata({
      userId,
      originalName: originalname,
      storageObjectName: driveFileId,  // Drive file ID stored as the reference
      bucketName: 'google-drive',      // logical label
      mimeType: mimetype,
      size,
      category,
    });

    res.status(201).json({
      success: true,
      file: {
        fileId: metadata.fileId,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        category: metadata.category,
        createdAt: metadata.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/storage/files
 * List all files for the authenticated user.
 * Query params: ?category=images
 */
async function listFiles(req, res, next) {
  try {
    const userId = req.user.uid;
    const { category } = req.query;

    const files = await metadataService.listFileMetadataByUser(userId, category);
    res.json({ success: true, files });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/storage/download/:fileId
 * Stream a file from Google Drive through the backend to the client.
 * The backend acts as an authenticated proxy —
 * the browser never needs a Drive token.
 */
async function downloadFile(req, res, next) {
  try {
    const userId = req.user.uid;
    const { fileId } = req.params;

    const metadata = await metadataService.getFileMetadata(fileId);

    if (!metadata) {
      return res.status(404).json({ success: false, error: 'File not found.' });
    }

    // Authorization: only the owner can download
    if (metadata.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    await driveService.streamFileToResponse(metadata.storageObjectName, res);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/storage/info/:fileId
 * Get file metadata (without downloading the file).
 */
async function getFileInfo(req, res, next) {
  try {
    const userId = req.user.uid;
    const { fileId } = req.params;

    const metadata = await metadataService.getFileMetadata(fileId);

    if (!metadata) {
      return res.status(404).json({ success: false, error: 'File not found.' });
    }

    if (metadata.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    res.json({ success: true, file: metadata });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/storage/:fileId
 * Delete a file from Google Drive and remove its Firestore metadata.
 */
async function deleteFile(req, res, next) {
  try {
    const userId = req.user.uid;
    const { fileId } = req.params;

    const metadata = await metadataService.getFileMetadata(fileId);

    if (!metadata) {
      return res.status(404).json({ success: false, error: 'File not found.' });
    }

    // Authorization: only the owner can delete
    if (metadata.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    await driveService.deleteFile(metadata.storageObjectName);
    await metadataService.deleteFileMetadata(fileId);

    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadFile,
  listFiles,
  downloadFile,
  getFileInfo,
  deleteFile,
};
