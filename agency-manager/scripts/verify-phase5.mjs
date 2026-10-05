// scripts/verify-phase5.mjs
// Comprehensive verification test suite for KIRA Agency Manager — Phase 5: Dynamic Platform Management
// Tests validation, CRUD, slug uniqueness, relationship safety, search/filter/sort,
// idempotent seeding, role authorization, and live cloud storage persistence.

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const {
  getPlatformService,
  PlatformInUseError,
  PlatformSlugExistsError,
  DEFAULT_PLATFORMS,
} = await import('../src/lib/services/platform-service.ts');
const {
  CreatePlatformSchema,
} = await import('../src/lib/validation/index.ts');
const { hasPermission } = await import('../src/lib/auth/permissions.ts');

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

async function run() {
  console.log('===============================================================');
  console.log('   KIRA AGENCY MANAGER — PHASE 5 PLATFORMS VERIFICATION');
  console.log('===============================================================\n');

  const repos = getRepositories();
  const platformService = getPlatformService();

  const mockAdminActor = {
    id: 'USR-000001',
    authUid: 'test-admin-uid',
    name: 'Admin Verifier',
    email: 'admin@kira.agency',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ─── 1. Validation & Slug Constraints ─────────────────────────────────────────
  console.log('1. Testing Platform Validation Schemas & Slug Constraints...');

  const validSlugResult = CreatePlatformSchema.safeParse({
    name: 'Test Platform',
    slug: 'test-platform',
    icon: 'Share2',
    description: 'A valid test platform',
    isActive: true,
    capabilities: ['image', 'video'],
  });
  assert(validSlugResult.success, 'Valid platform payload passes schema validation');

  // Test invalid slugs
  const invalidSlugs = [
    'Instagram Platform', // spaces
    'my platform!!!',     // punctuation
    '../../platform',     // path traversal attempt
    '-invalid-slug',      // leading hyphen
    'invalid-slug-',      // trailing hyphen
    'invalid--slug',      // double hyphen
    'UPPERCASE',          // uppercase
  ];

  for (const badSlug of invalidSlugs) {
    const res = CreatePlatformSchema.safeParse({
      name: 'Bad Slug',
      slug: badSlug,
      icon: 'Share2',
      isActive: true,
      capabilities: ['image'],
    });
    assert(!res.success, `Invalid slug "${badSlug}" rejected by Zod schema`);
  }

  // Test unknown capability
  const badCapResult = CreatePlatformSchema.safeParse({
    name: 'Bad Cap',
    slug: 'bad-cap',
    icon: 'Share2',
    isActive: true,
    capabilities: ['unknownCapability'],
  });
  assert(!badCapResult.success, 'Unknown capability key rejected by schema');

  // Test empty name
  const emptyNameResult = CreatePlatformSchema.safeParse({
    name: '   ',
    slug: 'valid-slug',
    icon: 'Share2',
    isActive: true,
    capabilities: ['image'],
  });
  assert(!emptyNameResult.success, 'Whitespace-only name rejected by schema');

  // ─── 2. Platform Service CRUD & Live Storage Operations ───────────────────────
  console.log('\n2. Testing Platform Service CRUD & Storage Operations...');

  const testSlug = `temp-test-${Date.now()}`;
  let createdPlatform = null;

  try {
    createdPlatform = await platformService.createPlatform(mockAdminActor, {
      name: 'Temporary Test Network',
      slug: testSlug,
      icon: 'Radio',
      description: 'Temporary platform for automated verification',
      isActive: true,
      capabilities: ['image', 'video', 'live', 'scheduling', 'publishing'],
    });

    assert(Boolean(createdPlatform), 'Platform created successfully');
    assert(/^PLT-\d{6}$/.test(createdPlatform.id), `Server-side ID generated: ${createdPlatform.id}`);
    assert(createdPlatform.slug === testSlug, 'Slug matches input');
    assert(createdPlatform.isActive === true, 'Platform is active');
    assert(createdPlatform.capabilities.length === 5, 'Capabilities match input');

    // Read by ID
    const fetchedById = await platformService.getPlatformById(createdPlatform.id);
    assert(Boolean(fetchedById), 'Platform fetched by ID');
    assert(fetchedById.name === 'Temporary Test Network', 'Fetched platform name matches');
    assert(fetchedById.accountCount === 0, 'New platform has 0 connected accounts');

    // Read by Slug
    const fetchedBySlug = await platformService.getPlatformBySlug(testSlug);
    assert(Boolean(fetchedBySlug), 'Platform fetched by slug');
    assert(fetchedBySlug.id === createdPlatform.id, 'Fetched by slug returns matching ID');

    // Update Platform
    const updated = await platformService.updatePlatform(mockAdminActor, createdPlatform.id, {
      name: 'Updated Test Network',
      description: 'Updated operational description',
      capabilities: ['image', 'video', 'story'],
    });
    assert(updated.name === 'Updated Test Network', 'Platform name updated');
    assert(updated.capabilities.length === 3, 'Capabilities updated');

    // Soft Deactivation
    const deactivated = await platformService.deactivatePlatform(mockAdminActor, createdPlatform.id);
    assert(deactivated.isActive === false, 'Platform soft deactivated (isActive === false)');

    // Re-activation
    const reactivated = await platformService.updatePlatform(mockAdminActor, createdPlatform.id, {
      isActive: true,
    });
    assert(reactivated.isActive === true, 'Platform re-activated');

    // ─── 3. Slug Uniqueness & Conflict Handling ─────────────────────────────────
    console.log('\n3. Testing Slug Uniqueness & Conflict Handling...');

    let duplicateCreateFailed = false;
    try {
      await platformService.createPlatform(mockAdminActor, {
        name: 'Duplicate Slug Attempt',
        slug: testSlug,
        icon: 'Globe',
        isActive: true,
        capabilities: ['text'],
      });
    } catch (err) {
      if (err instanceof PlatformSlugExistsError || err.code === 'PLATFORM_SLUG_EXISTS') {
        duplicateCreateFailed = true;
      }
    }
    assert(duplicateCreateFailed, 'Duplicate platform slug blocked on creation');

    // ─── 4. Search, Filtering, Sorting & Pagination ──────────────────────────────
    console.log('\n4. Testing Search, Filtering, Sorting & Pagination...');

    const searchResult = await platformService.listPlatforms({ search: testSlug });
    assert(searchResult.platforms.some((p) => p.slug === testSlug), 'Search by slug finds test platform');

    const activeList = await platformService.listPlatforms({ isActive: true });
    assert(activeList.platforms.every((p) => p.isActive === true), 'Filtering by isActive=true returns only active platforms');

    const capabilityList = await platformService.listPlatforms({ capability: 'story' });
    assert(capabilityList.platforms.some((p) => p.id === createdPlatform.id), 'Filtering by capability matches platform');

    const sortedList = await platformService.listPlatforms({ sort: 'name', order: 'asc' });
    assert(sortedList.platforms.length > 0, 'Sorted list returned platforms');

    // ─── 5. Relationship Protection & Deletion Safety ───────────────────────────
    console.log('\n5. Testing Relationship Protection & Deletion Safety...');

    // Create a temporary social account associated with this platform
    const tempAccount = await repos.socialAccounts.create({
      platformId: createdPlatform.id,
      accountName: 'Temp Account for Deletion Test',
      username: `temp_user_${Date.now()}`,
      status: 'ACTIVE',
    });
    assert(Boolean(tempAccount), 'Temporary social account created linked to platform');

    // Check account count in getPlatformById
    const withAccounts = await platformService.getPlatformById(createdPlatform.id);
    assert(withAccounts.accountCount === 1, 'accountCount correctly reflects connected account');

    // Attempt to delete platform while account is connected -> MUST FAIL with PlatformInUseError
    let deletionBlocked = false;
    try {
      await platformService.deletePlatform(mockAdminActor, createdPlatform.id);
    } catch (err) {
      if (err instanceof PlatformInUseError || err.code === 'PLATFORM_IN_USE') {
        deletionBlocked = true;
        assert(err.accountCount === 1, 'PlatformInUseError reports correct connected account count');
      }
    }
    assert(deletionBlocked, 'Deletion blocked with PLATFORM_IN_USE when accounts are connected');

    // Verify platform still exists in storage
    const stillExists = await repos.platforms.findById(createdPlatform.id);
    assert(Boolean(stillExists), 'Platform preserved in storage after blocked deletion');

    // Now delete the temporary account
    await repos.socialAccounts.delete(tempAccount.id);
    assert(true, 'Temporary social account deleted');

    // Re-attempt deleting platform -> MUST SUCCEED now that no accounts exist
    const deleteResult = await platformService.deletePlatform(mockAdminActor, createdPlatform.id);
    assert(deleteResult.success === true, 'Platform deleted successfully after removing account');

    const confirmedGone = await repos.platforms.findById(createdPlatform.id);
    assert(confirmedGone === null, 'Platform confirmed removed from cloud storage');
    createdPlatform = null; // cleared

    // ─── 6. Idempotent Platform Seed Mechanism ─────────────────────────────────
    console.log('\n6. Testing Idempotent Platform Seed Mechanism...');

    const seedResult = await platformService.seedDefaultPlatforms(mockAdminActor);
    assert(typeof seedResult.created === 'number', 'Seed returned created count');
    assert(typeof seedResult.skipped === 'number', 'Seed returned skipped count');
    assert(seedResult.failed === 0, 'Seed completed with 0 failures');

    // Run seed a second time -> ALL must be skipped, 0 created
    const secondSeedResult = await platformService.seedDefaultPlatforms(mockAdminActor);
    assert(secondSeedResult.created === 0, 'Second seed created 0 platforms (idempotent)');
    assert(secondSeedResult.skipped === DEFAULT_PLATFORMS.length, `All ${DEFAULT_PLATFORMS.length} default platforms skipped on second run`);

    // Verify default platforms are in storage
    const allPlatforms = await repos.platforms.findAll();
    const slugs = allPlatforms.map((p) => p.slug);
    assert(slugs.includes('instagram'), 'Default platform "instagram" present in storage');
    assert(slugs.includes('tiktok'), 'Default platform "tiktok" present in storage');
    assert(slugs.includes('x'), 'Default platform "x" present in storage');
    assert(slugs.includes('youtube'), 'Default platform "youtube" present in storage');
    assert(slugs.includes('facebook'), 'Default platform "facebook" present in storage');
    assert(slugs.includes('discord'), 'Default platform "discord" present in storage');
    assert(slugs.includes('kick'), 'Default platform "kick" present in storage');
    assert(slugs.includes('snapchat'), 'Default platform "snapchat" present in storage');

    // ─── 7. Role-Based Permissions for Platform Management ──────────────────────
    console.log('\n7. Testing Role-Based Authorization Matrix...');

    const roles = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'DESIGNER', 'ANALYST', 'VIEWER'];
    for (const r of roles) {
      const canRead = hasPermission(r, 'platforms.read');
      const canCreateRole = hasPermission(r, 'platforms.create');
      const canUpdateRole = hasPermission(r, 'platforms.update');
      const canDeleteRole = hasPermission(r, 'platforms.delete');

      assert(canRead === true, `Role ${r} has platforms.read`);

      if (r === 'OWNER' || r === 'ADMIN') {
        assert(canCreateRole === true, `Role ${r} has platforms.create`);
        assert(canUpdateRole === true, `Role ${r} has platforms.update`);
        assert(canDeleteRole === true, `Role ${r} has platforms.delete`);
      } else {
        assert(canCreateRole === false, `Role ${r} is DENIED platforms.create`);
        assert(canUpdateRole === false, `Role ${r} is DENIED platforms.update`);
        assert(canDeleteRole === false, `Role ${r} is DENIED platforms.delete`);
      }
    }

    // ─── 8. Activity Logging for Platform Actions ───────────────────────────────
    console.log('\n8. Testing Activity Logging for Platform Lifecycle Actions...');

    const logs = await repos.activityLogs.findAll();
    const platformLogs = logs.filter((l) => l.entityType === 'Platform');
    assert(platformLogs.length > 0, 'Platform actions recorded in ActivityLog');
    const createLog = platformLogs.find((l) => l.action === 'CREATE');
    assert(Boolean(createLog), 'Activity log contains CREATE Platform event');

  } finally {
    // Cleanup any lingering created platform if test failed midway
    if (createdPlatform) {
      try {
        await repos.platforms.delete(createdPlatform.id);
        console.log(`   Cleaned up test platform: ${createdPlatform.id}`);
      } catch {
        // ignore
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`   ALL PHASE 5 PLATFORMS TESTS PASSED (${passCount} assertions)`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
