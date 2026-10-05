// tests/platform/dynamic-platform.test.ts
// Platform Dynamicity & Publishing Engine verification.
// Verifies dynamic platform handling (e.g. Threads) without schema changes, and publishing engine states.

import { harness } from '../test-helper';
import { getRepositories } from '@/lib/repositories';
import { getAdapterRegistry } from '@/lib/adapters/registry';
import { getPublishingService, PublishingServiceError } from '@/lib/services/publishing-service';
import { getPlatformAuditService } from '@/lib/services/platform-audit-service';

export async function runDynamicPlatformTests(): Promise<void> {
  harness.setSuite('Dynamic Platform & Publishing Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: Dynamic Platform & Publishing Tests');
  console.log('===============================================================\n');

  const repos = getRepositories();
  const registry = getAdapterRegistry();
  const auditService = getPlatformAuditService();
  const publishingService = getPublishingService();

  // ─── 1. Dynamic Platform Lifecycle (Threads / Future Platform) ──────────────
  await harness.runTest('Platform Dynamicity: Generic platform handling without hardcoding or schema changes', async () => {
    const tempSlug = `threads-qa-${Date.now()}`;

    // 1. Create temporary new platform through real repository with server-generated ID
    const platform = await repos.platforms.create({
      name: 'Threads by Meta',
      slug: tempSlug,
      icon: 'at-sign',
      capabilities: ['text', 'image', 'video', 'scheduling'],
      isActive: true,
      description: 'Dynamic QA verification platform',
    });

    harness.assert(!!platform.id, 'Platform created with ID');
    harness.assert(platform.id.startsWith('PLT-'), `Platform ID has PLT- prefix: ${platform.id}`);
    harness.assertEqual(platform.slug, tempSlug, 'Slug saved accurately');

    // 2. Read-back verification
    const readBack = await repos.platforms.findById(platform.id);
    harness.assert(readBack !== null, 'Platform persisted and retrieved from storage');
    harness.assertEqual(readBack?.capabilities.length, 4, 'All 4 dynamic capabilities stored');

    // 3. Edit platform capabilities dynamically
    const updated = await repos.platforms.update(platform.id, {
      name: 'Threads by Meta (Updated)',
      capabilities: ['text', 'image', 'video', 'scheduling', 'analytics'],
    });
    harness.assertEqual(updated.capabilities.length, 5, 'Dynamic capability update persisted');

    // 4. Deactivate platform
    const deactivated = await repos.platforms.update(platform.id, {
      isActive: false,
    });
    harness.assertEqual(deactivated.isActive, false, 'Platform deactivation persisted');

    // 5. Audit Platform dynamically
    const auditReport = await auditService.runAudit();
    const auditedPlatform = auditReport.platforms.find((p) => p.platformId === platform.id);
    harness.assert(!!auditedPlatform, 'Dynamic platform included in audit report');
    harness.assertEqual(auditedPlatform?.isActive, false, 'Audit correctly reflects inactive state');
    harness.assertEqual(auditedPlatform?.adapter.status, 'UNAVAILABLE', 'Audit reports UNAVAILABLE without guessing');

    // 6. Clean Deletion
    await repos.platforms.delete(platform.id);

    // 7. Verified Cleanup
    const afterDelete = await repos.platforms.findById(platform.id);
    harness.assertEqual(afterDelete, null, 'Dynamic platform cleanly purged from storage');
  });

  // ─── 2. Adapter Registry & Publishing Engine Integrity ──────────────────────
  await harness.runTest('Adapter Registry: Handles missing adapter truthfully without guessing', () => {
    const unconfiguredSlug = 'non-existent-platform-slug-xyz';
    const adapter = registry.get(unconfiguredSlug);
    harness.assertEqual(adapter, null, 'Registry truthfully returns null for missing adapter');

    const isSupported = registry.supportsCapability(unconfiguredSlug, 'publishing');
    harness.assertEqual(isSupported, false, 'supportsCapability returns false for unconfigured platform');
  });

  await harness.runTest('Publishing Engine: Never simulates success; fails safely when adapter is missing', async () => {
    // Attempting to publish non-existent publication throws controlled error
    await harness.assertRejects(
      publishingService.publish('PUB-NONEXISTENT-999999', {
        id: 'USR-000001',
        name: 'Primary Owner',
        email: 'owner@kira.agency',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }),
      (err) => err instanceof PublishingServiceError || (err as Record<string, unknown>)?.code === 'NOT_FOUND',
      'Publishing non-existent publication rejected with controlled error'
    );
  });
}
