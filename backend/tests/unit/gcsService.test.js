/**
 * Unit tests for driveService.js
 *
 * Tests pure helper functions — no actual Drive API calls.
 *
 * Run: npm test
 */

const {
  validateFile,
  buildSafeFilename,
  sanitizeFilename,
  MAX_FILE_SIZE,
} = require('../../src/services/driveService');

// ─── sanitizeFilename ─────────────────────────────────────────────────────────
describe('sanitizeFilename', () => {
  test('removes path traversal attempts', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  test('replaces special characters with hyphens', () => {
    expect(sanitizeFilename('my file (1).jpg')).toBe('my-file--1-.jpg');
  });

  test('lowercases the filename', () => {
    expect(sanitizeFilename('MyPhoto.JPG')).toBe('myphoto.jpg');
  });

  test('keeps alphanumeric, dots, hyphens, underscores', () => {
    expect(sanitizeFilename('report_2024-01-01.pdf')).toBe('report_2024-01-01.pdf');
  });
});

// ─── buildSafeFilename ────────────────────────────────────────────────────────
describe('buildSafeFilename', () => {
  test('produces a UUID-prefixed sanitized name', () => {
    const name = buildSafeFilename('My Photo.jpg');
    expect(name).toMatch(/^[a-f0-9-]{36}-my-photo\.jpg$/);
  });

  test('generates unique names on every call', () => {
    const a = buildSafeFilename('file.pdf');
    const b = buildSafeFilename('file.pdf');
    expect(a).not.toBe(b);
  });
});

// ─── validateFile ─────────────────────────────────────────────────────────────
describe('validateFile', () => {
  const validFile = { mimetype: 'image/jpeg', size: 1024, originalname: 'photo.jpg' };

  test('passes for a valid image', () => {
    expect(() => validateFile(validFile)).not.toThrow();
  });

  test('throws 415 for unsupported MIME type', () => {
    expect(() =>
      validateFile({ ...validFile, mimetype: 'application/x-executable' })
    ).toThrow(expect.objectContaining({ status: 415, code: 'UNSUPPORTED_MIME_TYPE' }));
  });

  test('throws 413 when file exceeds MAX_FILE_SIZE', () => {
    expect(() =>
      validateFile({ ...validFile, size: MAX_FILE_SIZE + 1 })
    ).toThrow(expect.objectContaining({ status: 413, code: 'FILE_TOO_LARGE' }));
  });

  test('throws 400 when filename is empty', () => {
    expect(() =>
      validateFile({ ...validFile, originalname: '' })
    ).toThrow(expect.objectContaining({ status: 400, code: 'MISSING_FILENAME' }));
  });

  test('passes for a valid PDF', () => {
    expect(() =>
      validateFile({ mimetype: 'application/pdf', size: 512000, originalname: 'report.pdf' })
    ).not.toThrow();
  });

  test('passes for a valid video', () => {
    expect(() =>
      validateFile({ mimetype: 'video/mp4', size: 1024 * 1024 * 100, originalname: 'video.mp4' })
    ).not.toThrow();
  });
});
