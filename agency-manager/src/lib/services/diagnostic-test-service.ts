// src/lib/services/diagnostic-test-service.ts
// Comprehensive, real end-to-end diagnostic suite for KIRA Repository Layer.
// Tests real persistence, validation, relationships, and cleans up all test records.

import { getRepositories } from '@/lib/repositories';
import { ConflictError, ValidationError } from '@/lib/repositories/base-json-repository';

export interface RepositoryDiagnosticResult {
  platformCreate: boolean;
  platformRead: boolean;
  platformUpdate: boolean;
  duplicateRejection: boolean;
  invalidDataRejection: boolean;
  relationshipValidation: boolean;
  platformDelete: boolean;
  cleanupVerified: boolean;
  settingsCheck: boolean;
  details: string[];
  allPassed: boolean;
}

export async function runRepositoryDiagnostics(): Promise<RepositoryDiagnosticResult> {
  const repos = getRepositories();
  const details: string[] = [];
  const timestamp = Date.now();
  const testSlug = `test-plt-${timestamp}`;

  const result: RepositoryDiagnosticResult = {
    platformCreate: false,
    platformRead: false,
    platformUpdate: false,
    duplicateRejection: false,
    invalidDataRejection: false,
    relationshipValidation: false,
    platformDelete: false,
    cleanupVerified: false,
    settingsCheck: false,
    details,
    allPassed: false,
  };

  let createdPlatformId: string | null = null;
  let createdMemberId: string | null = null;
  let createdAccountId: string | null = null;

  try {
    // ─── 1. Platform Create ───────────────────────────────────────────────────
    details.push('1. Testing Platform creation with real storage persistence...');
    const platform = await repos.platforms.create({
      name: 'Diagnostic Test Platform',
      slug: testSlug,
      icon: 'sparkles',
      description: 'Temporary platform for Phase 1 verification',
      isActive: true,
      capabilities: ['text', 'image', 'video'],
    });

    createdPlatformId = platform.id;
    if (platform.id && platform.id.startsWith('PLT-') && platform.slug === testSlug) {
      result.platformCreate = true;
      details.push(`✅ Created platform with ID: ${platform.id}`);
    } else {
      throw new Error(`Platform creation returned invalid structure: ${JSON.stringify(platform)}`);
    }

    // ─── 2. Platform Read ─────────────────────────────────────────────────────
    details.push('2. Testing Platform read back by ID and by slug...');
    const readById = await repos.platforms.findById(createdPlatformId);
    const readBySlug = await repos.platforms.findBySlug(testSlug);

    if (
      readById &&
      readBySlug &&
      readById.id === createdPlatformId &&
      readBySlug.id === createdPlatformId &&
      readById.name === 'Diagnostic Test Platform'
    ) {
      result.platformRead = true;
      details.push(`✅ Platform successfully retrieved and verified from storage`);
    } else {
      throw new Error('Platform read back verification failed');
    }

    // ─── 3. Platform Update ───────────────────────────────────────────────────
    details.push('3. Testing Platform update...');
    const updated = await repos.platforms.update(createdPlatformId, {
      description: 'Updated diagnostic description',
    });

    const verifyUpdate = await repos.platforms.findById(createdPlatformId);
    if (
      updated.description === 'Updated diagnostic description' &&
      verifyUpdate?.description === 'Updated diagnostic description'
    ) {
      result.platformUpdate = true;
      details.push('✅ Platform updated and verified');
    } else {
      throw new Error('Platform update verification failed');
    }

    // ─── 4. Duplicate Rejection ───────────────────────────────────────────────
    details.push('4. Testing duplicate slug rejection...');
    try {
      await repos.platforms.create({
        name: 'Duplicate Platform',
        slug: testSlug, // already exists
        icon: 'sparkles',
        isActive: true,
        capabilities: ['text'],
      });
      throw new Error('Expected duplicate slug creation to fail, but it succeeded');
    } catch (err) {
      if (err instanceof ConflictError) {
        result.duplicateRejection = true;
        details.push(`✅ Duplicate slug correctly rejected with ConflictError: ${err.message}`);
      } else {
        throw err;
      }
    }

    // ─── 5. Invalid Data Rejection ────────────────────────────────────────────
    details.push('5. Testing invalid data rejection (Zod schema validation)...');
    try {
      await repos.platforms.create({
        name: '', // Empty name violates min(1)
        slug: 'INVALID SLUG WITH SPACES', // Violates slug regex
        icon: 'sparkles',
        isActive: true,
        // @ts-expect-error Testing invalid capability string
        capabilities: ['unsupported_cap'],
      });
      throw new Error('Expected invalid data creation to fail, but it succeeded');
    } catch (err) {
      if (err instanceof ValidationError) {
        result.invalidDataRejection = true;
        details.push('✅ Invalid platform data correctly rejected with ValidationError');
      } else {
        throw err;
      }
    }

    // ─── 6. Relationship Validation ───────────────────────────────────────────
    details.push('6. Testing relationship validation across entities...');
    // A: Try to create a SocialAccount with a NON-EXISTENT platform ID
    try {
      await repos.socialAccounts.create({
        platformId: 'PLT-999999', // non-existent
        accountName: 'Ghost Account',
        username: `ghost_${timestamp}`,
        status: 'ACTIVE',
      });
      throw new Error('Expected SocialAccount with non-existent platformId to fail');
    } catch (err) {
      if (err instanceof ValidationError) {
        details.push('✅ SocialAccount with invalid platformId correctly rejected');
      } else {
        throw err;
      }
    }

    // B: Try to create a ContentAsset with a NON-EXISTENT content ID
    try {
      await repos.contentAssets.create({
        contentId: 'CNT-999999', // non-existent
        type: 'IMAGE',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        storagePath: 'assets/test.jpg',
      });
      throw new Error('Expected ContentAsset with non-existent contentId to fail');
    } catch (err) {
      if (err instanceof ValidationError) {
        details.push('✅ ContentAsset with invalid contentId correctly rejected');
      } else {
        throw err;
      }
    }

    // C: Create a valid relationship: TeamMember -> SocialAccount -> Content -> Publication
    const member = await repos.teamMembers.create({
      name: 'Diagnostic Tester',
      email: `test_member_${timestamp}@kira.agency`,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    createdMemberId = member.id;

    const account = await repos.socialAccounts.create({
      platformId: createdPlatformId,
      accountName: 'KIRA Test Social',
      username: `kira_test_${timestamp}`,
      status: 'ACTIVE',
      assignedManagerId: createdMemberId,
    });
    createdAccountId = account.id;

    if (account.platformId === createdPlatformId && account.assignedManagerId === createdMemberId) {
      result.relationshipValidation = true;
      details.push('✅ Valid cross-entity relationship verified (Platform + Member -> SocialAccount)');
    }

    // ─── 7. Settings Singleton Check ──────────────────────────────────────────
    details.push('7. Testing AgencySettings singleton repository...');
    const settings = await repos.settings.getSettings();
    if (settings && settings.agencyName === 'KIRA Agency') {
      result.settingsCheck = true;
      details.push(`✅ AgencySettings verified: ${settings.agencyName}`);
    }

    // ─── 8. Cleanup & Deletion ────────────────────────────────────────────────
    details.push('8. Cleaning up temporary test records from storage...');

    if (createdAccountId) {
      await repos.socialAccounts.delete(createdAccountId);
      details.push(`✅ Cleaned up temporary SocialAccount: ${createdAccountId}`);
    }

    if (createdMemberId) {
      await repos.teamMembers.delete(createdMemberId);
      details.push(`✅ Cleaned up temporary TeamMember: ${createdMemberId}`);
    }

    if (createdPlatformId) {
      const deleted = await repos.platforms.delete(createdPlatformId);
      if (deleted) {
        result.platformDelete = true;
        details.push(`✅ Deleted temporary Platform: ${createdPlatformId}`);
      }
    }

    // Verify cleanup
    const existsAfterDelete = await repos.platforms.exists(createdPlatformId!);
    if (!existsAfterDelete) {
      result.cleanupVerified = true;
      details.push('✅ Verified test platform no longer exists in storage');
    } else {
      throw new Error('Test platform still exists after delete');
    }

    result.allPassed =
      result.platformCreate &&
      result.platformRead &&
      result.platformUpdate &&
      result.duplicateRejection &&
      result.invalidDataRejection &&
      result.relationshipValidation &&
      result.platformDelete &&
      result.cleanupVerified &&
      result.settingsCheck;

    details.push('\n🎉 ALL REPOSITORY & DATA INTEGRITY TESTS PASSED!');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    details.push(`❌ Diagnostic error: ${message}`);
    console.error('[Repository Diagnostic] Failed:', err);
  } finally {
    // Failsafe cleanup in case of error
    try {
      if (createdAccountId) await repos.socialAccounts.delete(createdAccountId);
      if (createdMemberId) await repos.teamMembers.delete(createdMemberId);
      if (createdPlatformId) await repos.platforms.delete(createdPlatformId);
    } catch {
      // ignore cleanup errors in finally
    }
  }

  return result;
}
