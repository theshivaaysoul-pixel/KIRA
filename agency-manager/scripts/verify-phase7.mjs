// scripts/verify-phase7.mjs
// Automated verification suite for KIRA Agency Manager — Phase 7: Content Management.
// Tests against real Google Cloud Storage with zero mock data.

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const {
  createContent,
  getContentById,
  updateContent,
  transitionStatus,
  deleteOrArchiveContent,
  listContent,
  normalizeHashtags,
  ContentNotFoundError,
  ContentInUseError,
  WorkflowError,
} = await import('../src/lib/services/content-service.ts');
const { validateTransition, getAllowedTransitions } = await import('../src/lib/services/content-workflow-service.ts');
const { CreateContentSchema, UpdateContentSchema } = await import('../src/lib/validation/index.ts');
const { hasPermission } = await import('../src/lib/auth/permissions.ts');

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

async function runPhase7Verification() {
  console.log('===============================================================');
  console.log('   KIRA AGENCY MANAGER — PHASE 7 CONTENT MANAGEMENT VERIFICATION');
  console.log('===============================================================\n');

  const repos = getRepositories();

  // Find or provision active test actors in repo
  const teamMembers = await repos.teamMembers.findAll();
  let testOwner = teamMembers.find((m) => m.role === 'OWNER' && m.status === 'ACTIVE');
  let createdTestOwner = false;
  if (!testOwner) {
    testOwner = await repos.teamMembers.create({
      name: 'Test Content Owner',
      email: `test-owner-c7-${Date.now()}@kira.agency`,
      role: 'OWNER',
      status: 'ACTIVE',
    });
    createdTestOwner = true;
  }

  let testEditor = teamMembers.find((m) => m.role === 'EDITOR' && m.status === 'ACTIVE');
  let createdTestEditor = false;
  if (!testEditor) {
    testEditor = await repos.teamMembers.create({
      name: 'Test Content Editor',
      email: `test-editor-c7-${Date.now()}@kira.agency`,
      role: 'EDITOR',
      status: 'ACTIVE',
    });
    createdTestEditor = true;
  }

  const createdContentIds = [];

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Validation & Normalization Layer
    // ─────────────────────────────────────────────────────────────
    console.log('1. Testing Validation & Hashtag Normalization...');

    // Missing title
    const missingTitle = CreateContentSchema.safeParse({
      contentType: 'POST',
    });
    assert(!missingTitle.success, 'Reject content creation without title');

    // Title too long
    const longTitle = CreateContentSchema.safeParse({
      title: 'A'.repeat(201),
      contentType: 'POST',
    });
    assert(!longTitle.success, 'Reject content title > 200 characters');

    // Invalid contentType
    const invalidType = CreateContentSchema.safeParse({
      title: 'Valid Title',
      contentType: 'NON_EXISTENT_TYPE',
    });
    assert(!invalidType.success, 'Reject invalid content type');

    // Hashtag normalization
    const normalized = normalizeHashtags(['  #Fashion  ', 'tech_news', '##AI Trends', 'fashion']);
    assert(
      normalized.length === 3 &&
      normalized.includes('#fashion') &&
      normalized.includes('#tech_news') &&
      normalized.includes('#ai_trends'),
      'Normalize hashtags: strip leading #, lowercase, replace spaces with _, deduplicate'
    );

    // ─────────────────────────────────────────────────────────────
    // 2. Real Content Creation (GCS Persistence)
    // ─────────────────────────────────────────────────────────────
    console.log('\n2. Testing Content Creation & Persistence...');

    const newContent = await createContent(
      {
        title: 'Phase 7 Verification Post',
        description: 'Comprehensive automated test content record',
        contentType: 'POST',
        caption: 'Exciting announcement about KIRA Agency Manager Phase 7! #launch #kira',
        hashtags: ['launch', 'kira', '#agency'],
      },
      testOwner
    );

    createdContentIds.push(newContent.id);

    assert(newContent.id && newContent.id.startsWith('CNT-'), `Created content with ID: ${newContent.id}`);
    assert(newContent.status === 'IDEA', 'Initial status is strictly "IDEA"');
    assert(newContent.createdBy === testOwner.id, 'createdBy accurately set to actor ID');
    assert(newContent.hashtags.includes('#agency'), 'Hashtags normalized on creation');
    assert(newContent.creator !== null, 'Creator relationship resolved');
    assert(newContent.assetCount === 0, 'Initial assetCount is 0');
    assert(newContent.publicationCount === 0, 'Initial publicationCount is 0');

    // ─────────────────────────────────────────────────────────────
    // 3. Retrieval and Listing
    // ─────────────────────────────────────────────────────────────
    console.log('\n3. Testing Content Retrieval and Filtering...');

    const fetched = await getContentById(newContent.id, testOwner);
    assert(fetched.id === newContent.id, 'getContentById retrieves correct content');
    assert(fetched.title === 'Phase 7 Verification Post', 'Retrieved content has correct title');

    const searchResults = await listContent(
      {
        search: 'Phase 7 Verification',
        contentType: 'POST',
        status: 'IDEA',
      },
      testOwner
    );
    assert(
      searchResults.items.some((c) => c.id === newContent.id),
      'listContent correctly filters by search term, status, and contentType'
    );

    // ─────────────────────────────────────────────────────────────
    // 4. Content Updates
    // ─────────────────────────────────────────────────────────────
    console.log('\n4. Testing Content Updates (Fields)...');

    const updated = await updateContent(
      newContent.id,
      {
        title: 'Phase 7 Verification Post (Updated)',
        caption: 'Updated caption with extra details',
        hashtags: ['launch', 'kira', 'updated'],
      },
      testOwner
    );

    assert(updated.title === 'Phase 7 Verification Post (Updated)', 'Updated title matches');
    assert(updated.caption === 'Updated caption with extra details', 'Updated caption matches');
    assert(updated.hashtags.includes('#updated'), 'Updated hashtags normalized');

    // ─────────────────────────────────────────────────────────────
    // 5. Workflow Transitions & State Machine Enforcement
    // ─────────────────────────────────────────────────────────────
    console.log('\n5. Testing Workflow State Machine & Permissions...');

    // Progress: IDEA -> SCRIPT
    const toScript = await transitionStatus(newContent.id, 'SCRIPT', testOwner);
    assert(toScript.status === 'SCRIPT', 'Transition IDEA -> SCRIPT succeeds');

    // Progress: SCRIPT -> PRODUCTION
    const toProd = await transitionStatus(newContent.id, 'PRODUCTION', testOwner);
    assert(toProd.status === 'PRODUCTION', 'Transition SCRIPT -> PRODUCTION succeeds');

    // Progress: PRODUCTION -> EDITING
    const toEditing = await transitionStatus(newContent.id, 'EDITING', testOwner);
    assert(toEditing.status === 'EDITING', 'Transition PRODUCTION -> EDITING succeeds');

    // Progress: EDITING -> REVIEW
    const toReview = await transitionStatus(newContent.id, 'REVIEW', testOwner);
    assert(toReview.status === 'REVIEW', 'Transition EDITING -> REVIEW succeeds');

    // Test permission check on approval:
    // EDITOR role does NOT have content.approve permission
    let editorApprovalFailed = false;
    try {
      await transitionStatus(newContent.id, 'APPROVED', testEditor);
    } catch (err) {
      if (err instanceof WorkflowError && err.code === 'WORKFLOW_INSUFFICIENT_PERMISSION') {
        editorApprovalFailed = true;
      }
    }
    assert(editorApprovalFailed, 'EDITOR without content.approve cannot transition to APPROVED');

    // OWNER has content.approve permission -> transition should succeed
    const toApproved = await transitionStatus(newContent.id, 'APPROVED', testOwner);
    assert(toApproved.status === 'APPROVED', 'OWNER with content.approve successfully transitions to APPROVED');

    // Disallowed transition: cannot jump directly from APPROVED to EDITING (must go to SCHEDULED or ARCHIVED)
    let invalidJumpFailed = false;
    try {
      await transitionStatus(newContent.id, 'EDITING', testOwner);
    } catch (err) {
      if (err instanceof WorkflowError && err.code === 'WORKFLOW_INVALID_TRANSITION') {
        invalidJumpFailed = true;
      }
    }
    assert(invalidJumpFailed, 'Reject invalid transition jump (APPROVED -> EDITING)');

    // Reject manual engine-only transitions (PUBLISHED, FAILED)
    let engineOnlyFailed = false;
    try {
      await transitionStatus(newContent.id, 'PUBLISHED', testOwner);
    } catch (err) {
      if (err instanceof WorkflowError && err.code === 'WORKFLOW_ENGINE_ONLY') {
        engineOnlyFailed = true;
      }
    }
    assert(engineOnlyFailed, 'Reject manual transition to engine-only status PUBLISHED');

    // Transition to SCHEDULED
    const toScheduled = await transitionStatus(newContent.id, 'SCHEDULED', testOwner);
    assert(toScheduled.status === 'SCHEDULED', 'Transition APPROVED -> SCHEDULED succeeds');

    // ─────────────────────────────────────────────────────────────
    // 6. Relationship Protection & Deletion vs Archiving
    // ─────────────────────────────────────────────────────────────
    console.log('\n6. Testing Relationship-Protected Deletion vs Soft Archiving...');

    // Create a 2nd content item with NO references
    const standaloneContent = await createContent(
      {
        title: 'Standalone Content for Deletion',
        contentType: 'TEXT',
      },
      testOwner
    );

    // Delete standalone content -> should permanently delete
    const deleteResult = await deleteOrArchiveContent(standaloneContent.id, testOwner);
    assert(deleteResult.deleted === true && deleteResult.archived === false, 'Standalone content without references is permanently deleted');

    const checkDeleted = await repos.content.findById(standaloneContent.id);
    assert(checkDeleted === null, 'Content record is fully removed from repository');

    // Now attach a mock/publication reference to the first content item
    // First, find or create an active social account
    const accounts = await repos.socialAccounts.findAll();
    let accountId = accounts[0]?.id;
    if (!accountId) {
      // Find a platform
      const platforms = await repos.platforms.findAll();
      const platformId = platforms[0]?.id || 'PLT-000001';
      const newAcc = await repos.socialAccounts.create({
        platformId,
        accountName: 'Test Account For Content Ref',
        username: `test_ref_${Date.now()}`,
        status: 'ACTIVE',
        assignedManagerId: testOwner.id,
      });
      accountId = newAcc.id;
    }

    const testPub = await repos.publications.create({
      contentId: newContent.id,
      socialAccountId: accountId,
      status: 'QUEUED',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });

    // Try deleting content that has references without force -> must archive
    const archiveResult = await deleteOrArchiveContent(newContent.id, testOwner, false);
    assert(
      archiveResult.archived === true && archiveResult.deleted === false,
      'Content with publication reference is soft-archived instead of deleted'
    );

    const archivedItem = await repos.content.findById(newContent.id);
    assert(archivedItem && archivedItem.status === 'ARCHIVED', 'Content status is now ARCHIVED');

    // Attempting to edit an ARCHIVED content must fail
    let editArchivedFailed = false;
    try {
      await updateContent(newContent.id, { title: 'Should Fail' }, testOwner);
    } catch (err) {
      if (err instanceof WorkflowError && err.code === 'CONTENT_ARCHIVED') {
        editArchivedFailed = true;
      }
    }
    assert(editArchivedFailed, 'Archived content cannot be edited');

    // Attempting to transition status on ARCHIVED content must fail
    let transitionArchivedFailed = false;
    try {
      await transitionStatus(newContent.id, 'IDEA', testOwner);
    } catch (err) {
      if (err instanceof WorkflowError && err.code === 'WORKFLOW_ARCHIVED') {
        transitionArchivedFailed = true;
      }
    }
    assert(transitionArchivedFailed, 'Archived content cannot be transitioned back');

    // Attempting forcePermanent delete with references must throw ContentInUseError
    let forceInUseFailed = false;
    try {
      await deleteOrArchiveContent(newContent.id, testOwner, true);
    } catch (err) {
      if (err instanceof ContentInUseError && err.code === 'CONTENT_IN_USE') {
        forceInUseFailed = true;
      }
    }
    assert(forceInUseFailed, 'Force permanent delete rejects content with active references (409)');

    // Clean up publication reference so we can cleanly delete test content
    await repos.publications.delete(testPub.id);
    const finalDelete = await deleteOrArchiveContent(newContent.id, testOwner, false);
    assert(finalDelete.deleted === true, 'After removing references, content is permanently deleted');

    // ─────────────────────────────────────────────────────────────
    // 7. Security Activity Audit Log Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n7. Testing Security & Workflow Audit Logging...');

    const activities = await repos.activityLogs.findAll();
    const contentActivities = activities.filter(
      (a) => a.entityType === 'Content' && a.entityId === newContent.id
    );

    assert(contentActivities.length > 0, `Found ${contentActivities.length} audit activity logs for test content`);
    const actionTypes = new Set(contentActivities.map((a) => a.action));
    const hasWorkflowTransition = contentActivities.some((a) => a.metadata?.action === 'WORKFLOW_TRANSITION');
    assert(actionTypes.has('CREATE'), 'Activity log includes CREATE event');
    assert(hasWorkflowTransition, 'Activity log includes WORKFLOW_TRANSITION event');
    assert(actionTypes.has('ARCHIVE'), 'Activity log includes ARCHIVE event');
    assert(actionTypes.has('DELETE'), 'Activity log includes DELETE event');

  } finally {
    // Clean up any test users created
    if (createdTestOwner) {
      try { await repos.teamMembers.delete(testOwner.id); } catch {}
    }
    if (createdTestEditor) {
      try { await repos.teamMembers.delete(testEditor.id); } catch {}
    }
    // Clean up any leftover content records
    for (const cid of createdContentIds) {
      try {
        const c = await repos.content.findById(cid);
        if (c) await repos.content.delete(cid);
      } catch {}
    }
  }

  console.log('\n===============================================================');
  console.log(`   PHASE 7 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7Verification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
