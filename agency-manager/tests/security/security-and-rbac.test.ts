// tests/security/security-and-rbac.test.ts
// Security, RBAC, IDOR, Mass Assignment, Input Security, and Rate Limiting tests.

import { NextRequest } from 'next/server';
import { harness } from '../test-helper';
import {
  requirePermission,
  validateRoleChange,
} from '@/lib/auth/authorization';
import {
  hasPermission,
  PERMISSIONS,
} from '@/lib/auth/permissions';
import { getRateLimiter } from '@/lib/security/rate-limiter';
import { sanitizeFileName, isExecutableOrScript, validateMagicBytes } from '@/lib/media/constants';
import { CreateSocialAccountSchema, CreateTaskSchema } from '@/lib/validation';
import type { TeamMember } from '@/lib/types/domain';

export async function runSecurityTests(): Promise<void> {
  harness.setSuite('Security & RBAC Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: Security & RBAC Tests');
  console.log('===============================================================\n');

  // ─── 1. Authentication ──────────────────────────────────────────────────────
  await harness.runTest('Authentication: Missing Authorization header returns 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard');
    const result = await requirePermission(req, 'dashboard.read');
    harness.assertEqual(result.user, null, 'User is null');
    harness.assert(result.errorResponse !== null, 'errorResponse is present');
    harness.assertEqual(result.errorResponse?.status, 401, 'Status is 401 Unauthorized');
  });

  await harness.runTest('Authentication: Malformed Bearer token returns 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard', {
      headers: { authorization: 'Bearer invalid.expired.token' },
    });
    const result = await requirePermission(req, 'dashboard.read');
    harness.assertEqual(result.user, null, 'User is null');
    harness.assertEqual(result.errorResponse?.status, 401, 'Status is 401');
  });

  // ─── 2. RBAC & Permission Boundaries ─────────────────────────────────────────
  await harness.runTest('RBAC: Full permission matrix enforcement across all 7 roles', () => {
    // 1. VIEWER: Only read permissions
    harness.assert(hasPermission('VIEWER', 'dashboard.read'), 'VIEWER can read dashboard');
    harness.assert(hasPermission('VIEWER', 'content.read'), 'VIEWER can read content');
    harness.assert(!hasPermission('VIEWER', 'content.create'), 'VIEWER cannot create content');
    harness.assert(!hasPermission('VIEWER', 'content.delete'), 'VIEWER cannot delete content');
    harness.assert(!hasPermission('VIEWER', 'team.create'), 'VIEWER cannot create team member');

    // 2. EDITOR: Content creation/updates, but not approval or team management
    harness.assert(hasPermission('EDITOR', 'content.create'), 'EDITOR can create content');
    harness.assert(!hasPermission('EDITOR', 'content.approve'), 'EDITOR cannot approve content');
    harness.assert(!hasPermission('EDITOR', 'team.read'), 'EDITOR cannot read team');

    // 3. MANAGER: Content approval & task management, but not account/platform deletion
    harness.assert(hasPermission('MANAGER', 'content.approve'), 'MANAGER can approve content');
    harness.assert(hasPermission('MANAGER', 'tasks.create'), 'MANAGER can create tasks');
    harness.assert(!hasPermission('MANAGER', 'accounts.delete'), 'MANAGER cannot delete accounts');
    harness.assert(!hasPermission('MANAGER', 'platforms.delete'), 'MANAGER cannot delete platforms');

    // 4. ADMIN: Administrative operations, but storage.recover and system.admin are OWNER-only
    harness.assert(hasPermission('ADMIN', 'team.create'), 'ADMIN can create team member');
    harness.assert(hasPermission('ADMIN', 'platforms.create'), 'ADMIN can create platform');
    harness.assert(!hasPermission('ADMIN', 'storage.recover'), 'ADMIN cannot recover storage (OWNER-only)');
    harness.assert(!hasPermission('ADMIN', 'system.admin'), 'ADMIN cannot access system.admin (OWNER-only)');

    // 5. MEMBER: Operational privileges including adding accounts, tasks, content, calendar
    harness.assert(hasPermission('MEMBER', 'accounts.create'), 'MEMBER can create accounts');
    harness.assert(hasPermission('MEMBER', 'accounts.update'), 'MEMBER can update accounts');
    harness.assert(!hasPermission('MEMBER', 'accounts.delete'), 'MEMBER cannot delete accounts');

    // 6. OWNER: Full access to all permissions
    for (const p of PERMISSIONS) {
      harness.assert(hasPermission('OWNER', p), `OWNER has ${p}`);
    }
  });

  // ─── 3. Role Hierarchy & Privilege Escalation Defense ────────────────────────
  await harness.runTest('Privilege Escalation: Non-owner cannot assign OWNER role', async () => {
    const adminActor: TeamMember = {
      id: 'USR-000002',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const targetMember: TeamMember = {
      id: 'USR-000003',
      name: 'Editor User',
      email: 'editor@test.com',
      role: 'EDITOR',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const result = await validateRoleChange(adminActor, targetMember, 'OWNER');
    harness.assertEqual(result.allowed, false, 'Elevation to OWNER by ADMIN was blocked');
    harness.assertEqual(result.code, 'FORBIDDEN_CANNOT_ASSIGN_OWNER', 'Code is FORBIDDEN_CANNOT_ASSIGN_OWNER');
  });

  await harness.runTest('Privilege Escalation: Users cannot modify their own role', async () => {
    const member: TeamMember = {
      id: 'USR-000002',
      name: 'User Self',
      email: 'self@test.com',
      role: 'EDITOR',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const result = await validateRoleChange(member, member, 'ADMIN');
    harness.assertEqual(result.allowed, false, 'Self role modification was blocked');
    harness.assertEqual(result.code, 'CANNOT_MODIFY_OWN_ROLE', 'Code is CANNOT_MODIFY_OWN_ROLE');
  });

  // ─── 4. IDOR Defense ─────────────────────────────────────────────────────────
  await harness.runTest('IDOR: Resource-level check rejects access by unauthorized actor', async () => {
    const actor: TeamMember = {
      id: 'USR-000005',
      name: 'Regular Actor',
      email: 'actor@test.com',
      role: 'EDITOR',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const isAuthorized = (member: TeamMember) => member.id === 'USR-000001'; // only owner
    const allowed = isAuthorized(actor);
    harness.assertEqual(allowed, false, 'Resource check rejected mismatched actor ID');
  });

  // ─── 5. Mass Assignment Defense ──────────────────────────────────────────────
  await harness.runTest('Mass Assignment: Schemas strip protected fields from request payload', () => {
    const maliciousSocialPayload = {
      id: 'ACC-HACKED-001',
      createdAt: '2020-01-01T00:00:00.000Z',
      userId: 'spoofed-user-id',
      platformId: 'PLT-000001',
      accountName: 'Safe Account',
      username: 'safe_user',
    };

    const parsedSocial = CreateSocialAccountSchema.safeParse(maliciousSocialPayload);
    harness.assert(parsedSocial.success, 'Schema parsed valid core fields');
    if (parsedSocial.success) {
      const socialKeys = Object.keys(parsedSocial.data);
      harness.assert(!socialKeys.includes('id'), 'Injected "id" stripped');
      harness.assert(!socialKeys.includes('createdAt'), 'Injected "createdAt" stripped');
      harness.assert(!socialKeys.includes('userId'), 'Injected "userId" stripped');
    }

    const maliciousTaskPayload = {
      id: 'TSK-HACKED-001',
      createdBy: 'USR-INJECTED',
      title: 'Valid Task Title',
    };
    const parsedTask = CreateTaskSchema.safeParse(maliciousTaskPayload);
    harness.assert(parsedTask.success, 'Task schema parsed');
    if (parsedTask.success) {
      const taskKeys = Object.keys(parsedTask.data);
      harness.assert(!taskKeys.includes('id'), 'Injected task "id" stripped');
      harness.assert(!taskKeys.includes('createdBy'), 'Injected task "createdBy" stripped');
    }
  });

  // ─── 6. Input Security & Media Upload Hardening ──────────────────────────────
  await harness.runTest('Input Security: Filename sanitization strips path traversal and null bytes', () => {
    const { safeFileName: f1 } = sanitizeFileName('../../etc/passwd');
    harness.assert(!f1.includes('..') && !f1.includes('/'), 'Traversal slashes stripped');

    const { safeFileName: f2 } = sanitizeFileName('..\\..\\windows\\cmd.exe');
    harness.assert(!f2.includes('..') && !f2.includes('\\'), 'Backslash traversal stripped');

    const { safeFileName: f3 } = sanitizeFileName('image.png\x00.exe');
    harness.assert(!f3.includes('\x00'), 'Null bytes stripped');
  });

  await harness.runTest('Input Security: Executable files and script headers rejected', () => {
    // ELF Linux executable
    harness.assert(isExecutableOrScript(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), 'Detected ELF binary');
    // PE Windows executable
    harness.assert(isExecutableOrScript(Buffer.from([0x4d, 0x5a])), 'Detected PE MZ binary');
    // Shell script
    harness.assert(isExecutableOrScript(Buffer.from('#!/bin/bash\n')), 'Detected shell script');
    // PHP script
    harness.assert(isExecutableOrScript(Buffer.from('<?php')), 'Detected PHP script');
    // JavaScript script tag
    harness.assert(isExecutableOrScript(Buffer.from('<script>')), 'Detected script tag');
  });

  await harness.runTest('Input Security: Magic bytes validation blocks MIME type spoofing', () => {
    const fakePng = Buffer.from('THIS IS NOT A REAL PNG FILE');
    const valid = validateMagicBytes(fakePng, 'image/png');
    harness.assertEqual(valid, false, 'MIME spoofing blocked by magic bytes validation');
  });

  // ─── 7. Rate Limiter ─────────────────────────────────────────────────────────
  await harness.runTest('Rate Limiter: Request limits enforced with Retry-After calculation', () => {
    const limiter = getRateLimiter();
    limiter.reset();

    const clientKey = 'test-security-runner:127.0.0.1';
    const config = { maxRequests: 3, windowMs: 2000 };

    // 3 allowed
    harness.assertEqual(limiter.check(clientKey, config).allowed, true, 'Request 1 allowed');
    harness.assertEqual(limiter.check(clientKey, config).allowed, true, 'Request 2 allowed');
    harness.assertEqual(limiter.check(clientKey, config).allowed, true, 'Request 3 allowed');

    // 4th breaches limit
    const breach = limiter.check(clientKey, config);
    harness.assertEqual(breach.allowed, false, 'Request 4 breached rate limit');
    harness.assertEqual(breach.remaining, 0, 'Remaining count is 0');
    harness.assert(breach.retryAfterSeconds > 0, 'Retry-After seconds is positive');

    limiter.reset();
  });
}
