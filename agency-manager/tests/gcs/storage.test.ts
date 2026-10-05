// tests/gcs/storage.test.ts
// GCS Storage Integration Tests: Health check, CRUD operations, DataSafetyService backups, and cleanup.

import { harness } from '../test-helper';
import { getStorageService, getDataSafetyService } from '@/lib/storage';
import { DataSafetyService } from '@/lib/storage/data-safety-service';
import { InvalidBackupPathError } from '@/lib/storage/errors';

export async function runStorageTests(): Promise<void> {
  harness.setSuite('GCS Storage Integration Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: GCS Storage Integration Tests');
  console.log('===============================================================\n');

  const storage = getStorageService();
  const safetyService = getDataSafetyService();

  // ─── 1. Storage Health Diagnostic ───────────────────────────────────────────
  await harness.runTest('GCS Storage: Health check write/read/delete cycle passes', async () => {
    const health = await storage.healthCheck();
    harness.assert(health.connection, 'GCS connection ok');
    harness.assert(health.bucketAccess, 'Bucket access verified');
    harness.assert(health.readTest, 'Read test verified');
    harness.assert(health.writeTest, 'Write test verified');
    harness.assert(health.deleteTest, 'Delete test verified');
  });

  // ─── 2. Dedicated Test Object Upload, Download, and Cleanup ─────────────────
  await harness.runTest('GCS Storage: Dedicated test file roundtrip with verified deletion', async () => {
    const timestamp = Date.now();
    const testObjectName = `test/qa-storage-${timestamp}.txt`;
    const testContent = `KIRA QA Test Run - Storage Verification - ${timestamp}`;
    const testBuffer = Buffer.from(testContent, 'utf8');

    // 1. Upload test buffer
    await storage.upload({
      objectName: testObjectName,
      buffer: testBuffer,
      contentType: 'text/plain',
    });

    // 2. Exists check
    const existsBefore = await storage.exists(testObjectName);
    harness.assertEqual(existsBefore, true, 'Test object confirmed present in GCS storage');

    // 3. Download and verify content
    const downloadedBuffer = await storage.download(testObjectName);
    const downloadedText = downloadedBuffer.toString('utf8');
    harness.assertEqual(downloadedText, testContent, 'Downloaded object content exactly matches uploaded buffer');

    // 4. Delete
    await storage.delete(testObjectName);

    // 5. Verify cleanup
    const existsAfter = await storage.exists(testObjectName);
    harness.assertEqual(existsAfter, false, 'Test object cleanly removed from storage');
  });

  // ─── 3. DataSafetyService Cryptographic Checksums & Path Validation ─────────
  await harness.runTest('DataSafetyService: Cryptographic SHA-256 hash computation', () => {
    const data = Buffer.from('test data string');
    const hash1 = DataSafetyService.calculateChecksum(data);
    const hash2 = DataSafetyService.calculateChecksum(data);
    harness.assertEqual(hash1, hash2, 'SHA-256 computation is deterministic');
    harness.assertEqual(hash1.length, 64, 'SHA-256 produces 64-character hex string');
  });

  await harness.runTest('DataSafetyService: validateBackupPath rejects illegal traversal sequences', () => {
    // Parent directory traversal
    harness.assert(
      (() => {
        try {
          safetyService.validateBackupPath('database/backups/../../platforms.json');
          return false;
        } catch (err) {
          return err instanceof InvalidBackupPathError;
        }
      })(),
      'Blocked ".." traversal'
    );

    // Backslash traversal
    harness.assert(
      (() => {
        try {
          safetyService.validateBackupPath('database\\backups\\platforms\\platforms-123.json');
          return false;
        } catch (err) {
          return err instanceof InvalidBackupPathError;
        }
      })(),
      'Blocked backslash traversal'
    );

    // Absolute path
    harness.assert(
      (() => {
        try {
          safetyService.validateBackupPath('/etc/passwd');
          return false;
        } catch (err) {
          return err instanceof InvalidBackupPathError;
        }
      })(),
      'Blocked leading slash absolute path'
    );

    // Valid path format
    const valid = safetyService.validateBackupPath('database/backups/platforms/platforms-1700000000000.json');
    harness.assertEqual(valid.isValid, true, 'Valid backup path accepted');
    harness.assertEqual(valid.resource, 'platforms', 'Correct resource parsed');
  });
}
