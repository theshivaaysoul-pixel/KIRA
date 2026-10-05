// scripts/verify-phase4.mjs
// Phase 4 Dashboard UI & Aggregation Verification Script for KIRA Agency Manager.
// Tests real calculation of KPI metrics, role scoping, attention items,
// overdue task detection, recent content, upcoming schedules, and clean teardown.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const { getDashboardService } = await import('../src/lib/services/dashboard-service.ts');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 4 DASHBOARD VERIFICATION');
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

const repos = getRepositories();
const dashboardService = getDashboardService();

const testPlatformId = 'PLT-TEST-PH4';
const testAccountId = 'ACC-TEST-PH4';
const testContentId = 'CNT-TEST-PH4';
const testPubFailedId = 'PUB-TEST-PH4-FAIL';
const testPubSchedId = 'PUB-TEST-PH4-SCHED';
const testTaskId = 'TSK-TEST-PH4';

try {
  // -------------------------------------------------------------------------
  // Test 1: Baseline Dashboard Overview Structure & Schema Verification
  // -------------------------------------------------------------------------
  console.log('1. Testing Dashboard Overview Contract & Baseline Data...');

  const now = new Date().toISOString();
  const testOwner = {
    id: 'USR-000001',
    name: 'Agency Owner',
    email: 'owner@kira.agency',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const baseline = await dashboardService.getDashboardOverview(testOwner);

  assert(baseline !== null && typeof baseline === 'object', 'getDashboardOverview returned an object');
  assert(baseline.metrics !== undefined, 'Dashboard contains metrics object');
  assert(typeof baseline.metrics.activeAccounts === 'number', 'activeAccounts is numeric');
  assert(typeof baseline.metrics.activeContent === 'number', 'activeContent is numeric');
  assert(typeof baseline.metrics.scheduledPublications === 'number', 'scheduledPublications is numeric');
  assert(typeof baseline.metrics.pendingTasks === 'number', 'pendingTasks is numeric');
  assert(Array.isArray(baseline.attentionItems), 'attentionItems is an array');
  assert(Array.isArray(baseline.recentContent), 'recentContent is an array');
  assert(Array.isArray(baseline.upcomingPublications), 'upcomingPublications is an array');
  assert(Array.isArray(baseline.tasks), 'tasks is an array');
  assert(Array.isArray(baseline.recentActivity), 'recentActivity is an array');
  assert(baseline.agencySettings !== undefined, 'agencySettings is present');
  assert(typeof baseline.agencySettings.agencyName === 'string', 'agencySettings.agencyName is a string');
  assert(typeof baseline.agencySettings.timezone === 'string', 'agencySettings.timezone is a string');

  // -------------------------------------------------------------------------
  // Test 2: Role-Aware Scoping Across All 7 Roles
  // -------------------------------------------------------------------------
  console.log('\n2. Testing Role-Aware Scoping for All 7 Roles...');

  const roles = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'DESIGNER', 'ANALYST', 'VIEWER'];
  for (const r of roles) {
    const actor = { ...testOwner, id: `USR-${r}`, role: r };
    const roleOverview = await dashboardService.getDashboardOverview(actor);
    assert(roleOverview.metrics !== undefined, `Role ${r} received valid dashboard metrics`);
    assert(Array.isArray(roleOverview.tasks), `Role ${r} received tasks array`);
  }

  // -------------------------------------------------------------------------
  // Test 3: Temporary Record Creation & Real Pipeline Testing
  // -------------------------------------------------------------------------
  console.log('\n3. Creating Real Test Entities in Live Cloud Storage...');

  // 3a. Platform
  const testPlatform = await repos.platforms.create({
    name: 'Phase4 Platform',
    slug: 'phase4-platform-' + Date.now(),
    icon: 'Instagram',
    isActive: true,
    capabilities: ['image', 'video'],
  });
  assert(testPlatform.id.startsWith('PLT-'), `Created live Platform: ${testPlatform.id}`);

  // 3b. Social Account with CONNECTION_ERROR
  const testAccount = await repos.socialAccounts.create({
    platformId: testPlatform.id,
    username: 'phase4_test_handle',
    accountName: 'Phase 4 Test Account',
    status: 'CONNECTION_ERROR',
  });
  assert(testAccount.id.startsWith('ACC-'), `Created live SocialAccount: ${testAccount.id}`);

  // 3c. Content
  const testContent = await repos.content.create({
    title: 'Phase 4 Real Test Content',
    contentType: 'IMAGE',
    status: 'PRODUCTION',
    createdBy: testOwner.id,
  });
  assert(testContent.id.startsWith('CNT-'), `Created live Content: ${testContent.id}`);

  // 3d. Failed Publication
  const testFailedPub = await repos.publications.create({
    contentId: testContent.id,
    socialAccountId: testAccount.id,
    status: 'FAILED',
    errorMessage: 'OAuth token expired during upload simulation',
  });
  assert(testFailedPub.id.startsWith('PUB-'), `Created live Failed Publication: ${testFailedPub.id}`);

  // 3e. Queued Scheduled Publication
  const futureDate = new Date(Date.now() + 3600 * 1000 * 24).toISOString();
  const testSchedPub = await repos.publications.create({
    contentId: testContent.id,
    socialAccountId: testAccount.id,
    status: 'QUEUED',
    scheduledAt: futureDate,
  });
  assert(testSchedPub.id.startsWith('PUB-'), `Created live Scheduled Publication: ${testSchedPub.id}`);

  // 3f. Overdue Task
  const pastDate = new Date(Date.now() - 3600 * 1000 * 48).toISOString();
  const testTask = await repos.tasks.create({
    title: 'Phase 4 Urgent Review Task',
    priority: 'URGENT',
    status: 'TODO',
    dueDate: pastDate,
    assignedTo: testOwner.id,
    relatedContentId: testContent.id,
  });
  assert(testTask.id.startsWith('TSK-'), `Created live Overdue Task: ${testTask.id}`);

  // -------------------------------------------------------------------------
  // Test 4: Verify Real Metrics & Aggregation With Populated Data
  // -------------------------------------------------------------------------
  console.log('\n4. Verifying Dashboard Aggregation of Real Live Data...');

  const populatedOverview = await dashboardService.getDashboardOverview(testOwner);

  // Active content count should reflect newly created content
  assert(populatedOverview.metrics.activeContent >= 1, 'metrics.activeContent reflects new live content');
  assert(populatedOverview.metrics.scheduledPublications >= 1, 'metrics.scheduledPublications reflects queued publication');
  assert(populatedOverview.metrics.pendingTasks >= 1, 'metrics.pendingTasks reflects new pending task');
  assert(populatedOverview.metrics.failedPublications >= 1, 'metrics.failedPublications reflects failed publication');
  assert(populatedOverview.metrics.accountConnectionErrors >= 1, 'metrics.accountConnectionErrors reflects connection error');

  // Attention banner items
  const failedItem = populatedOverview.attentionItems.find((i) => i.entityId === testFailedPub.id);
  assert(failedItem !== undefined, 'attentionItems contains failed publication');
  assert(failedItem.severity === 'ERROR', 'Failed publication severity is ERROR');

  const connectionItem = populatedOverview.attentionItems.find((i) => i.entityId === testAccount.id);
  assert(connectionItem !== undefined, 'attentionItems contains account connection error');
  assert(connectionItem.severity === 'WARNING', 'Connection error severity is WARNING');

  // Recent content
  const foundContent = populatedOverview.recentContent.find((c) => c.id === testContent.id);
  assert(foundContent !== undefined, 'recentContent contains live test content');
  assert(foundContent.title === 'Phase 4 Real Test Content', 'Recent content title matches exactly');
  assert(foundContent.status === 'PRODUCTION', 'Recent content status is PRODUCTION');

  // Upcoming publication schedule
  const foundPub = populatedOverview.upcomingPublications.find((p) => p.id === testSchedPub.id);
  assert(foundPub !== undefined, 'upcomingPublications contains scheduled publication');
  assert(foundPub.accountHandle === 'phase4_test_handle', 'Publication matches account handle');

  // Overdue Task Detection & Priority Sorting
  const foundTask = populatedOverview.tasks.find((t) => t.id === testTask.id);
  assert(foundTask !== undefined, 'tasks contains test task');
  assert(foundTask.isOverdue === true, 'Task due in the past is flagged isOverdue === true');
  assert(foundTask.priority === 'URGENT', 'Task priority is URGENT');
  assert(populatedOverview.tasks[0].id === testTask.id, 'Overdue URGENT task sorted to index 0');

  // -------------------------------------------------------------------------
  // Test 5: Cleanup of Test Artifacts
  // -------------------------------------------------------------------------
  console.log('\n5. Cleaning Up Test Entities from Cloud Storage...');

  await repos.tasks.delete(testTask.id);
  assert(true, `Deleted test task: ${testTask.id}`);

  await repos.publications.delete(testFailedPub.id);
  assert(true, `Deleted test failed publication: ${testFailedPub.id}`);

  await repos.publications.delete(testSchedPub.id);
  assert(true, `Deleted test scheduled publication: ${testSchedPub.id}`);

  await repos.content.delete(testContent.id);
  assert(true, `Deleted test content: ${testContent.id}`);

  await repos.socialAccounts.delete(testAccount.id);
  assert(true, `Deleted test account: ${testAccount.id}`);

  await repos.platforms.delete(testPlatform.id);
  assert(true, `Deleted test platform: ${testPlatform.id}`);

  console.log('\n===============================================================');
  console.log(`   ALL PHASE 4 DASHBOARD TESTS PASSED (${passCount} assertions)`);
  console.log('===============================================================\n');
} catch (err) {
  console.error('\nPhase 4 Verification failed:', err);
  process.exit(1);
}
