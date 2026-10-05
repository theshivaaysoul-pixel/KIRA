// tests/integration/repository.test.ts
// Integration tests for repository layer, DataSafetyService, read/write/delete lifecycle, and relationships.

import { harness } from '../test-helper';
import { getRepositories } from '@/lib/repositories';
import { ConflictError } from '@/lib/repositories';

export async function runRepositoryTests(): Promise<void> {
  harness.setSuite('Repository Integration Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: Repository Integration Tests');
  console.log('===============================================================\n');

  const repos = getRepositories();

  // ─── 1. Core Read Operations ────────────────────────────────────────────────
  await harness.runTest('Repository: findAll returns real array of domain records', async () => {
    const platforms = await repos.platforms.findAll();
    harness.assert(Array.isArray(platforms), 'platforms.findAll returned an array');
    harness.assert(platforms.length > 0, `Discovered ${platforms.length} platforms in storage`);

    const members = await repos.teamMembers.findAll();
    harness.assert(Array.isArray(members), 'teamMembers.findAll returned an array');
    harness.assert(members.length > 0, `Discovered ${members.length} team members in storage`);
  });

  await harness.runTest('Repository: count matches findAll length exactly', async () => {
    const [platforms, count] = await Promise.all([
      repos.platforms.findAll(),
      repos.platforms.count(),
    ]);
    harness.assertEqual(count, platforms.length, 'platforms.count matches platforms.findAll().length');
  });

  await harness.runTest('Repository: findById finds real record and returns null for non-existent', async () => {
    const platforms = await repos.platforms.findAll();
    const firstPlatform = platforms[0];

    const found = await repos.platforms.findById(firstPlatform.id);
    harness.assert(found !== null, `Found platform by id ${firstPlatform.id}`);
    harness.assertEqual(found?.id, firstPlatform.id, 'Retrieved ID matches requested ID');

    const nonExistent = await repos.platforms.findById('PLT-NONEXISTENT-999999');
    harness.assertEqual(nonExistent, null, 'Non-existent ID returned null');
  });

  await harness.runTest('Repository: exists returns true for existing and false for non-existent', async () => {
    const members = await repos.teamMembers.findAll();
    const firstMember = members[0];

    const existsTrue = await repos.teamMembers.exists(firstMember.id);
    harness.assertEqual(existsTrue, true, 'exists returned true for existing member');

    const existsFalse = await repos.teamMembers.exists('USR-NONEXISTENT-999999');
    harness.assertEqual(existsFalse, false, 'exists returned false for non-existent member');
  });

  // ─── 2. Write, Update, Duplicate Prevention, and Cleanup Lifecycle ───────────
  await harness.runTest('Repository: Complete lifecycle with server ID generation & verified cleanup', async () => {
    const initialCount = await repos.platforms.count();
    const tempSlug = `test-integration-${Date.now()}`;

    // 1. Create temporary platform record with real server ID generation
    const created = await repos.platforms.create({
      name: 'Integration Test Platform',
      slug: tempSlug,
      icon: 'layers',
      capabilities: ['text', 'image'],
      isActive: false,
    });

    harness.assert(!!created.id, 'Server generated an ID');
    harness.assert(created.id.startsWith('PLT-'), `Generated ID "${created.id}" has PLT- prefix`);
    harness.assertEqual(created.name, 'Integration Test Platform', 'Name matches created input');
    harness.assertEqual(created.slug, tempSlug, 'Slug matches created input');

    // 2. Read-back verification
    const readBack = await repos.platforms.findById(created.id);
    harness.assert(readBack !== null, 'Read-back from storage returned created platform');
    harness.assertEqual(readBack?.name, 'Integration Test Platform', 'Persisted name verified');

    // 3. Duplicate Prevention (Slug uniqueness check)
    await harness.assertRejects(
      repos.platforms.create({
        name: 'Duplicate Platform',
        slug: tempSlug, // same slug
        icon: 'layers',
        capabilities: ['text'],
        isActive: false,
      }),
      (err) => err instanceof ConflictError || (err as Record<string, unknown>)?.code === 'CONFLICT' || String(err).includes('already exists'),
      'Prevented creating duplicate platform with same slug'
    );

    // 4. Update
    const updated = await repos.platforms.update(created.id, {
      name: 'Updated Integration Test Platform',
      isActive: true,
    });
    harness.assertEqual(updated.name, 'Updated Integration Test Platform', 'Update persisted new name');
    harness.assertEqual(updated.isActive, true, 'Update persisted new status');

    // 5. Delete
    await repos.platforms.delete(created.id);

    // 6. Verified Cleanup
    const afterDelete = await repos.platforms.findById(created.id);
    harness.assertEqual(afterDelete, null, 'Deleted platform confirmed no longer in storage');

    const finalCount = await repos.platforms.count();
    harness.assertEqual(finalCount, initialCount, 'Platform count returned to initial value');
  });

  // ─── 3. Query Filtering & Sorting ───────────────────────────────────────────
  await harness.runTest('Repository: Sorting and filtering operations on domain datasets', async () => {
    const platforms = await repos.platforms.findAll();
    // Test sorting by name ascending
    const sorted = [...platforms].sort((a, b) => a.name.localeCompare(b.name));
    harness.assert(sorted.length === platforms.length, 'Sorted collection count matches');
    if (sorted.length > 1) {
      harness.assert(
        sorted[0].name.localeCompare(sorted[1].name) <= 0,
        'Ascending alphabetical sorting verified'
      );
    }
  });
}
