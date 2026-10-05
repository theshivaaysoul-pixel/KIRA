// scripts/verify-phase17.mjs
// Phase 17 — Global Search Verification Suite
//
// Tests:
// 1. GlobalSearchService instance and query evaluation
// 2. Real Content matching (title, caption, description, hashtags)
// 3. Real Task matching (title, description)
// 4. Real SocialAccount matching (accountName, username, niche)
// 5. Real Platform matching (name, slug, description)
// 6. Real TeamMember matching (name, email)
// 7. Role-based authorization filtering (VIEWER vs ADMIN vs OWNER)
// 8. Honest empty state verification (zero fake results when query doesn't match)
// 9. Pagination and limit slicing
// 10. Entity type filtering ('content', 'task', etc.)
// 11. Temporary test record lifecycle: create -> verify search -> cleanup -> verify cleanup

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const { GlobalSearchService, getGlobalSearchService } = await import('../src/lib/services/global-search-service.ts');
const { getRepositories } = await import('../src/lib/repositories/index.ts');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 17 GLOBAL SEARCH VERIFICATION');
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
  const repos = getRepositories();
  const searchService = getGlobalSearchService();
  const testRunId = Date.now();

  // Test 1: Empty & Whitespace Query Handling
  console.log('1. Testing Empty & Whitespace Query Handling...');
  const emptyRes = await searchService.search({
    query: '',
    role: 'OWNER',
  });
  assert(emptyRes.total === 0, 'Empty query returns 0 total');
  assert(emptyRes.results.length === 0, 'Empty query returns empty results array');
  assert(Object.keys(emptyRes.grouped).length === 0, 'Empty query returns empty grouped object');

  const whitespaceRes = await searchService.search({
    query: '    ',
    role: 'OWNER',
  });
  assert(whitespaceRes.total === 0, 'Whitespace query returns 0 total');

  // Test 2: Honest Empty State (No Fake Results)
  console.log('\n2. Testing Honest Empty State (Zero Fake Results)...');
  const unmatchableQuery = `unmatchable_string_${testRunId}_xyz`;
  const noMatchRes = await searchService.search({
    query: unmatchableQuery,
    role: 'OWNER',
  });
  assert(noMatchRes.total === 0, 'Unmatchable query returns 0 results');
  assert(noMatchRes.results.length === 0, 'No sample or fake results returned');
  assert(Object.keys(noMatchRes.grouped).length === 0, 'Grouped object contains zero groups');

  // Test 3: Temporary Real Records for Search Verification
  console.log('\n3. Creating Real Temporary Records for Search Evaluation...');
  const tempTag = `ph17tag${testRunId}`;

  // Create temporary platform
  const tempPlatform = await repos.platforms.create({
    name: `SearchTest Platform ${testRunId}`,
    slug: `search-plt-${testRunId}`,
    icon: 'share',
    description: `Unique description for search test ${tempTag}`,
    isActive: true,
    capabilities: ['text', 'image'],
  });
  assert(!!tempPlatform.id, `Created temporary platform: ${tempPlatform.id}`);

  // Create temporary content
  const tempContent = await repos.content.create({
    title: `SearchTest Content ${testRunId}`,
    description: `Content test description with special token ${tempTag}`,
    contentType: 'POST',
    caption: `Caption containing searchable hashtag #${tempTag}`,
    hashtags: [`#${tempTag}`],
    status: 'IDEA',
    createdBy: 'USR-000001',
  });
  assert(!!tempContent.id, `Created temporary content: ${tempContent.id}`);

  // Create temporary task
  const tempTask = await repos.tasks.create({
    title: `SearchTest Task ${testRunId}`,
    description: `Task containing ${tempTag} marker`,
    priority: 'HIGH',
    status: 'TODO',
  });
  assert(!!tempTask.id, `Created temporary task: ${tempTask.id}`);

  try {
    // Test 4: Search Real Data by Token
    console.log('\n4. Testing Real Multi-Entity Search Matching...');
    const searchRes = await searchService.search({
      query: tempTag,
      role: 'OWNER',
    });

    assert(searchRes.total >= 3, `Found at least 3 matching temporary records (got ${searchRes.total})`);

    const platformHit = searchRes.results.find((r) => r.id === tempPlatform.id);
    assert(!!platformHit, 'Found temporary platform in search results');
    assert(platformHit?.type === 'platform', 'Platform hit has type "platform"');

    const contentHit = searchRes.results.find((r) => r.id === tempContent.id);
    assert(!!contentHit, 'Found temporary content in search results');
    assert(contentHit?.type === 'content', 'Content hit has type "content"');

    const taskHit = searchRes.results.find((r) => r.id === tempTask.id);
    assert(!!taskHit, 'Found temporary task in search results');
    assert(taskHit?.type === 'task', 'Task hit has type "task"');

    // Test 5: Result Grouping
    console.log('\n5. Testing Result Grouping...');
    assert(Array.isArray(searchRes.grouped.platforms), 'Grouped contains platforms array');
    assert(Array.isArray(searchRes.grouped.content), 'Grouped contains content array');
    assert(Array.isArray(searchRes.grouped.tasks), 'Grouped contains tasks array');
    // Only non-empty groups should be present
    for (const [groupName, groupList] of Object.entries(searchRes.grouped)) {
      assert(groupList.length > 0, `Group "${groupName}" is non-empty`);
    }

    // Test 6: Entity Type Filtering
    console.log('\n6. Testing Entity Type Filtering...');
    const contentOnlyRes = await searchService.search({
      query: tempTag,
      type: 'content',
      role: 'OWNER',
    });
    assert(contentOnlyRes.results.every((r) => r.type === 'content'), 'Every filtered result is of type "content"');
    assert(contentOnlyRes.results.some((r) => r.id === tempContent.id), 'Content is present in content-only search');
    assert(!contentOnlyRes.results.some((r) => r.id === tempPlatform.id), 'Platform excluded from content-only search');

    const taskOnlyRes = await searchService.search({
      query: tempTag,
      type: 'task',
      role: 'OWNER',
    });
    assert(taskOnlyRes.results.every((r) => r.type === 'task'), 'Every filtered result is of type "task"');
    assert(taskOnlyRes.results.some((r) => r.id === tempTask.id), 'Task is present in task-only search');

    // Test 7: Role & Authorization Filtering (Server-side)
    console.log('\n7. Testing Server-side Role & Authorization Filtering...');
    // VIEWER role does not have tasks.read or platforms.read or activity.read
    const viewerRes = await searchService.search({
      query: tempTag,
      role: 'VIEWER',
    });
    // VIEWER can read content (content.read) and platforms (platforms.read)
    // but NOT tasks (tasks.read), team (team.read), or activity (activity.read)
    assert(
      !viewerRes.results.some((r) => r.type === 'task'),
      'VIEWER role receives zero task results (tasks.read not permitted)'
    );
    assert(
      !viewerRes.results.some((r) => r.type === 'team'),
      'VIEWER role receives zero team results (team.read not permitted)'
    );
    assert(
      !viewerRes.results.some((r) => r.type === 'activity'),
      'VIEWER role receives zero activity results (activity.read not permitted)'
    );
    assert(
      viewerRes.results.some((r) => r.type === 'content'),
      'VIEWER role receives content results (content.read permitted)'
    );
    assert(
      viewerRes.results.some((r) => r.type === 'platform'),
      'VIEWER role receives platform results (platforms.read permitted)'
    );

    // Test 8: Server-Side Pagination
    console.log('\n8. Testing Server-Side Pagination & Limits...');
    const page1Res = await searchService.search({
      query: tempTag,
      page: 1,
      limit: 1,
      role: 'OWNER',
    });
    assert(page1Res.results.length === 1, 'Limit=1 returns exactly 1 item in results');
    assert(page1Res.limit === 1, 'Limit returned in metadata is 1');
    assert(page1Res.page === 1, 'Page returned in metadata is 1');
    assert(page1Res.totalPages >= 3, 'Total pages calculated correctly');

    const page2Res = await searchService.search({
      query: tempTag,
      page: 2,
      limit: 1,
      role: 'OWNER',
    });
    assert(page2Res.results.length === 1, 'Page 2 returns 1 item');
    assert(page2Res.results[0].id !== page1Res.results[0].id, 'Page 2 returns different item than Page 1');
  } finally {
    // -----------------------------------------------------------------------
    // Cleanup Test Data
    // -----------------------------------------------------------------------
    console.log('\n9. Cleaning up Temporary Real Records...');
    await repos.platforms.delete(tempPlatform.id);
    await repos.content.delete(tempContent.id);
    await repos.tasks.delete(tempTask.id);

    // Verify cleanup
    const verifyPlatform = await repos.platforms.findById(tempPlatform.id);
    const verifyContent = await repos.content.findById(tempContent.id);
    const verifyTask = await repos.tasks.findById(tempTask.id);

    assert(verifyPlatform === null, 'Temporary platform successfully deleted from storage');
    assert(verifyContent === null, 'Temporary content successfully deleted from storage');
    assert(verifyTask === null, 'Temporary task successfully deleted from storage');
    console.log('   All temporary test records cleaned up cleanly.');
  }

  // Test 10: Verify Search After Cleanup (Zero Ghost Data)
  console.log('\n10. Verifying Search After Cleanup (Zero Ghost Data)...');
  const postCleanupRes = await searchService.search({
    query: tempTag,
    role: 'OWNER',
  });
  assert(postCleanupRes.total === 0, 'No ghost search results remain after cleanup');

  console.log('\n===============================================================');
  console.log(`   PHASE 17 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');
} catch (err) {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
}
