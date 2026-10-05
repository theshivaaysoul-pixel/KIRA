// scripts/verify-phase6.mjs
// Automated verification suite for KIRA Agency Manager — Phase 6: Social Account Management.
// Tests against real Google Cloud Storage with zero mock data.

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const { SocialAccountService, AccountInUseError, AccountNotFoundError } = await import('../src/lib/services/social-account-service.ts');
const { CreateSocialAccountSchema, UpdateSocialAccountSchema } = await import('../src/lib/validation/index.ts');
const { hasPermission, ROLE_PERMISSIONS } = await import('../src/lib/auth/permissions.ts');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase6Verification() {
  console.log('===============================================================');
  console.log('   KIRA AGENCY MANAGER — PHASE 6 SOCIAL ACCOUNTS VERIFICATION');
  console.log('===============================================================\n');

  const repos = getRepositories();

  // Find or provision active test actors in repo
  const teamMembers = await repos.teamMembers.findAll();
  let testOwner = teamMembers.find((m) => m.role === 'OWNER' && m.status === 'ACTIVE');
  let createdTestOwner = false;
  if (!testOwner) {
    testOwner = await repos.teamMembers.create({
      name: 'Test Owner',
      email: `test-owner-${Date.now()}@kira.agency`,
      role: 'OWNER',
      status: 'ACTIVE',
    });
    createdTestOwner = true;
  }

  let testManager = teamMembers.find((m) => m.role === 'MANAGER' && m.status === 'ACTIVE');
  let createdTestManager = false;
  if (!testManager) {
    testManager = await repos.teamMembers.create({
      name: 'Test Manager',
      email: `test-manager-${Date.now()}@kira.agency`,
      role: 'MANAGER',
      status: 'ACTIVE',
    });
    createdTestManager = true;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Validation Layer Tests
  // ─────────────────────────────────────────────────────────────
  console.log('1. Testing Server-Side Validation Layer...');

  // Invalid: missing required fields
  const missingName = CreateSocialAccountSchema.safeParse({
    platformId: 'PLT-000001',
    username: 'validuser',
  });
  assert(!missingName.success, 'Reject missing accountName');

  const missingPlatform = CreateSocialAccountSchema.safeParse({
    accountName: 'Valid Name',
    username: 'validuser',
  });
  assert(!missingPlatform.success, 'Reject missing platformId');

  const missingUsername = CreateSocialAccountSchema.safeParse({
    platformId: 'PLT-000001',
    accountName: 'Valid Name',
  });
  assert(!missingUsername.success, 'Reject missing username');

  // Invalid: non-HTTP URL
  const ftpUrl = CreateSocialAccountSchema.safeParse({
    platformId: 'PLT-000001',
    accountName: 'Valid Name',
    username: 'validuser',
    profileUrl: 'ftp://ftp.example.com/profile',
  });
  assert(!ftpUrl.success, 'Reject non-http/https URL protocol (ftp)');

  const jsUrl = CreateSocialAccountSchema.safeParse({
    platformId: 'PLT-000001',
    accountName: 'Valid Name',
    username: 'validuser',
    profileUrl: 'javascript:alert(1)',
  });
  assert(!jsUrl.success, 'Reject javascript: URL protocol');

  // Valid: proper HTTP and HTTPS URLs
  const validUrls = CreateSocialAccountSchema.safeParse({
    platformId: 'PLT-000001',
    accountName: 'Valid Name',
    username: 'validuser',
    profileUrl: 'https://instagram.com/validuser',
    avatarUrl: 'https://images.example.com/avatar.jpg',
  });
  assert(validUrls.success, 'Accept valid HTTPS profile and avatar URLs');

  // ─────────────────────────────────────────────────────────────
  // 2. Relationship Integrity: Inactive Platform & Inactive Manager
  // ─────────────────────────────────────────────────────────────
  console.log('\n2. Testing Relationship Integrity on Platform & Manager...');

  // Create temporary inactive platform
  const inactivePlatform = await repos.platforms.create({
    name: 'Temporary Inactive Platform',
    slug: `temp-inactive-${Date.now()}`,
    description: 'Testing inactive platform rejection',
    icon: 'Radio',
    isActive: false,
    capabilities: ['text', 'image'],
  });
  assert(inactivePlatform.id.startsWith('PLT-'), `Created test inactive platform: ${inactivePlatform.id}`);

  // Create temporary active platform
  const activePlatform = await repos.platforms.create({
    name: 'Temporary Active Platform',
    slug: `temp-active-${Date.now()}`,
    description: 'Testing live account lifecycle',
    icon: 'Camera',
    isActive: true,
    capabilities: ['text', 'image', 'video', 'carousel', 'story', 'shortVideo'],
  });
  assert(activePlatform.isActive === true, `Created active test platform: ${activePlatform.id}`);

  // Attempt to create account on inactive platform -> must fail
  let inactivePlatformError = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: inactivePlatform.id,
        accountName: 'Inactive Platform Account',
        username: 'should_fail',
      },
      testOwner
    );
  } catch (err) {
    inactivePlatformError = true;
    assert(
      err.message.includes('inactive platform'),
      `Correctly blocked creating account on inactive platform: "${err.message}"`
    );
  }
  assert(inactivePlatformError, 'Rejects account creation against inactive platform');

  // Attempt to create account on non-existent platform -> must fail
  let nonExistentPlatformError = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: 'PLT-999999',
        accountName: 'Ghost Platform Account',
        username: 'ghost_user',
      },
      testOwner
    );
  } catch (err) {
    nonExistentPlatformError = true;
    assert(
      err.message.includes('not found') || err.message.includes('does not exist'),
      `Correctly blocked non-existent platformId: "${err.message}"`
    );
  }
  assert(nonExistentPlatformError, 'Rejects account creation against non-existent platform');

  // Attempt to assign suspended/inactive team member on active platform
  let suspendedMember = teamMembers.find((m) => m.status === 'SUSPENDED');
  if (!suspendedMember) {
    suspendedMember = await repos.teamMembers.create({
      name: 'Temp Suspended Member',
      email: `temp-suspended-${Date.now()}@kira.agency`,
      role: 'MANAGER',
      status: 'SUSPENDED',
    });
  }

  let suspendedAssignError = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: activePlatform.id,
        accountName: 'Suspended Manager Account',
        username: 'suspended_mgr_test',
        assignedManagerId: suspendedMember.id,
      },
      testOwner
    );
  } catch (err) {
    suspendedAssignError = true;
  }
  assert(suspendedAssignError, 'Rejects account assignment to non-active team member');

  // ─────────────────────────────────────────────────────────────
  // 3. Real Cloud Storage CRUD & Data Safety Persistence
  // ─────────────────────────────────────────────────────────────
  console.log('\n3. Testing Real Cloud Storage Persistence & CRUD...');

  // Create real SocialAccount on active platform with leading @ in username
  const testUsernameInput = '@kira_brand_e2e';
  const createdAccount = await SocialAccountService.createAccount(
    {
      platformId: activePlatform.id,
      accountName: 'KIRA Brand E2E Test',
      username: testUsernameInput,
      profileUrl: 'https://instagram.com/kira_brand_e2e',
      avatarUrl: 'https://images.example.com/kira_avatar.png',
      niche: 'Creative Agency',
      description: 'Official test profile for Phase 6 automated verification',
      assignedManagerId: testManager.id,
      externalAccountId: `EXT-${Date.now()}`,
      status: 'ACTIVE',
    },
    testOwner
  );

  assert(createdAccount.id.startsWith('ACC-'), `Server-generated ACC ID: ${createdAccount.id}`);
  assert(createdAccount.username === 'kira_brand_e2e', 'Username normalized by stripping leading "@"');
  assert(createdAccount.platform?.id === activePlatform.id, 'Attached platform relationship matches exactly');
  assert(createdAccount.assignedManager?.id === testManager.id, 'Attached assignedManager matches exactly');
  assert(createdAccount.status === 'ACTIVE', 'Account status is ACTIVE');

  // Read-back verification from GCS
  const readBack = await SocialAccountService.getAccountById(createdAccount.id, testOwner);
  assert(readBack !== null, 'Account read-back from live GCS succeeded');
  assert(readBack.accountName === 'KIRA Brand E2E Test', 'Verified account name from storage');
  assert(readBack.publicationCount === 0, 'Initial publication count is 0');
  assert(readBack.analyticsCount === 0, 'Initial analytics count is 0');
  assert(readBack.taskCount === 0, 'Initial task count is 0');

  // Update Account
  const updatedAccount = await SocialAccountService.updateAccount(
    createdAccount.id,
    {
      accountName: 'KIRA Brand E2E (Updated)',
      niche: 'Digital Marketing & AI',
      description: 'Updated description for live GCS verification',
    },
    testOwner
  );
  assert(updatedAccount.accountName === 'KIRA Brand E2E (Updated)', 'Updated accountName in storage');
  assert(updatedAccount.niche === 'Digital Marketing & AI', 'Updated niche in storage');

  // ─────────────────────────────────────────────────────────────
  // 4. Duplicate Prevention (Username & External Account ID)
  // ─────────────────────────────────────────────────────────────
  console.log('\n4. Testing Duplicate Prevention (Username & External Account ID)...');

  // Attempt duplicate username on the SAME platform -> must be blocked
  let duplicateUsernameBlocked = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: activePlatform.id,
        accountName: 'Duplicate Attempt',
        username: 'kira_brand_e2e', // same username
      },
      testOwner
    );
  } catch (err) {
    duplicateUsernameBlocked = true;
    assert(err.message.includes('already exists'), `Blocked duplicate username on same platform: "${err.message}"`);
  }
  assert(duplicateUsernameBlocked, 'Duplicate username on same platform is blocked');

  // Attempt duplicate externalAccountId on the SAME platform -> must be blocked
  let duplicateExternalBlocked = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: activePlatform.id,
        accountName: 'Duplicate External Attempt',
        username: 'different_user_name',
        externalAccountId: createdAccount.externalAccountId, // same external ID
      },
      testOwner
    );
  } catch (err) {
    duplicateExternalBlocked = true;
    assert(err.message.includes('External account ID'), `Blocked duplicate externalAccountId: "${err.message}"`);
  }
  assert(duplicateExternalBlocked, 'Duplicate externalAccountId on same platform is blocked');

  // Same username on a DIFFERENT platform -> MUST BE ALLOWED
  const secondPlatform = await repos.platforms.create({
    name: 'Second Active Platform',
    slug: `temp-second-${Date.now()}`,
    description: 'Testing cross-platform username coexistence',
    icon: 'Send',
    isActive: true,
    capabilities: ['text', 'image'],
  });

  const crossPlatformAccount = await SocialAccountService.createAccount(
    {
      platformId: secondPlatform.id,
      accountName: 'Cross Platform Account',
      username: 'kira_brand_e2e', // same username, different platform
    },
    testOwner
  );
  assert(crossPlatformAccount.id.startsWith('ACC-'), 'Same username permitted on different platforms');
  await repos.socialAccounts.delete(crossPlatformAccount.id);
  await repos.platforms.delete(secondPlatform.id);

  // ─────────────────────────────────────────────────────────────
  // 5. Platform Deactivation Compatibility
  // ─────────────────────────────────────────────────────────────
  console.log('\n5. Testing Platform Deactivation Compatibility...');

  // Deactivate the platform
  await repos.platforms.update(activePlatform.id, { isActive: false });
  const deactivatedPlatform = await repos.platforms.findById(activePlatform.id);
  assert(deactivatedPlatform.isActive === false, 'Platform successfully deactivated');

  // Verify existing account on the deactivated platform remains intact and readable
  const accountStillExists = await SocialAccountService.getAccountById(createdAccount.id, testOwner);
  assert(accountStillExists !== null, 'Existing account survives platform deactivation');
  assert(accountStillExists.accountName === 'KIRA Brand E2E (Updated)', 'Account data remains intact');

  // Deactivated platform cannot accept new accounts
  let newOnDeactivatedBlocked = false;
  try {
    await SocialAccountService.createAccount(
      {
        platformId: activePlatform.id,
        accountName: 'Forbidden New Account',
        username: 'forbidden_new_user',
      },
      testOwner
    );
  } catch {
    newOnDeactivatedBlocked = true;
  }
  assert(newOnDeactivatedBlocked, 'New account creation blocked against deactivated platform');

  // Reactivate the platform for remaining tests
  await repos.platforms.update(activePlatform.id, { isActive: true });

  // ─────────────────────────────────────────────────────────────
  // 6. Querying, Search, Filters, Sorting, and Pagination
  // ─────────────────────────────────────────────────────────────
  console.log('\n6. Testing Querying, Search, Filters, Sorting, and Pagination...');

  const queryAll = await SocialAccountService.listAccounts({ page: 1, pageSize: 50 }, testOwner);
  assert(queryAll.total >= 1, `listAccounts returned total: ${queryAll.total}`);
  assert(Array.isArray(queryAll.items), 'queryAll items is an array');

  // Search by username
  const querySearch = await SocialAccountService.listAccounts(
    { search: 'kira_brand_e2e' },
    testOwner
  );
  assert(querySearch.items.some((a) => a.id === createdAccount.id), 'Search by username matches target account');

  // Filter by platformId
  const queryPlatform = await SocialAccountService.listAccounts(
    { platformId: activePlatform.id },
    testOwner
  );
  assert(
    queryPlatform.items.every((a) => a.platformId === activePlatform.id),
    'Filter by platformId matches only target platform'
  );

  // Filter by status
  const queryStatus = await SocialAccountService.listAccounts(
    { status: 'ACTIVE' },
    testOwner
  );
  assert(
    queryStatus.items.every((a) => a.status === 'ACTIVE'),
    'Filter by status ACTIVE matches only active accounts'
  );

  // Filter by assignedManagerId
  const queryManager = await SocialAccountService.listAccounts(
    { assignedManagerId: testManager.id },
    testOwner
  );
  assert(
    queryManager.items.every((a) => a.assignedManagerId === testManager.id),
    'Filter by assignedManagerId matches only assigned accounts'
  );

  // Sorting
  const sortAsc = await SocialAccountService.listAccounts(
    { sortBy: 'accountName', sortOrder: 'asc' },
    testOwner
  );
  assert(sortAsc.items.length > 0, 'Sorted asc query returned items');

  // Pagination
  const paginatedResult = await SocialAccountService.listAccounts(
    { page: 1, pageSize: 2 },
    testOwner
  );
  assert(paginatedResult.pageSize === 2, 'Page size enforced');
  assert(paginatedResult.items.length <= 2, 'Page item limit respected');

  // ─────────────────────────────────────────────────────────────
  // 7. Relationship Protection & Safe Archiving
  // ─────────────────────────────────────────────────────────────
  console.log('\n7. Testing Relationship Protection & Soft Archiving...');

  // Create a Content entity and ContentPublication referencing our account
  const tempContent = await repos.content.create({
    title: 'Phase 6 Test Reel',
    contentType: 'REEL',
    status: 'SCHEDULED',
    createdBy: testOwner.id,
  });

  const tempPublication = await repos.publications.create({
    contentId: tempContent.id,
    socialAccountId: createdAccount.id,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'QUEUED',
  });
  assert(tempPublication.id.startsWith('PUB-'), `Created reference publication: ${tempPublication.id}`);

  // Verify getAccountById reports publicationCount: 1
  const accountWithPub = await SocialAccountService.getAccountById(createdAccount.id, testOwner);
  assert(accountWithPub.publicationCount === 1, `Live publication count verified: ${accountWithPub.publicationCount}`);

  // Attempt to permanently delete while referenced -> must fail with AccountInUseError
  let permanentDeleteBlocked = false;
  try {
    await SocialAccountService.deleteOrArchiveAccount(createdAccount.id, testOwner, {
      forcePermanent: true,
    });
  } catch (err) {
    permanentDeleteBlocked = true;
    assert(err instanceof AccountInUseError, 'AccountInUseError thrown when permanent delete attempted on referenced account');
    assert(err.status === 409, 'AccountInUseError status is 409');
  }
  assert(permanentDeleteBlocked, 'Permanent deletion correctly blocked for referenced account');

  // Default deleteOrArchiveAccount -> performs safe soft archive
  const archiveResult = await SocialAccountService.deleteOrArchiveAccount(
    createdAccount.id,
    testOwner,
    { forcePermanent: false }
  );
  assert(archiveResult.archived === true, 'Referenced account was safely archived');
  assert(archiveResult.deleted === false, 'Referenced account was NOT deleted');

  const archivedAccount = await SocialAccountService.getAccountById(createdAccount.id, testOwner);
  assert(archivedAccount.status === 'ARCHIVED', 'Account status confirmed ARCHIVED in storage');

  // Clean up publication & content
  await repos.publications.delete(tempPublication.id);
  await repos.content.delete(tempContent.id);

  // Now with 0 references, permanent delete should succeed
  const unreferencedAccount = await SocialAccountService.getAccountById(createdAccount.id, testOwner);
  assert(unreferencedAccount.publicationCount === 0, 'References cleared (0 publications)');

  const deleteResult = await SocialAccountService.deleteOrArchiveAccount(
    createdAccount.id,
    testOwner,
    { forcePermanent: true }
  );
  assert(deleteResult.deleted === true, 'Permanent deletion succeeded for unreferenced account');

  const accountAfterDelete = await repos.socialAccounts.findById(createdAccount.id);
  assert(accountAfterDelete === null, 'Account confirmed removed from storage');

  // Clean up temporary platforms and members
  await repos.platforms.delete(activePlatform.id);
  await repos.platforms.delete(inactivePlatform.id);
  if (suspendedMember.name === 'Temp Suspended Member') {
    await repos.teamMembers.delete(suspendedMember.id);
  }
  if (createdTestOwner) {
    await repos.teamMembers.delete(testOwner.id);
  }
  if (createdTestManager) {
    await repos.teamMembers.delete(testManager.id);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Role-Based Permissions Matrix
  // ─────────────────────────────────────────────────────────────
  console.log('\n8. Testing Role-Based Permissions Matrix for Accounts...');

  const rolesToTest = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'DESIGNER', 'ANALYST', 'VIEWER'];
  for (const role of rolesToTest) {
    const canRead = hasPermission(role, 'accounts.read');
    const canCreate = hasPermission(role, 'accounts.create');
    const canUpdate = hasPermission(role, 'accounts.update');
    const canDelete = hasPermission(role, 'accounts.delete');

    if (role === 'OWNER' || role === 'ADMIN') {
      assert(canRead && canCreate && canUpdate && canDelete, `Role ${role} has full accounts CRUD permissions`);
    } else if (role === 'MANAGER') {
      assert(canRead && canUpdate && !canCreate && !canDelete, `Role MANAGER has read and update permissions (no create or delete)`);
    } else if (role === 'EDITOR' || role === 'DESIGNER') {
      assert(!canRead && !canCreate && !canUpdate && !canDelete, `Role ${role} has NO account permissions`);
    } else if (role === 'ANALYST' || role === 'VIEWER') {
      assert(canRead && !canCreate && !canUpdate && !canDelete, `Role ${role} has read-only access to accounts`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Activity Logging
  // ─────────────────────────────────────────────────────────────
  console.log('\n9. Testing Security Activity Logging...');

  const recentLogs = await repos.activityLogs.findAll();
  const socialAccountLogs = recentLogs.filter((l) => l.entityType === 'SocialAccount');
  assert(socialAccountLogs.length > 0, `Recorded ${socialAccountLogs.length} SocialAccount activity logs`);

  const actions = new Set(socialAccountLogs.map((l) => l.action));
  assert(actions.has('CREATE'), 'Activity log contains CREATE action');
  assert(actions.has('UPDATE') || actions.has('ARCHIVE'), 'Activity log contains UPDATE or ARCHIVE action');
  assert(actions.has('DELETE'), 'Activity log contains DELETE action');

  // Verify no secrets in metadata
  let secretLeaked = false;
  for (const log of socialAccountLogs) {
    if (log.metadata) {
      for (const key of Object.keys(log.metadata)) {
        if (/password|token|secret|key|private/i.test(key)) {
          secretLeaked = true;
        }
      }
    }
  }
  assert(!secretLeaked, 'Zero sensitive credentials or tokens in activity log metadata');

  console.log('\n===============================================================');
  console.log(`   PHASE 6 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Verification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
