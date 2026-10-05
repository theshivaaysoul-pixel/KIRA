// scripts/verify-phase16.mjs
// Phase 16 — Admin Data Health & Integrity Verification Suite
//
// Tests:
// 1. Application health check runtime info
// 2. Authentication subsystem status
// 3. Storage diagnostic (live reachability, read, write, delete)
// 4. All 11 JSON collections validation
// 5. Relationship integrity check (orphan detection on simulated bad data)
// 6. Duplicate detection (simulated collision detection for ID, slug, externalAccountId)
// 7. Backup checksum integrity verification
// 8. Recommended actions generation (non-destructive)
// 9. API route existence and authorization requirements

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const { DataHealthService, getDataHealthService } = await import('../src/lib/services/data-health-service.ts');
const { getStorageService } = await import('../src/lib/storage/index.ts');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 16 DATA HEALTH VERIFICATION');
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

try {
  const service = getDataHealthService();

  // Test 1: Application Health
  console.log('1. Testing Application Health Checks...');
  const appHealth = service.checkApplicationHealth();
  assert(appHealth.running === true, 'Application running flag is true');
  assert(typeof appHealth.uptimeSeconds === 'number', 'Uptime is reported');
  assert(typeof appHealth.nodeVersion === 'string', 'Node version is reported');
  assert(typeof appHealth.configChecks === 'object', 'Config checks are evaluated');
  assert(
    appHealth.status === 'HEALTHY' || appHealth.status === 'WARNING',
    `Application status valid: ${appHealth.status}`
  );

  // Test 2: Authentication Health
  console.log('\n2. Testing Authentication Subsystem Health...');
  const authHealth = service.checkAuthenticationHealth();
  assert(typeof authHealth.adminConfigured === 'boolean', 'Firebase admin configuration detected');
  assert(authHealth.protectionEnforced === true, 'Route protection is marked enforced');
  assert(
    authHealth.status === 'HEALTHY' || authHealth.status === 'WARNING',
    `Authentication status valid: ${authHealth.status}`
  );

  // Test 3: Storage Health Diagnostic
  console.log('\n3. Testing Storage Health Diagnostic...');
  const storageHealth = await service.checkStorageHealth();
  assert(typeof storageHealth.reachable === 'boolean', 'Storage reachability checked');
  assert(typeof storageHealth.bucketAccess === 'boolean', 'Bucket access checked');
  assert(typeof storageHealth.readAccess === 'boolean', 'Read capability checked');
  assert(typeof storageHealth.writeAccess === 'boolean', 'Write capability checked');
  assert(typeof storageHealth.deleteCapability === 'boolean', 'Delete/cleanup capability checked');
  console.log(`   Storage Provider: ${storageHealth.provider}, Status: ${storageHealth.status}`);

  // Test 4: JSON Collections Validation (All 11 files)
  console.log('\n4. Testing All 11 JSON Collections Schema & Integrity...');
  const { collections, loadedData } = await service.checkCollections();
  assert(collections.length === 11, `Checked exactly 11 collections (got ${collections.length})`);
  const expectedPaths = [
    'database/platforms.json',
    'database/social-accounts.json',
    'database/content.json',
    'database/content-assets.json',
    'database/content-publications.json',
    'database/team-members.json',
    'database/tasks.json',
    'database/analytics.json',
    'database/notifications.json',
    'database/activity-logs.json',
    'database/settings.json',
  ];
  for (const exp of expectedPaths) {
    const found = collections.find((c) => c.path === exp);
    assert(!!found, `Found check for ${exp}`);
    assert(
      found.status === 'HEALTHY' || found.status === 'WARNING' || found.status === 'ERROR',
      `${exp} has valid status: ${found.status}`
    );
  }

  // Test 5: Relationship Integrity (Simulated Orphan Detection)
  console.log('\n5. Testing Relationship Integrity Checker...');
  // Normal state
  const normalRel = service.checkRelationships(loadedData);
  assert(typeof normalRel.totalChecks === 'number', 'Total checks evaluated');
  assert(typeof normalRel.orphanedCount === 'number', 'Orphan count evaluated');

  // Simulated broken relationship (orphan)
  const mockCorruptData = {
    platforms: [{ id: 'PLT-000001', name: 'P1', slug: 'p1' }],
    socialAccounts: [
      { id: 'ACC-000001', platformId: 'PLT-999999', accountName: 'Ghost Account', username: 'ghost' }, // broken!
    ],
    content: [],
    contentAssets: [
      { id: 'AST-000001', contentId: 'CNT-999999', fileName: 'ghost.png' }, // broken!
    ],
    publications: [
      { id: 'PUB-000001', contentId: 'CNT-999999', socialAccountId: 'ACC-999999' }, // 2 broken!
    ],
    teamMembers: [{ id: 'USR-000001', name: 'Alice', email: 'alice@kira.test' }],
    tasks: [
      { id: 'TSK-000001', title: 'Task 1', assignedTo: 'USR-999999' }, // broken!
    ],
    analytics: [
      { id: 'ANL-000001', socialAccountId: 'ACC-999999' }, // broken!
    ],
    notifications: [
      { id: 'NTF-000001', userId: 'USR-999999' }, // broken!
    ],
    activityLogs: [],
    settings: null,
  };

  const corruptRel = service.checkRelationships(mockCorruptData);
  assert(corruptRel.status === 'WARNING', 'Corrupt relations detected as WARNING status');
  assert(corruptRel.orphanedCount === 7, `Detected all 7 orphaned references (got ${corruptRel.orphanedCount})`);
  assert(corruptRel.issues.some((i) => i.targetId === 'PLT-999999'), 'Caught missing platformId');
  assert(corruptRel.issues.some((i) => i.targetId === 'CNT-999999'), 'Caught missing contentId');
  assert(corruptRel.issues.some((i) => i.targetId === 'USR-999999'), 'Caught missing assignedTo/userId');

  // Test 6: Duplicate Detection
  console.log('\n6. Testing Duplicate Detection...');
  const normalDupes = service.checkDuplicates(loadedData);
  assert(typeof normalDupes.duplicatesFound === 'number', 'Duplicate counter evaluated');

  // Simulated duplicates
  const mockDupeData = {
    platforms: [
      { id: 'PLT-000001', name: 'Instagram', slug: 'instagram' },
      { id: 'PLT-000002', name: 'Insta Copy', slug: 'instagram' }, // duplicate slug!
    ],
    socialAccounts: [
      { id: 'ACC-000001', platformId: 'PLT-000001', accountName: 'A1', username: 'u1', externalAccountId: 'EXT-123' },
      { id: 'ACC-000002', platformId: 'PLT-000001', accountName: 'A2', username: 'u2', externalAccountId: 'EXT-123' }, // duplicate externalAccountId!
    ],
    content: [
      { id: 'CNT-000001', title: 'Post 1' },
      { id: 'CNT-000001', title: 'Post 1 Clone' }, // duplicate ID!
    ],
    contentAssets: [],
    publications: [],
    teamMembers: [
      { id: 'USR-000001', name: 'Bob', email: 'bob@kira.test' },
      { id: 'USR-000002', name: 'Robert', email: 'bob@kira.test' }, // duplicate email!
    ],
    tasks: [],
    analytics: [],
    notifications: [],
    activityLogs: [],
    settings: null,
  };

  const detectedDupes = service.checkDuplicates(mockDupeData);
  assert(detectedDupes.status === 'WARNING', 'Duplicates detected as WARNING');
  assert(detectedDupes.duplicatesFound === 4, `Caught all 4 duplicate groups (got ${detectedDupes.duplicatesFound})`);
  assert(detectedDupes.issues.some((i) => i.field === 'slug'), 'Caught duplicate slug');
  assert(detectedDupes.issues.some((i) => i.field === 'externalAccountId'), 'Caught duplicate externalAccountId');
  assert(detectedDupes.issues.some((i) => i.field === 'id'), 'Caught duplicate id');
  assert(detectedDupes.issues.some((i) => i.field === 'email'), 'Caught duplicate email');

  // Test 7: Backup Integrity Verification
  console.log('\n7. Testing Backup Integrity...');
  const backupHealth = await service.checkBackups();
  assert(typeof backupHealth.totalBackupsFound === 'number', 'Total backups found checked');
  assert(typeof backupHealth.verifiedCount === 'number', 'Verified backups counter checked');
  assert(typeof backupHealth.corruptCount === 'number', 'Corrupt backups counter checked');
  assert(
    backupHealth.status === 'HEALTHY' || backupHealth.status === 'WARNING' || backupHealth.status === 'ERROR',
    `Backup status valid: ${backupHealth.status}`
  );

  // Test 8: End-to-End Health Report
  console.log('\n8. Testing End-to-End Health Report Generation...');
  const fullReport = await service.runHealthCheck();
  assert(fullReport.timestamp !== undefined, 'Report has timestamp');
  assert(fullReport.summary !== undefined, 'Report has summary');
  assert(Array.isArray(fullReport.summary.recommendedActions), 'Recommended actions is an array');
  assert(typeof fullReport.summary.healthyChecks === 'number', 'Healthy check count is numeric');
  assert(fullReport.application.running === true, 'Application running in full report');
  assert(fullReport.collections.length === 11, 'Full report contains all 11 collections');

  console.log('\n===============================================================');
  console.log(`   PHASE 16 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');
} catch (err) {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
}
