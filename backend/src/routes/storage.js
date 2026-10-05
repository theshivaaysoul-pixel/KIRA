/**
 * Storage Router — Google Drive backend
 *
 * Routes:
 *   POST   /api/storage/upload         → upload file to Google Drive
 *   GET    /api/storage/files          → list user's files (from Firestore metadata)
 *   GET    /api/storage/download/:fileId → stream file from Drive through backend
 *   GET    /api/storage/info/:fileId   → get file metadata only
 *   DELETE /api/storage/:fileId        → delete from Drive + Firestore
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const storageController = require('../controllers/storageController');

const router = express.Router();

// In-memory storage — files go directly to Drive API
// Drive supports up to 5GB per file (limited here to 500MB for server memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB per request
});

// Rate limiting for upload
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many upload requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require Firebase Auth
router.use(requireAuth);

router.post('/upload', uploadRateLimit, upload.single('file'), storageController.uploadFile);
router.get('/files', storageController.listFiles);
router.get('/download/:fileId', storageController.downloadFile);
router.get('/info/:fileId', storageController.getFileInfo);
router.delete('/:fileId', storageController.deleteFile);

module.exports = router;
