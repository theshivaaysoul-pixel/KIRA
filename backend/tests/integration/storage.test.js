/**
 * Integration tests for Storage API routes — Google Drive backend
 *
 * Firebase Admin SDK and Google Drive service are mocked.
 * No actual network calls are made.
 *
 * Run: npm test
 */

// ─── Mock Firebase Admin ──────────────────────────────────────────────────────
jest.mock('../../src/config/firebase', () => ({
  initializeFirebase: jest.fn(),
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(async (token) => {
      if (token === 'valid-token') return { uid: 'test-user-123', email: 'test@example.com' };
      throw new Error('Invalid token');
    }),
  })),
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(async () => {}),
        get: jest.fn(async () => ({
          exists: true,
          data: () => ({
            fileId: 'file-uuid-1',
            userId: 'test-user-123',
            originalName: 'test.jpg',
            storageObjectName: 'drive-file-id-abc123',
            bucketName: 'google-drive',
            mimeType: 'image/jpeg',
            size: 1024,
            category: 'images',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        })),
        delete: jest.fn(async () => {}),
        update: jest.fn(async () => {}),
      })),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(async () => ({
        docs: [
          {
            data: () => ({
              fileId: 'file-uuid-1',
              userId: 'test-user-123',
              originalName: 'test.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              category: 'images',
            }),
          },
        ],
      })),
    })),
  })),
}));

// ─── Mock Drive service ───────────────────────────────────────────────────────
jest.mock('../../src/services/driveService', () => ({
  ...jest.requireActual('../../src/services/driveService'),
  uploadFile: jest.fn(async () => ({
    driveFileId: 'drive-file-id-abc123',
    driveName: 'uuid-test.jpg',
    webViewLink: 'https://drive.google.com/file/d/abc123/view',
  })),
  streamFileToResponse: jest.fn(async (driveFileId, res) => {
    res.setHeader('Content-Type', 'image/jpeg');
    res.end('binary-data');
  }),
  deleteFile: jest.fn(async () => {}),
  listUserFiles: jest.fn(async () => []),
}));

const request = require('supertest');
const app = require('../../src/app');

const AUTH_HEADER = { Authorization: 'Bearer valid-token' };
const INVALID_AUTH = { Authorization: 'Bearer invalid-token' };

// ─── Health Check ─────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── Authentication ───────────────────────────────────────────────────────────
describe('Auth middleware', () => {
  test('rejects requests with no token (401)', async () => {
    const res = await request(app).get('/api/storage/files');
    expect(res.status).toBe(401);
  });

  test('rejects requests with invalid token (401)', async () => {
    const res = await request(app).get('/api/storage/files').set(INVALID_AUTH);
    expect(res.status).toBe(401);
  });
});

// ─── Upload ───────────────────────────────────────────────────────────────────
describe('POST /api/storage/upload', () => {
  test('uploads a valid image file', async () => {
    const res = await request(app)
      .post('/api/storage/upload')
      .set(AUTH_HEADER)
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .field('category', 'images');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.file).toBeDefined();
    expect(res.body.file.fileId).toBeDefined();
  });

  test('rejects when no file is provided (400)', async () => {
    const res = await request(app)
      .post('/api/storage/upload')
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects an unsupported MIME type (415)', async () => {
    const driveService = require('../../src/services/driveService');
    driveService.uploadFile.mockRejectedValueOnce(
      Object.assign(new Error('Unsupported MIME type'), { status: 415, code: 'UNSUPPORTED_MIME_TYPE' })
    );

    const res = await request(app)
      .post('/api/storage/upload')
      .set(AUTH_HEADER)
      .attach('file', Buffer.from('exe'), {
        filename: 'malware.exe',
        contentType: 'application/x-executable',
      });

    expect(res.status).toBe(415);
  });
});

// ─── List Files ───────────────────────────────────────────────────────────────
describe('GET /api/storage/files', () => {
  test('returns list of user files', async () => {
    const res = await request(app).get('/api/storage/files').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
  });
});

// ─── Download ─────────────────────────────────────────────────────────────────
describe('GET /api/storage/download/:fileId', () => {
  test('streams file for an owned file', async () => {
    const res = await request(app)
      .get('/api/storage/download/file-uuid-1')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  test('returns 403 for a file owned by another user', async () => {
    const metadataService = require('../../src/services/metadataService');
    jest.spyOn(metadataService, 'getFileMetadata').mockResolvedValueOnce({
      fileId: 'other-file',
      userId: 'other-user',
      storageObjectName: 'drive-file-id-xyz',
    });

    const res = await request(app)
      .get('/api/storage/download/other-file')
      .set(AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  test('returns 404 for a non-existent file', async () => {
    const metadataService = require('../../src/services/metadataService');
    jest.spyOn(metadataService, 'getFileMetadata').mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/storage/download/nonexistent')
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────
describe('DELETE /api/storage/:fileId', () => {
  test('deletes an owned file successfully', async () => {
    const res = await request(app)
      .delete('/api/storage/file-uuid-1')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("returns 403 when deleting another user's file", async () => {
    const metadataService = require('../../src/services/metadataService');
    jest.spyOn(metadataService, 'getFileMetadata').mockResolvedValueOnce({
      fileId: 'other-file',
      userId: 'other-user',
      storageObjectName: 'drive-id-xyz',
    });

    const res = await request(app)
      .delete('/api/storage/other-file')
      .set(AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  test('returns 401 for unauthenticated delete', async () => {
    const res = await request(app).delete('/api/storage/file-uuid-1');
    expect(res.status).toBe(401);
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  test('returns 404 for unknown path', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
  });
});
