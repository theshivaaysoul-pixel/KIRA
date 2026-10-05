// tests/unit/validation-and-workflows.test.ts
// Unit tests for Validation schemas, workflow state transitions, ID generation, and secret redaction.

import { harness } from '../test-helper';
import {
  CreateSocialAccountSchema,
  CreateTaskSchema,
  CreateContentSchema,
  CreatePlatformSchema,
  VALID_TASK_STATUS_TRANSITIONS,
  PublicationStatusEnum,
} from '@/lib/validation';
import { getSecretService } from '@/lib/secrets/secret-service';
import { logSecurityActivity } from '@/lib/auth/authorization';
import { getRepositories } from '@/lib/repositories';

export async function runUnitTests(): Promise<void> {
  harness.setSuite('Unit Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: Unit Tests (Validation, Workflow, IDs, Redaction)');
  console.log('===============================================================\n');

  // ─── 1. Validation Schemas ──────────────────────────────────────────────────
  await harness.runTest('Validation: CreateSocialAccountSchema accepts valid payload', () => {
    const valid = CreateSocialAccountSchema.safeParse({
      platformId: 'PLT-000001',
      accountName: 'KIRA Official',
      username: 'kira_agency',
      status: 'ACTIVE',
      profileUrl: 'https://instagram.com/kira_agency',
      niche: 'AI Management',
    });
    harness.assert(valid.success, 'Valid social account payload passed validation');
  });

  await harness.runTest('Validation: CreateSocialAccountSchema rejects invalid URL', () => {
    const invalid = CreateSocialAccountSchema.safeParse({
      platformId: 'PLT-000001',
      accountName: 'KIRA Official',
      username: 'kira_agency',
      profileUrl: 'not-a-valid-http-url',
    });
    harness.assert(!invalid.success, 'Invalid profileUrl was rejected');
  });

  await harness.runTest('Validation: CreateSocialAccountSchema rejects dangerous URL scheme', () => {
    const invalid = CreateSocialAccountSchema.safeParse({
      platformId: 'PLT-000001',
      accountName: 'KIRA Official',
      username: 'kira_agency',
      profileUrl: 'javascript:alert(1)',
    });
    harness.assert(!invalid.success, 'javascript: URL scheme was rejected');
  });

  await harness.runTest('Validation: CreateSocialAccountSchema rejects invalid status enum', () => {
    const invalid = CreateSocialAccountSchema.safeParse({
      platformId: 'PLT-000001',
      accountName: 'KIRA Official',
      username: 'kira_agency',
      status: 'DELETED_BANNED_UNKNOWN',
    });
    harness.assert(!invalid.success, 'Unsupported status enum was rejected');
  });

  await harness.runTest('Validation: CreateTaskSchema requires non-empty title', () => {
    const invalid = CreateTaskSchema.safeParse({
      title: '   ',
      status: 'TODO',
      priority: 'HIGH',
    });
    harness.assert(!invalid.success, 'Whitespace-only title was rejected');
  });

  await harness.runTest('Validation: CreateTaskSchema rejects invalid priority enum', () => {
    const invalid = CreateTaskSchema.safeParse({
      title: 'Valid Task Title',
      priority: 'ULTRA_CRITICAL',
    });
    harness.assert(!invalid.success, 'Invalid priority enum was rejected');
  });

  await harness.runTest('Validation: CreateContentSchema requires title and valid contentType', () => {
    const invalid = CreateContentSchema.safeParse({
      title: '',
      contentType: 'INVALID_TYPE',
    });
    harness.assert(!invalid.success, 'Empty title and invalid contentType rejected');

    const valid = CreateContentSchema.safeParse({
      title: 'Quarterly Campaign Reel',
      contentType: 'REEL',
      status: 'IDEA',
      createdBy: 'USR-000001',
    });
    harness.assert(valid.success, 'Valid content schema payload accepted');
  });

  await harness.runTest('Validation: CreatePlatformSchema validates capabilities', () => {
    const valid = CreatePlatformSchema.safeParse({
      name: 'Custom Platform',
      slug: 'custom-platform',
      icon: 'layers',
      capabilities: ['text', 'image', 'video'],
      isActive: true,
    });
    harness.assert(valid.success, 'Valid platform schema accepted');

    const invalid = CreatePlatformSchema.safeParse({
      name: 'Custom Platform',
      slug: 'custom-platform',
      icon: 'layers',
      capabilities: ['teleportation', 'time-travel'], // invalid capabilities
      isActive: true,
    });
    harness.assert(!invalid.success, 'Unsupported platform capability rejected');
  });

  // ─── 2. Workflow State Transitions ──────────────────────────────────────────
  await harness.runTest('Workflow: Content state machine valid transitions', async () => {
    const { CONTENT_WORKFLOW_TRANSITIONS } = await import('@/lib/types/domain');
    harness.assert(CONTENT_WORKFLOW_TRANSITIONS['IDEA']?.includes('SCRIPT'), 'IDEA -> SCRIPT is valid');
    harness.assert(CONTENT_WORKFLOW_TRANSITIONS['SCRIPT']?.includes('PRODUCTION'), 'SCRIPT -> PRODUCTION is valid');
    harness.assert(CONTENT_WORKFLOW_TRANSITIONS['PRODUCTION']?.includes('EDITING'), 'PRODUCTION -> EDITING is valid');
    harness.assert(CONTENT_WORKFLOW_TRANSITIONS['EDITING']?.includes('REVIEW'), 'EDITING -> REVIEW is valid');
    harness.assert(CONTENT_WORKFLOW_TRANSITIONS['REVIEW']?.includes('APPROVED'), 'REVIEW -> APPROVED is valid');
  });

  await harness.runTest('Workflow: Content state machine rejects jumping from IDEA directly to PUBLISHED', async () => {
    const { validateTransition, WorkflowError } = await import('@/lib/services/content-workflow-service');
    const mockContent = {
      id: 'CNT-000001',
      title: 'Test',
      status: 'IDEA',
      createdBy: 'USR-000001',
      hashtags: [],
      contentType: 'POST',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    } as unknown as import('@/lib/types/domain').Content;
    const mockActor = { id: 'USR-000001', role: 'OWNER', status: 'ACTIVE' } as unknown as import('@/lib/types/domain').TeamMember;

    let threw = false;
    try {
      validateTransition(mockContent, 'PUBLISHED', mockActor);
    } catch (err) {
      threw = err instanceof WorkflowError;
    }
    harness.assert(threw, 'Direct transition from IDEA to PUBLISHED threw WorkflowError');
  });

  await harness.runTest('Workflow: Content state machine rejects transitions out of ARCHIVED', async () => {
    const { validateTransition, WorkflowError } = await import('@/lib/services/content-workflow-service');
    const archivedContent = {
      id: 'CNT-000001',
      title: 'Archived',
      status: 'ARCHIVED',
      createdBy: 'USR-000001',
      hashtags: [],
      contentType: 'POST',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    } as unknown as import('@/lib/types/domain').Content;
    const mockActor = { id: 'USR-000001', role: 'OWNER', status: 'ACTIVE' } as unknown as import('@/lib/types/domain').TeamMember;

    let threw = false;
    try {
      validateTransition(archivedContent, 'APPROVED', mockActor);
    } catch (err) {
      threw = err instanceof WorkflowError && (err as { code?: string }).code === 'WORKFLOW_ARCHIVED';
    }
    harness.assert(threw, 'Transition out of ARCHIVED threw WORKFLOW_ARCHIVED WorkflowError');
  });

  await harness.runTest('Workflow: Task state machine valid transitions', () => {
    harness.assert(VALID_TASK_STATUS_TRANSITIONS['TODO'].includes('IN_PROGRESS'), 'TODO -> IN_PROGRESS allowed');
    harness.assert(VALID_TASK_STATUS_TRANSITIONS['IN_PROGRESS'].includes('REVIEW'), 'IN_PROGRESS -> REVIEW allowed');
    harness.assert(VALID_TASK_STATUS_TRANSITIONS['REVIEW'].includes('COMPLETED'), 'REVIEW -> COMPLETED allowed');
    harness.assert(VALID_TASK_STATUS_TRANSITIONS['TODO'].includes('CANCELLED'), 'TODO -> CANCELLED allowed');
    harness.assert(!VALID_TASK_STATUS_TRANSITIONS['COMPLETED'].includes('TODO'), 'COMPLETED -> TODO blocked');
  });

  await harness.runTest('Workflow: Publication state machine registered statuses', () => {
    const validStates = [
      'QUEUED',
      'PROCESSING',
      'PUBLISHED',
      'FAILED',
      'RETRYING',
      'CANCELLED',
    ];
    for (const s of validStates) {
      harness.assert(PublicationStatusEnum.options.includes(s as (typeof PublicationStatusEnum.options)[number]), `Publication status "${s}" is registered`);
    }
  });

  // ─── 3. ID Generation Formats ───────────────────────────────────────────────
  await harness.runTest('ID Generation: All 10 entity prefixes and format conformity', async () => {
    const repos = getRepositories();
    const prefixMap = [
      { repo: repos.platforms, prefix: 'PLT', name: 'Platform' },
      { repo: repos.socialAccounts, prefix: 'ACC', name: 'SocialAccount' },
      { repo: repos.content, prefix: 'CNT', name: 'Content' },
      { repo: repos.contentAssets, prefix: 'AST', name: 'ContentAsset' },
      { repo: repos.publications, prefix: 'PUB', name: 'Publication' },
      { repo: repos.teamMembers, prefix: 'USR', name: 'TeamMember' },
      { repo: repos.tasks, prefix: 'TSK', name: 'Task' },
      { repo: repos.analytics, prefix: 'ANL', name: 'Analytics' },
      { repo: repos.notifications, prefix: 'NTF', name: 'Notification' },
      { repo: repos.activityLogs, prefix: 'ACT', name: 'ActivityLog' },
    ];

    for (const { repo, prefix, name } of prefixMap) {
      // Test prefix consistency on existing records or generator helper
      const existing = await repo.findAll();
      if (existing.length > 0) {
        for (const item of existing) {
          const id = (item as { id: string }).id;
          const regex = new RegExp(`^${prefix}-\\d{6}$`);
          harness.assert(regex.test(id), `${name} ID "${id}" conforms to pattern ^${prefix}-\\d{6}$`);
        }
      }
    }
  });

  // ─── 4. Redaction & Secret Management ───────────────────────────────────────
  await harness.runTest('Secret Management: SecretService blocks NEXT_PUBLIC_ variables from secret storage', () => {
    const service = getSecretService();
    const result = service.getSecret('NEXT_PUBLIC_FIREBASE_API_KEY');
    harness.assertEqual(result, undefined, 'NEXT_PUBLIC_ variable access returned undefined');

    const status = service.checkSecret('NEXT_PUBLIC_FIREBASE_API_KEY');
    harness.assertEqual(status.availability, 'error', 'checkSecret returns "error" for NEXT_PUBLIC_');
  });

  await harness.runTest('Redaction: logSecurityActivity strictly redacts sensitive metadata keys', async () => {
    const repos = getRepositories();
    await logSecurityActivity('USR-000001', 'LOGIN', 'TestSecurityHarness', 'test-sec-unit-1', {
      normalField: 'acceptable_data',
      password: 'plain_password',
      accessToken: 'jwt.token.here',
      refreshToken: 'refresh.token.here',
      apiKey: 'secret_key_123',
      privateKey: 'BEGIN RSA PRIVATE KEY',
    });

    const logs = await repos.activityLogs.findAll();
    const entry = logs.find((l) => l.entityId === 'test-sec-unit-1');
    harness.assert(!!entry && !!entry.metadata, 'Audit log entry created with metadata');
    if (entry?.metadata) {
      harness.assertEqual(entry.metadata.normalField, 'acceptable_data', 'Normal field preserved');
      harness.assertEqual(entry.metadata.password, undefined, 'Password omitted');
      harness.assertEqual(entry.metadata.accessToken, undefined, 'AccessToken omitted');
      harness.assertEqual(entry.metadata.refreshToken, undefined, 'RefreshToken omitted');
      harness.assertEqual(entry.metadata.apiKey, undefined, 'API key omitted');
      harness.assertEqual(entry.metadata.privateKey, undefined, 'PrivateKey omitted');
    }

    // Cleanup
    if (entry) {
      await repos.activityLogs.delete(entry.id);
    }
  });
}
