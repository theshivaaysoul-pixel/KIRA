// scripts/verify-phase3.mjs
// Phase 3 Authentication & Roles Verification Script for KIRA Agency Manager
// Comprehensive automated test suite for identity mapping, 7-role permission matrix,
// server-side authorization layer, IDOR safeguards, self-promotion protection,
// last-owner protection, and storage admin authorization.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  ROLE_HIERARCHY,
  isRoleSuperior,
  isRoleAtLeast,
} = await import('../src/lib/auth/permissions.ts');

const {
  hasRole,
  hasPermissionForMember,
  validateRoleChange,
  logSecurityActivity,
} = await import('../src/lib/auth/authorization.ts');

const {
  getTeamMemberRepository,
  getActivityLogRepository,
} = await import('../src/lib/repositories/index.ts');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 3 AUTH & ROLES VERIFICATION');
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
  // -------------------------------------------------------------------------
  // Test 1: Centralized Permission Matrix & All 7 Roles
  // -------------------------------------------------------------------------
  console.log('1. Testing Centralized Permission Matrix for all 7 Roles...');

  const ALL_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'DESIGNER', 'ANALYST', 'VIEWER'];
  assert(ALL_ROLES.length === 7, 'All 7 distinct roles exist');
  assert(PERMISSIONS.length === 35, `Defined exactly 35 discrete permissions (found ${PERMISSIONS.length})`);

  // OWNER has 100% permissions
  const ownerPerms = getRolePermissions('OWNER');
  assert(ownerPerms.length === 35, 'OWNER has access to all 35 permissions');
  assert(hasPermission('OWNER', 'storage.recover'), 'OWNER has storage.recover');
  assert(hasPermission('OWNER', 'system.admin'), 'OWNER has system.admin');

  // ADMIN
  const adminPerms = getRolePermissions('ADMIN');
  assert(hasPermission('ADMIN', 'storage.backup'), 'ADMIN has storage.backup');
  assert(hasPermission('ADMIN', 'storage.read'), 'ADMIN has storage.read');
  assert(!hasPermission('ADMIN', 'storage.recover'), 'ADMIN CANNOT perform storage.recover');
  assert(!hasPermission('ADMIN', 'system.admin'), 'ADMIN CANNOT perform system.admin');
  assert(hasPermission('ADMIN', 'team.role.update'), 'ADMIN has team.role.update');

  // MANAGER
  assert(hasPermission('MANAGER', 'content.approve'), 'MANAGER can approve content');
  assert(hasPermission('MANAGER', 'accounts.update'), 'MANAGER can update accounts');
  assert(!hasPermission('MANAGER', 'storage.backup'), 'MANAGER CANNOT perform storage.backup');
  assert(!hasPermission('MANAGER', 'storage.recover'), 'MANAGER CANNOT perform storage.recover');
  assert(!hasPermission('MANAGER', 'team.role.update'), 'MANAGER CANNOT update team roles');
  assert(!hasPermission('MANAGER', 'settings.update'), 'MANAGER CANNOT update settings');

  // EDITOR
  assert(hasPermission('EDITOR', 'content.create'), 'EDITOR can create content');
  assert(hasPermission('EDITOR', 'content.update'), 'EDITOR can update content');
  assert(!hasPermission('EDITOR', 'content.approve'), 'EDITOR CANNOT approve content');
  assert(!hasPermission('EDITOR', 'team.read'), 'EDITOR CANNOT read team list');
  assert(!hasPermission('EDITOR', 'storage.recover'), 'EDITOR CANNOT perform storage.recover');

  // DESIGNER
  assert(hasPermission('DESIGNER', 'content.read'), 'DESIGNER can read content');
  assert(hasPermission('DESIGNER', 'content.update'), 'DESIGNER can update content assets');
  assert(!hasPermission('DESIGNER', 'content.create'), 'DESIGNER CANNOT create new content entities');
  assert(!hasPermission('DESIGNER', 'content.approve'), 'DESIGNER CANNOT approve content');
  assert(!hasPermission('DESIGNER', 'team.read'), 'DESIGNER CANNOT read team list');

  // ANALYST
  assert(hasPermission('ANALYST', 'analytics.read'), 'ANALYST can read analytics');
  assert(hasPermission('ANALYST', 'dashboard.read'), 'ANALYST can read dashboard');
  assert(!hasPermission('ANALYST', 'content.create'), 'ANALYST CANNOT create content');
  assert(!hasPermission('ANALYST', 'accounts.create'), 'ANALYST CANNOT create accounts');
  assert(!hasPermission('ANALYST', 'storage.backup'), 'ANALYST CANNOT backup storage');

  // VIEWER
  assert(hasPermission('VIEWER', 'dashboard.read'), 'VIEWER can read dashboard');
  assert(hasPermission('VIEWER', 'content.read'), 'VIEWER can read content');
  assert(!hasPermission('VIEWER', 'content.create'), 'VIEWER CANNOT create content');
  assert(!hasPermission('VIEWER', 'content.approve'), 'VIEWER CANNOT approve content');
  assert(!hasPermission('VIEWER', 'team.read'), 'VIEWER CANNOT view team management');
  assert(!hasPermission('VIEWER', 'storage.read'), 'VIEWER CANNOT access storage administration');

  // -------------------------------------------------------------------------
  // Test 2: Role Hierarchy & Superiority
  // -------------------------------------------------------------------------
  console.log('\n2. Testing Role Hierarchy and Privilege Comparisons...');
  assert(ROLE_HIERARCHY.OWNER > ROLE_HIERARCHY.ADMIN, 'OWNER rank is higher than ADMIN');
  assert(ROLE_HIERARCHY.ADMIN > ROLE_HIERARCHY.MANAGER, 'ADMIN rank is higher than MANAGER');
  assert(ROLE_HIERARCHY.MANAGER > ROLE_HIERARCHY.EDITOR, 'MANAGER rank is higher than EDITOR');
  assert(ROLE_HIERARCHY.EDITOR > ROLE_HIERARCHY.ANALYST, 'EDITOR rank is higher than ANALYST');
  assert(ROLE_HIERARCHY.ANALYST > ROLE_HIERARCHY.VIEWER, 'ANALYST rank is higher than VIEWER');

  assert(isRoleSuperior('OWNER', 'ADMIN'), 'OWNER is superior to ADMIN');
  assert(!isRoleSuperior('ADMIN', 'OWNER'), 'ADMIN is NOT superior to OWNER');
  assert(!isRoleSuperior('ADMIN', 'ADMIN'), 'ADMIN is NOT superior to ADMIN');
  assert(isRoleAtLeast('ADMIN', 'MANAGER'), 'ADMIN is at least MANAGER');
  assert(!isRoleAtLeast('VIEWER', 'EDITOR'), 'VIEWER is NOT at least EDITOR');

  // -------------------------------------------------------------------------
  // Test 3: Account Status Authorization & Access Enforcement
  // -------------------------------------------------------------------------
  console.log('\n3. Testing Account Status Authorization (ACTIVE vs INACTIVE vs SUSPENDED)...');
  const now = new Date().toISOString();

  const activeAdmin = {
    id: 'USR-000001',
    name: 'Active Admin',
    email: 'admin@kira.agency',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const suspendedAdmin = {
    ...activeAdmin,
    id: 'USR-000002',
    status: 'SUSPENDED',
  };

  const inactiveManager = {
    id: 'USR-000003',
    name: 'Inactive Manager',
    email: 'inactive@kira.agency',
    role: 'MANAGER',
    status: 'INACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  assert(hasPermissionForMember(activeAdmin, 'content.read'), 'Active admin has content.read');
  assert(!hasPermissionForMember(suspendedAdmin, 'content.read'), 'Suspended admin is DENIED all permissions');
  assert(!hasPermissionForMember(inactiveManager, 'content.read'), 'Inactive manager is DENIED all permissions');

  // -------------------------------------------------------------------------
  // Test 4: Privilege Escalation, Self-Promotion & Hierarchy Guards
  // -------------------------------------------------------------------------
  console.log('\n4. Testing Self-Promotion and Privilege Escalation Safeguards...');

  const ownerActor = {
    id: 'USR-000010',
    name: 'Agency Owner',
    email: 'owner@kira.agency',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const adminActor = {
    id: 'USR-000020',
    name: 'Agency Admin',
    email: 'admin2@kira.agency',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const targetMember = {
    id: 'USR-000030',
    name: 'Agency Editor',
    email: 'editor@kira.agency',
    role: 'EDITOR',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  // Test 4a: Self-promotion attempt
  const selfPromo = await validateRoleChange(adminActor, adminActor, 'OWNER');
  assert(!selfPromo.allowed, 'Self-role change is blocked');
  assert(selfPromo.code === 'CANNOT_MODIFY_OWN_ROLE', 'Returns CANNOT_MODIFY_OWN_ROLE error code');

  // Test 4b: Admin attempting to assign OWNER to someone else
  const adminAssignOwner = await validateRoleChange(adminActor, targetMember, 'OWNER');
  assert(!adminAssignOwner.allowed, 'Non-owner cannot assign OWNER role');
  assert(adminAssignOwner.code === 'FORBIDDEN_CANNOT_ASSIGN_OWNER', 'Returns FORBIDDEN_CANNOT_ASSIGN_OWNER error code');

  // Test 4c: Admin attempting to modify another Admin (hierarchy violation)
  const anotherAdmin = {
    id: 'USR-000021',
    name: 'Peer Admin',
    email: 'admin3@kira.agency',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  const peerModify = await validateRoleChange(adminActor, anotherAdmin, 'EDITOR');
  assert(!peerModify.allowed, 'Admin cannot demote a peer admin');
  assert(peerModify.code === 'FORBIDDEN_HIERARCHY_VIOLATION', 'Returns FORBIDDEN_HIERARCHY_VIOLATION');

  // Test 4d: Owner permitted to change Editor to Manager
  const ownerValidUpdate = await validateRoleChange(ownerActor, targetMember, 'MANAGER');
  assert(ownerValidUpdate.allowed, 'Owner can promote Editor to Manager');

  // -------------------------------------------------------------------------
  // Test 5: Last Owner Protection Safeguard
  // -------------------------------------------------------------------------
  console.log('\n5. Testing Last Active OWNER Safeguard...');

  const teamRepo = getTeamMemberRepository();
  let allMembers = await teamRepo.findAll();
  let currentOwner = allMembers.find((m) => m.role === 'OWNER' && m.status === 'ACTIVE');

  if (!currentOwner) {
    console.log('   Creating test agency OWNER in repository...');
    currentOwner = await teamRepo.create({
      name: 'KIRA Head Owner',
      email: 'primary-owner@kira.agency',
      role: 'OWNER',
      status: 'ACTIVE',
    });
  }

  const activeOwners = await teamRepo.countActiveOwners();
  assert(typeof activeOwners === 'number' && activeOwners >= 1, `countActiveOwners returns active count: ${activeOwners}`);

  if (activeOwners === 1) {
    // Attempting to demote sole owner to ADMIN
    const demoteCheck = await validateRoleChange(ownerActor, currentOwner, 'ADMIN');
    assert(!demoteCheck.allowed, 'Demoting the sole remaining active owner is BLOCKED');
    assert(demoteCheck.code === 'CANNOT_REMOVE_LAST_OWNER', 'Returns CANNOT_REMOVE_LAST_OWNER');

    // Attempting to suspend sole owner
    const suspendCheck = await validateRoleChange(ownerActor, currentOwner, undefined, 'SUSPENDED');
    assert(!suspendCheck.allowed, 'Suspending the sole remaining active owner is BLOCKED');
    assert(suspendCheck.code === 'CANNOT_REMOVE_LAST_OWNER', 'Returns CANNOT_REMOVE_LAST_OWNER');

    // Attempting to deactivate sole owner
    const deactivateCheck = await validateRoleChange(ownerActor, currentOwner, undefined, 'INACTIVE');
    assert(!deactivateCheck.allowed, 'Deactivating the sole remaining active owner is BLOCKED');
    assert(deactivateCheck.code === 'CANNOT_REMOVE_LAST_OWNER', 'Returns CANNOT_REMOVE_LAST_OWNER');
  }

  // -------------------------------------------------------------------------
  // Test 6: TeamMember Identity Mapping & Repository Methods
  // -------------------------------------------------------------------------
  console.log('\n6. Testing TeamMember Identity Mapping & Auto-linking...');

  // Search by non-existent identity
  const nonExistent = await teamRepo.findByAuthIdentity('non-existent-uid', 'non-existent@nowhere.com');
  assert(nonExistent === null, 'Non-existent auth identity returns null (no silent OWNER creation)');

  // Search by existing member email
  const mapped = await teamRepo.findByAuthIdentity('firebase-test-uid-owner', currentOwner.email);
  assert(mapped !== null, 'Mapped existing member by email successfully');
  assert(mapped.email === currentOwner.email, 'Mapped member matches verified email');

  // Subsequent search by authUid should find it directly
  const mappedByUid = await teamRepo.findByAuthUid('firebase-test-uid-owner');
  assert(mappedByUid !== null, 'Mapped directly via authUid after auto-linking');
  assert(mappedByUid.id === mapped.id, 'Mapped identity is stable and immutable');

  // -------------------------------------------------------------------------
  // Test 7: Activity Logging & Secret Safety
  // -------------------------------------------------------------------------
  console.log('\n7. Testing Security Activity Logging & Secret Sanitization...');

  const activityRepo = getActivityLogRepository();
  const testUserId = 'USR-TEST-VERIFY';

  await logSecurityActivity(testUserId, 'ACCESS_DENIED', 'Permission', 'storage.recover', {
    role: 'VIEWER',
    attemptedPath: '/api/admin/storage/recover',
    userToken: 'secret-bearer-token-12345',
    password: 'secret-password',
  });

  const userLogs = await activityRepo.findByUser(testUserId);
  assert(userLogs.length > 0, 'Security activity was recorded in ActivityLog repository');

  const latestLog = userLogs[userLogs.length - 1];
  assert(latestLog.action === 'ACCESS_DENIED', 'Action is ACCESS_DENIED');
  assert(latestLog.entityId === 'storage.recover', 'EntityId matches checked permission');
  assert(latestLog.metadata?.userToken === undefined, 'Sensitive token key was stripped from metadata');
  assert(latestLog.metadata?.password === undefined, 'Sensitive password key was stripped from metadata');
  assert(latestLog.metadata?.role === 'VIEWER', 'Safe metadata properties are preserved');

  console.log('\n===============================================================');
  console.log(`   ALL PHASE 3 VERIFICATION TESTS PASSED (${passCount} assertions)`);
  console.log('===============================================================\n');
} catch (err) {
  console.error('\nVerification failed:', err);
  process.exit(1);
}
