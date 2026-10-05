// scripts/verify-phase19.mjs
// Comprehensive test suite for Phase 19: Task System Redesign — Daily Platform Content Target System.
// Tests every requirement directly against the production services and repositories.

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const { getDailyTargetService } = await import('../src/lib/services/daily-target-service.ts');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 19 VERIFICATION: DAILY PLATFORM CONTENT TARGETS');
  console.log('================================================================\n');

  const repos = getRepositories();
  const dailyTargetService = getDailyTargetService();

  const TEST_DATE = '2099-10-04'; // Future date to guarantee no pollution of current data
  const TEST_ACTOR_ID = 'USR-000001';

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Dynamic Platforms (No Hardcoding)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: Dynamic Platforms from PlatformRepository ---');
    const allPlatforms = await repos.platforms.findAll();
    assert(allPlatforms.length > 0, `Active platforms found dynamically in PlatformRepository (${allPlatforms.length} platforms)`);
    const initialTarget = await dailyTargetService.getDailyTarget(TEST_DATE);
    assert(Array.isArray(initialTarget.platforms), 'Daily target resolves platforms array');
    assert(initialTarget.platforms.length >= allPlatforms.filter(p => p.isActive).length, 'All active platforms dynamically present without hardcoding');

    // Create a temporary real platform to verify dynamic inclusion
    const testSlug = `temp-test-${Date.now()}`;
    const tempPlatform = await repos.platforms.create({
      name: 'Temp Dynamic Test Platform',
      slug: testSlug,
      icon: 'sparkles',
      description: 'Temporary platform for dynamic verification',
      isActive: true,
      capabilities: ['text', 'image', 'video'],
    });
    assert(tempPlatform && tempPlatform.id, `Created dynamic test platform: ${tempPlatform.id}`);

    const targetWithDynamic = await dailyTargetService.getDailyTarget(TEST_DATE);
    const foundDynamic = targetWithDynamic.platforms.find(p => p.platform.id === tempPlatform.id);
    assert(Boolean(foundDynamic), 'Dynamic platform automatically appeared in DailyTarget platform list without hardcoded frontend logic');

    // Clean up temporary platform
    await repos.platforms.delete(tempPlatform.id);
    console.log('Cleaned up dynamic test platform.\n');

    // ---------------------------------------------------------------------------
    // TEST 2: Daily Task Uniqueness (One date = Exactly one daily target)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 2: Daily Task Uniqueness (Max 1 Target per Date) ---');
    const primaryPlatform = allPlatforms[0];
    const secondaryPlatform = allPlatforms[1] || allPlatforms[0];

    // Configure targets for TEST_DATE
    const updated1 = await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [
        { platformId: primaryPlatform.id, targetCount: 5 },
        { platformId: secondaryPlatform.id, targetCount: 8 },
      ],
      TEST_ACTOR_ID
    );
    assert(updated1.id.startsWith('DCT-'), `Daily target created with server ID convention: ${updated1.id}`);
    assert(updated1.date === TEST_DATE, `Daily target date matches: ${updated1.date}`);

    // Update targets for the same date again — MUST NOT create duplicate record
    const updated2 = await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [
        { platformId: primaryPlatform.id, targetCount: 7 },
        { platformId: secondaryPlatform.id, targetCount: 4 },
      ],
      TEST_ACTOR_ID
    );
    assert(updated2.id === updated1.id, `Second update updated same record (${updated2.id}), preserving uniqueness`);

    const allDailyTargets = await repos.dailyTargets.findAll();
    const matchesForDate = allDailyTargets.filter(t => t.date === TEST_DATE);
    assert(matchesForDate.length === 1, `Verified exactly ONE daily target exists for ${TEST_DATE} (found: ${matchesForDate.length})`);
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 3: Stepper & Validation (Min 0, No Negative Numbers, Integer Only)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 3: Stepper & Validation (Min 0, Integer Only, No Negatives) ---');
    let rejectedNegative = false;
    try {
      await dailyTargetService.updateDailyTargets(
        TEST_DATE,
        [{ platformId: primaryPlatform.id, targetCount: -3 }],
        TEST_ACTOR_ID
      );
    } catch {
      rejectedNegative = true;
    }
    assert(rejectedNegative, 'Server validation strictly rejected negative targetCount');

    let rejectedFloat = false;
    try {
      await dailyTargetService.updateDailyTargets(
        TEST_DATE,
        [{ platformId: primaryPlatform.id, targetCount: 4.5 }],
        TEST_ACTOR_ID
      );
    } catch {
      rejectedFloat = true;
    }
    assert(rejectedFloat, 'Server validation strictly rejected non-integer targetCount');

    // Setting target to 0 is valid and makes status NOT_TARGETED
    const targetWithZero = await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [
        { platformId: primaryPlatform.id, targetCount: 0 },
        { platformId: secondaryPlatform.id, targetCount: 5 },
      ],
      TEST_ACTOR_ID
    );
    const zeroPlat = targetWithZero.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(zeroPlat.status === 'NOT_TARGETED', `Target count 0 results in status NOT_TARGETED (actual: ${zeroPlat.status})`);
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 4: Content Platform Target Relationship (Targeted vs Completed)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 4: Content Platform Target (Targeted ON/OFF vs Completed) ---');
    // Create temporary content item
    const testContent = await repos.content.create({
      title: 'Phase 19 Verification Reel',
      contentType: 'REEL',
      status: 'IDEA',
      caption: 'Automated test content',
      hashtags: ['#test', '#phase19'],
      targetPlatformIds: [primaryPlatform.id],
      campaign: 'Test',
      createdBy: TEST_ACTOR_ID,
      version: 1,
    });
    assert(testContent && testContent.id.startsWith('CNT-'), `Created test content: ${testContent.id}`);

    // Toggle target ON for primaryPlatform
    const cptOn = await dailyTargetService.setContentPlatformTarget(
      testContent.id,
      primaryPlatform.id,
      true,
      TEST_ACTOR_ID
    );
    assert(cptOn.enabled === true, 'Content target toggled to ON');
    assert(cptOn.completed === false, 'CRITICAL: Toggling ON does NOT mark completed (distinction verified)');

    // Toggle target OFF
    const cptOff = await dailyTargetService.setContentPlatformTarget(
      testContent.id,
      primaryPlatform.id,
      false,
      TEST_ACTOR_ID
    );
    assert(cptOff.enabled === false, 'Content target toggled to OFF');
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 5: Real Operation Completion & Idempotency / No Double Counting
    // ---------------------------------------------------------------------------
    console.log('--- TEST 5: Real Operation Completion & Idempotency / Double-Count Prevention ---');
    // Set daily target: primaryPlatform = 2
    await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [{ platformId: primaryPlatform.id, targetCount: 2 }],
      TEST_ACTOR_ID
    );

    // Record verified completion (e.g. from real download) for testContent on TEST_DATE
    const timestampForTestDate = `${TEST_DATE}T12:00:00.000Z`;
    const completion1 = await dailyTargetService.recordOperationCompletion({
      contentId: testContent.id,
      platformId: primaryPlatform.id,
      actorId: TEST_ACTOR_ID,
      source: 'DOWNLOAD',
      timestamp: timestampForTestDate,
    });

    assert(completion1.contentTarget.completed === true, 'Content target automatically marked COMPLETED');
    assert(completion1.contentTarget.enabled === true, 'Content target automatically enabled ON upon download');
    assert(completion1.dailyTargetUpdated === true, 'Daily target was updated by completion');

    const check1 = await dailyTargetService.getDailyTarget(TEST_DATE);
    const p1 = check1.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(p1.completedCount === 1, `Daily target completedCount incremented to 1 (actual: ${p1.completedCount})`);
    assert(p1.remaining === 1, `Remaining count is 1 (actual: ${p1.remaining})`);
    assert(p1.status === 'IN_PROGRESS', `Platform status is IN_PROGRESS (actual: ${p1.status})`);

    // SECOND COMPLETION OF SAME CONTENT AND PLATFORM (Simulating user re-downloading)
    console.log('Testing duplicate operation (re-download)...');
    const completion2 = await dailyTargetService.recordOperationCompletion({
      contentId: testContent.id,
      platformId: primaryPlatform.id,
      actorId: TEST_ACTOR_ID,
      source: 'DOWNLOAD',
      timestamp: timestampForTestDate,
    });

    const check2 = await dailyTargetService.getDailyTarget(TEST_DATE);
    const p2 = check2.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(p2.completedCount === 1, `CRITICAL: Re-download did NOT double-count. Completed count remains 1 (actual: ${p2.completedCount})`);

    // Create second content and complete it -> reaches target of 2
    const testContent2 = await repos.content.create({
      title: 'Phase 19 Verification Reel 2',
      contentType: 'REEL',
      status: 'APPROVED',
      caption: 'Second automated test content',
      hashtags: ['#test2'],
      targetPlatformIds: [primaryPlatform.id],
      campaign: 'Test',
      createdBy: TEST_ACTOR_ID,
      version: 1,
    });

    await dailyTargetService.recordOperationCompletion({
      contentId: testContent2.id,
      platformId: primaryPlatform.id,
      actorId: TEST_ACTOR_ID,
      source: 'PUBLISH',
      timestamp: timestampForTestDate,
    });

    const check3 = await dailyTargetService.getDailyTarget(TEST_DATE);
    const p3 = check3.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(p3.completedCount === 2, `Second distinct content incremented completedCount to 2 (actual: ${p3.completedCount})`);
    assert(p3.remaining === 0, `Remaining count is 0 (actual: ${p3.remaining})`);
    assert(p3.status === 'COMPLETE', `Platform status changed to COMPLETE (actual: ${p3.status})`);
    assert(p3.percentage === 100, `Platform progress reached 100% (actual: ${p3.percentage}%)`);
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 6: Target Increase & Decrease (Preserves Historical Completed Count)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 6: Target Adjustments (Increase & Decrease History Preservation) ---');
    // User INCREASES target from 2 to 5: completed must remain 2, remaining = 3, status = IN_PROGRESS
    const targetIncreased = await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [{ platformId: primaryPlatform.id, targetCount: 5 }],
      TEST_ACTOR_ID
    );
    const pInc = targetIncreased.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(pInc.completedCount === 2, `Target increase preserved completedCount at 2 (actual: ${pInc.completedCount})`);
    assert(pInc.remaining === 3, `Remaining count became 3 (actual: ${pInc.remaining})`);
    assert(pInc.status === 'IN_PROGRESS', `Status returned to IN_PROGRESS upon target increase`);

    // User DECREASES target from 5 to 1: completed must remain 2, remaining = 0 (never negative!), status = COMPLETE
    const targetDecreased = await dailyTargetService.updateDailyTargets(
      TEST_DATE,
      [{ platformId: primaryPlatform.id, targetCount: 1 }],
      TEST_ACTOR_ID
    );
    const pDec = targetDecreased.platforms.find(p => p.platform.id === primaryPlatform.id);
    assert(pDec.completedCount === 2, `Target decrease preserved historical completedCount at 2 (actual: ${pDec.completedCount})`);
    assert(pDec.remaining === 0, `Remaining count is clamped at 0 and never negative (actual: ${pDec.remaining})`);
    assert(pDec.status === 'COMPLETE', `Status is COMPLETE when completedCount >= targetCount`);
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 7: IDOR Protection & Non-Existent Validation
    // ---------------------------------------------------------------------------
    console.log('--- TEST 7: IDOR & Server-Side Relationship Validation ---');
    let rejectedNonExistentPlatform = false;
    try {
      await dailyTargetService.updateDailyTargets(
        TEST_DATE,
        [{ platformId: 'PLT-999999', targetCount: 5 }],
        TEST_ACTOR_ID
      );
    } catch {
      rejectedNonExistentPlatform = true;
    }
    assert(rejectedNonExistentPlatform, 'Server rejected non-existent platformId (IDOR protection)');

    let rejectedNonExistentContent = false;
    try {
      await dailyTargetService.setContentPlatformTarget(
        'CNT-999999',
        primaryPlatform.id,
        true,
        TEST_ACTOR_ID
      );
    } catch {
      rejectedNonExistentContent = true;
    }
    assert(rejectedNonExistentContent, 'Server rejected non-existent contentId (IDOR protection)');
    console.log('');

    // ---------------------------------------------------------------------------
    // TEST 8: Dashboard Today Progress Calculation
    // ---------------------------------------------------------------------------
    console.log('--- TEST 8: Dashboard Today Progress Calculation ---');
    const todayProgress = await dailyTargetService.getTodayProgress();
    assert(typeof todayProgress.totalTarget === 'number', 'totalTarget is a valid number');
    assert(typeof todayProgress.totalCompleted === 'number', 'totalCompleted is a valid number');
    assert(typeof todayProgress.overallPercentage === 'number', 'overallPercentage is a valid number');
    assert(typeof todayProgress.hasTarget === 'boolean', 'hasTarget flag is a boolean');
    console.log(`Today's progress: hasTarget=${todayProgress.hasTarget}, completed=${todayProgress.totalCompleted}/${todayProgress.totalTarget} (${todayProgress.overallPercentage}%)`);
    console.log('');

    // ---------------------------------------------------------------------------
    // CLEANUP TEST DATA (Preserve existing repository files)
    // ---------------------------------------------------------------------------
    console.log('--- CLEANUP: Removing isolated test records ---');
    // Remove test daily target
    const dailyTargetsAll = await repos.dailyTargets.findAll();
    const remainingDailyTargets = dailyTargetsAll.filter(t => t.date !== TEST_DATE);
    await repos.dailyTargets.writeRaw(remainingDailyTargets, 'SYSTEM_SAFETY');

    // Remove test content and content platform targets
    await repos.content.delete(testContent.id);
    await repos.content.delete(testContent2.id);

    const cpts = await repos.contentPlatformTargets.findAll();
    const remainingCpts = cpts.filter(c => c.contentId !== testContent.id && c.contentId !== testContent2.id);
    await repos.contentPlatformTargets.writeRaw(remainingCpts, 'SYSTEM_SAFETY');

    console.log('✅ Test data successfully cleaned up.\n');

    console.log('================================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${passedTests} passed, ${failedTests} failed`);
    console.log('================================================================');
  } catch (err) {
    console.error('Test suite failed with uncaught exception:', err);
    process.exit(1);
  }
}

runTests();
