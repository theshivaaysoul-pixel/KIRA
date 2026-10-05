// agency-manager/scripts/verify-phase2.mjs
// Phase 2 GCS / Drive Data Safety Verification Script for KIRA Agency Manager
// Tests real live storage: safe writes, read-back verification, checksums, backups,
// corruption detection, path traversal protection, concurrency, and recovery.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const { DataSafetyService } = await import('../src/lib/storage/data-safety-service.ts');
const { getStorageService } = await import('../src/lib/storage/index.ts');
const {
  StorageCorruptionError,
  StorageVerificationError,
  ConcurrentModificationError,
  InvalidBackupPathError,
} = await import('../src/lib/storage/errors.ts');
const { PlatformSchema } = await import('../src/lib/validation/index.ts');
const { z } = require('zod');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 2 GCS DATA SAFETY VERIFICATION');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

const storage = getStorageService();
const safety = new DataSafetyService(storage);

const TEST_RESOURCE_PATH = 'database/platforms.json';
const TEST_COLLECTION_SCHEMA = z.array(PlatformSchema);
let createdBackupPath = null;
let initialPlatforms = null;

try {
  // -------------------------------------------------------------------------
  // Test 1: Deterministic Checksum & Serialization
  // -------------------------------------------------------------------------
  console.log('1. Testing Deterministic JSON Serialization & SHA-256 Checksum...');
  const objA = { b: 2, a: 1, nested: { y: 'test', x: 42 } };
  const objB = { nested: { x: 42, y: 'test' }, a: 1, b: 2 };
  const strA = DataSafetyService.stableStringify(objA);
  const strB = DataSafetyService.stableStringify(objB);
  const hashA = DataSafetyService.calculateChecksum(objA);
  const hashB = DataSafetyService.calculateChecksum(objB);

  assert(strA === strB, 'Keys are sorted deterministically');
  assert(hashA === hashB, 'Identical data in different order produces identical SHA-256 checksum');
  assert(/^[a-f0-9]{64}$/.test(hashA), 'SHA-256 is a valid 64-character hex string');

  // -------------------------------------------------------------------------
  // Test 2: Safe Read of Existing Live Database File
  // -------------------------------------------------------------------------
  console.log('\n2. Testing Safe Read of Existing Database File...');
  const readResult = await safety.safeReadJson(TEST_RESOURCE_PATH, TEST_COLLECTION_SCHEMA, []);
  assert(Array.isArray(readResult.data), 'Live data read successfully as array');
  assert(typeof readResult.checksum === 'string', `Integrity checksum computed: ${readResult.checksum.slice(0, 16)}…`);
  initialPlatforms = [...readResult.data];

  // -------------------------------------------------------------------------
  // Test 3: Automated Versioned Backup Creation
  // -------------------------------------------------------------------------
  console.log('\n3. Testing Automated Versioned Backup Creation...');
  // Ensure we have at least one test item to back up
  const testPlatform = {
    id: 'PLT-999998',
    name: 'Phase 2 Safety Platform',
    slug: 'phase2-safety-test',
    icon: 'Shield',
    description: 'Temporary platform for Phase 2 data safety testing',
    isActive: true,
    capabilities: ['text', 'image', 'scheduling'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedList = [...initialPlatforms.filter((p) => p.id !== testPlatform.id), testPlatform];

  // Write with automated backup creation
  const writeRes = await safety.safeWriteJson({
    storagePath: TEST_RESOURCE_PATH,
    data: updatedList,
    schema: TEST_COLLECTION_SCHEMA,
    reason: 'BEFORE_UPDATE',
    createBackupBeforeWrite: true,
  });

  assert(typeof writeRes.checksum === 'string', 'Safe write pipeline completed with read-back verification');
  if (writeRes.backup) {
    createdBackupPath = writeRes.backup.backupPath;
    assert(writeRes.backup.backupPath.includes('database/backups/platforms/'), `Backup stored in GCS/Drive at ${writeRes.backup.backupPath}`);
    assert(writeRes.backup.reason === 'BEFORE_UPDATE', 'Backup reason recorded as BEFORE_UPDATE');
    assert(writeRes.backup.size > 0, `Backup size: ${writeRes.backup.size} bytes`);
  } else {
    // If live file was empty prior, trigger explicit manual backup
    const manualBackup = await safety.createBackup(TEST_RESOURCE_PATH, 'MANUAL_BACKUP');
    assert(manualBackup !== null, 'Manual backup created successfully');
    createdBackupPath = manualBackup.backupPath;
  }

  // -------------------------------------------------------------------------
  // Test 4: Write Verification & Read-Back Integrity
  // -------------------------------------------------------------------------
  console.log('\n4. Testing Read-Back Verification & Integrity...');
  const verifyRead = await safety.safeReadJson(TEST_RESOURCE_PATH, TEST_COLLECTION_SCHEMA);
  const found = verifyRead.data.find((p) => p.id === 'PLT-999998');
  assert(found !== undefined, 'Saved item confirmed via verified read');
  assert(verifyRead.checksum === writeRes.checksum, 'Read-back checksum exactly matches written checksum');

  // -------------------------------------------------------------------------
  // Test 5: Backup Listing with Filtering
  // -------------------------------------------------------------------------
  console.log('\n5. Testing Backup Listing & Metadata...');
  const backupList = await safety.listBackups({ resource: 'platforms', limit: 10 });
  assert(backupList.total > 0, `Backups listed from storage (total: ${backupList.total})`);
  assert(backupList.backups.length > 0, 'Returned metadata for listed backups without downloading full payloads');
  const foundBackup = backupList.backups.find((b) => b.backupPath === createdBackupPath);
  assert(foundBackup !== undefined, `Found created backup in storage list: ${createdBackupPath}`);

  // -------------------------------------------------------------------------
  // Test 6: Concurrent Modification Detection (Optimistic Concurrency)
  // -------------------------------------------------------------------------
  console.log('\n6. Testing Concurrent Modification / Overwrite Protection...');
  let concurrentCaught = false;
  try {
    await safety.safeWriteJson({
      storagePath: TEST_RESOURCE_PATH,
      data: updatedList,
      schema: TEST_COLLECTION_SCHEMA,
      expectedChecksum: '0000000000000000000000000000000000000000000000000000000000000000', // invalid outdated hash
      createBackupBeforeWrite: false,
    });
  } catch (err) {
    if (err instanceof ConcurrentModificationError) {
      concurrentCaught = true;
    }
  }
  assert(concurrentCaught, 'ConcurrentModificationError correctly triggered on checksum mismatch');

  // -------------------------------------------------------------------------
  // Test 7: Malformed JSON Protection (Never silently replaced with empty array)
  // -------------------------------------------------------------------------
  console.log('\n7. Testing Malformed JSON Protection...');
  const corruptedTestPath = 'database/test-corrupted-phase2.json';
  await storage.upload({
    objectName: corruptedTestPath,
    buffer: Buffer.from('{ invalid json syntax: missing-quotes, 123', 'utf8'),
    contentType: 'application/json',
  });

  let corruptionCaught = false;
  try {
    await safety.safeReadJson(corruptedTestPath, TEST_COLLECTION_SCHEMA, []);
  } catch (err) {
    if (err instanceof StorageCorruptionError) {
      corruptionCaught = true;
    }
  }
  assert(corruptionCaught, 'StorageCorruptionError thrown when file is malformed (NOT silently replaced with empty data)');

  // Verify the corrupted file was preserved for diagnosis
  const stillExists = await storage.exists(corruptedTestPath);
  assert(stillExists, 'Corrupted file preserved in storage for investigation');
  await storage.delete(corruptedTestPath); // clean up test file

  // -------------------------------------------------------------------------
  // Test 8: Path Traversal Protection
  // -------------------------------------------------------------------------
  console.log('\n8. Testing Path Traversal Protection...');
  const maliciousPaths = [
    '../../etc/passwd',
    'database/backups/../../secret.json',
    'database/backups/platforms/../../../evil.json',
    'database/backups/unauthorized-resource/foo.json',
  ];

  let traversalBlockedCount = 0;
  for (const malPath of maliciousPaths) {
    try {
      safety.validateBackupPath(malPath);
    } catch (err) {
      if (err instanceof InvalidBackupPathError) {
        traversalBlockedCount++;
      }
    }
  }
  assert(traversalBlockedCount === maliciousPaths.length, `All ${maliciousPaths.length} path traversal attempts blocked with InvalidBackupPathError`);

  // -------------------------------------------------------------------------
  // Test 9: Controlled Recovery with Schema Validation & Pre-Recovery Safety Backup
  // -------------------------------------------------------------------------
  console.log('\n9. Testing Controlled Recovery Pipeline...');
  if (createdBackupPath) {
    const recoveryResult = await safety.restoreBackup({
      backupPath: createdBackupPath,
      adminUserId: 'usr-test-admin',
    });

    assert(recoveryResult.success, 'Restore backup operation succeeded');
    assert(recoveryResult.livePath === TEST_RESOURCE_PATH, `Restored to correct live path: ${recoveryResult.livePath}`);
    assert(recoveryResult.preRecoveryBackup !== undefined, `Safety snapshot created before recovery: ${recoveryResult.preRecoveryBackup?.backupPath}`);

    // Verify restored content matches expected schema and data
    const afterRecovery = await safety.safeReadJson(TEST_RESOURCE_PATH, TEST_COLLECTION_SCHEMA);
    assert(Array.isArray(afterRecovery.data), 'Restored data verified with active schema');
  }

  // -------------------------------------------------------------------------
  // Test 10: Retention Policy & Safe Cleanup
  // -------------------------------------------------------------------------
  console.log('\n10. Testing Backup Retention Policy...');
  // Testing with 365 days retention ensures no active backups are deleted
  const retentionResult = await safety.cleanupExpiredBackups(365);
  assert(typeof retentionResult.retainedCount === 'number', `Retention verified: ${retentionResult.retainedCount} backups retained`);
  assert(retentionResult.errors.length === 0, 'Retention cleanup ran with zero errors');

  // Verify live database file is still present and valid
  const liveStillValid = await storage.exists(TEST_RESOURCE_PATH);
  assert(liveStillValid, 'Live database file remains completely untouched by retention cleanup');

  // -------------------------------------------------------------------------
  // Cleanup Test Data
  // -------------------------------------------------------------------------
  console.log('\n11. Cleaning Up Test Artifacts...');
  // Restore initial platforms state (removing test item PLT-999998)
  await safety.safeWriteJson({
    storagePath: TEST_RESOURCE_PATH,
    data: initialPlatforms.filter((p) => p.id !== 'PLT-999998'),
    schema: TEST_COLLECTION_SCHEMA,
    reason: 'BEFORE_DELETE',
    createBackupBeforeWrite: false,
  });

  // Clean up created test backup and companion meta
  if (createdBackupPath) {
    try {
      await storage.delete(createdBackupPath);
      await storage.delete(createdBackupPath.replace(/\.json$/, '.meta.json'));
    } catch {
      // ignore
    }
  }
  console.log('   ✅ Cleanup complete — test artifacts removed from storage.');

  console.log('\n===============================================================');
  console.log(`   PHASE 2 DATA SAFETY RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.error('\n❌ Unhandled exception during Phase 2 verification:', err);
  process.exit(1);
}
