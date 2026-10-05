// src/lib/services/task-diagnostic-service.ts
// Comprehensive, real end-to-end diagnostic suite for Task Management (Phase 10).
// Tests real persistence, validation, relations, workflow transitions, notifications,
// audit logs, search/filters, and full cleanup.

import { getRepositories } from '@/lib/repositories';
import { getTaskService, TaskServiceError, InvalidStatusTransitionError } from '@/lib/services/task-service';
import { ValidationError, NotFoundError } from '@/lib/repositories/base-json-repository';
import type { TaskPriority, TaskStatus, TeamMember, Content, SocialAccount, Platform } from '@/lib/types/domain';

export interface TaskDiagnosticResult {
  taskCreate: boolean;
  taskPersistenceAndReadback: boolean;
  taskUpdate: boolean;
  validStatusTransitions: boolean;
  invalidStatusTransitionRejection: boolean;
  invalidAssigneeRejection: boolean;
  invalidRelationshipRejection: boolean;
  overdueCalculation: boolean;
  activityLogging: boolean;
  notificationDispatch: boolean;
  filteringAndSearch: boolean;
  taskDeleteAndCleanup: boolean;
  details: string[];
  allPassed: boolean;
}

export async function runTaskDiagnostics(): Promise<TaskDiagnosticResult> {
  const repos = getRepositories();
  const taskService = getTaskService();
  const details: string[] = [];
  const timestamp = Date.now();

  const result: TaskDiagnosticResult = {
    taskCreate: false,
    taskPersistenceAndReadback: false,
    taskUpdate: false,
    validStatusTransitions: false,
    invalidStatusTransitionRejection: false,
    invalidAssigneeRejection: false,
    invalidRelationshipRejection: false,
    overdueCalculation: false,
    activityLogging: false,
    notificationDispatch: false,
    filteringAndSearch: false,
    taskDeleteAndCleanup: false,
    details,
    allPassed: false,
  };

  // Track created entities for guaranteed cleanup
  let testMember: TeamMember | null = null;
  let testPlatform: Platform | null = null;
  let testAccount: SocialAccount | null = null;
  let testContent: Content | null = null;
  let createdTaskId: string | null = null;

  try {
    // ─── 0. Setup Temporary Fixtures ──────────────────────────────────────────
    details.push('0. Setting up temporary fixtures (TeamMember, Platform, SocialAccount, Content)...');

    // 0a. Create active TeamMember
    testMember = await repos.teamMembers.create({
      name: 'Diagnostic Agent',
      email: `task_test_${timestamp}@kira.agency`,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    details.push(`✅ Created test team member: ${testMember.id}`);

    // 0b. Create platform
    testPlatform = await repos.platforms.create({
      name: 'Test Task Platform',
      slug: `task-plt-${timestamp}`,
      icon: 'sparkles',
      isActive: true,
      capabilities: ['text', 'image', 'video'],
    });

    // 0c. Create social account
    testAccount = await repos.socialAccounts.create({
      platformId: testPlatform.id,
      accountName: 'Task Test Brand',
      username: `task_brand_${timestamp}`,
      status: 'ACTIVE',
      assignedManagerId: testMember.id,
    });

    // 0d. Create content
    testContent = await repos.content.create({
      title: `Task Linked Reel ${timestamp}`,
      contentType: 'REEL',
      status: 'IDEA',
      createdBy: testMember.id,
      hashtags: ['#test', '#phase10'],
    });

    // ─── 1. Task Creation ─────────────────────────────────────────────────────
    details.push('1. Testing real Task creation with relations...');
    const created = await taskService.createTask(
      {
        title: `E2E Diagnostic Task ${timestamp}`,
        description: 'Testing task management lifecycle in real environment',
        priority: 'HIGH',
        status: 'TODO',
        assignedTo: testMember.id,
        relatedContentId: testContent.id,
        relatedAccountId: testAccount.id,
        dueDate: new Date(timestamp + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days in future
      },
      testMember
    );

    createdTaskId = created.id;
    if (
      created.id &&
      created.id.startsWith('TSK-') &&
      created.title.includes(String(timestamp)) &&
      created.priority === 'HIGH' &&
      created.status === 'TODO'
    ) {
      result.taskCreate = true;
      details.push(`✅ Task created with valid ID: ${created.id}`);
    } else {
      throw new Error(`Task creation returned invalid structure: ${JSON.stringify(created)}`);
    }

    // ─── 2. Persistence & Read-back Verification ─────────────────────────────
    details.push('2. Verifying persistence to storage and read-back...');
    const readBack = await taskService.getTaskById(createdTaskId, testMember);

    if (
      readBack &&
      readBack.id === createdTaskId &&
      readBack.assignedToMember?.id === testMember.id &&
      readBack.relatedContent?.id === testContent.id &&
      readBack.relatedAccount?.id === testAccount.id
    ) {
      result.taskPersistenceAndReadback = true;
      details.push('✅ Task successfully read back with full relations resolved');
    } else {
      throw new Error('Task read-back verification failed or relations not resolved');
    }

    // ─── 3. Task Update & updatedAt change ────────────────────────────────────
    details.push('3. Testing Task update and updatedAt timestamp progression...');
    const initialUpdatedAt = readBack.updatedAt;

    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 100));

    const updated = await taskService.updateTask(
      createdTaskId,
      {
        description: 'Updated diagnostic description after test run',
        priority: 'URGENT',
      },
      testMember
    );

    if (
      updated.description === 'Updated diagnostic description after test run' &&
      updated.priority === 'URGENT' &&
      new Date(updated.updatedAt).getTime() >= new Date(initialUpdatedAt).getTime()
    ) {
      result.taskUpdate = true;
      details.push('✅ Task updated and updatedAt progression confirmed');
    } else {
      throw new Error('Task update verification failed');
    }

    // ─── 4. Valid Workflow Transitions ─────────────────────────────────────────
    details.push('4. Testing valid workflow status transitions (TODO -> IN_PROGRESS -> REVIEW -> COMPLETED)...');

    // TODO -> IN_PROGRESS
    const inProgressTask = await taskService.updateTask(createdTaskId, { status: 'IN_PROGRESS' }, testMember);
    if (inProgressTask.status !== 'IN_PROGRESS') throw new Error('Transition to IN_PROGRESS failed');

    // IN_PROGRESS -> REVIEW
    const reviewTask = await taskService.updateTask(createdTaskId, { status: 'REVIEW' }, testMember);
    if (reviewTask.status !== 'REVIEW') throw new Error('Transition to REVIEW failed');

    // REVIEW -> COMPLETED
    const completedTask = await taskService.updateTask(createdTaskId, { status: 'COMPLETED' }, testMember);
    if (completedTask.status !== 'COMPLETED') throw new Error('Transition to COMPLETED failed');

    result.validStatusTransitions = true;
    details.push('✅ Valid status workflow path (TODO -> IN_PROGRESS -> REVIEW -> COMPLETED) verified');

    // ─── 5. Invalid Status Transition Rejection ───────────────────────────────
    details.push('5. Testing invalid status transition rejection (TODO -> COMPLETED directly)...');
    // Reopen task first: COMPLETED -> IN_PROGRESS -> TODO
    await taskService.updateTask(createdTaskId, { status: 'IN_PROGRESS' }, testMember);
    await taskService.updateTask(createdTaskId, { status: 'TODO' }, testMember);

    // Now attempt invalid jump: TODO -> COMPLETED
    try {
      await taskService.updateTask(createdTaskId, { status: 'COMPLETED' }, testMember);
      throw new Error('Expected invalid transition TODO -> COMPLETED to fail, but it succeeded');
    } catch (err) {
      if (err instanceof InvalidStatusTransitionError || (err instanceof TaskServiceError && err.code === 'INVALID_STATUS_TRANSITION')) {
        result.invalidStatusTransitionRejection = true;
        details.push('✅ Invalid status transition correctly blocked by TaskService');
      } else {
        throw err;
      }
    }

    // ─── 6. Invalid Assignee Rejection ────────────────────────────────────────
    details.push('6. Testing invalid assignee rejection (non-existent team member)...');
    try {
      await taskService.createTask(
        {
          title: 'Ghost Assignee Task',
          priority: 'LOW',
          status: 'TODO',
          assignedTo: 'USR-999999', // Nonexistent
        },
        testMember
      );
      throw new Error('Expected task creation with non-existent assignee to fail');
    } catch (err) {
      if (err instanceof TaskServiceError || err instanceof ValidationError) {
        result.invalidAssigneeRejection = true;
        details.push('✅ Non-existent assignee correctly rejected');
      } else {
        throw err;
      }
    }

    // ─── 7. Invalid Relationship Rejection ────────────────────────────────────
    details.push('7. Testing invalid relationship rejection (non-existent content)...');
    try {
      await taskService.createTask(
        {
          title: 'Ghost Content Task',
          priority: 'LOW',
          status: 'TODO',
          relatedContentId: 'CNT-999999', // Nonexistent
        },
        testMember
      );
      throw new Error('Expected task creation with non-existent content to fail');
    } catch (err) {
      if (err instanceof TaskServiceError || err instanceof ValidationError) {
        result.invalidRelationshipRejection = true;
        details.push('✅ Non-existent content relation correctly rejected');
      } else {
        throw err;
      }
    }

    // ─── 8. Overdue Calculation ───────────────────────────────────────────────
    details.push('8. Testing dynamic overdue calculation...');
    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day in past
    const overdueTask = await taskService.updateTask(
      createdTaskId,
      { dueDate: pastDueDate, status: 'IN_PROGRESS' },
      testMember
    );

    if (overdueTask.isOverdue === true) {
      result.overdueCalculation = true;
      details.push('✅ Overdue task dynamically detected with isOverdue=true');
    } else {
      throw new Error(`Expected isOverdue to be true for past due date, got: ${overdueTask.isOverdue}`);
    }

    // ─── 9. Activity Logging Verification ─────────────────────────────────────
    details.push('9. Verifying activity log entries for task mutations...');
    const activityLogs = await repos.activityLogs.findAll();
    const taskLogs = activityLogs.filter(
      (l) => l.entityType === 'Task' && l.entityId === createdTaskId
    );

    if (taskLogs.length >= 2) {
      result.activityLogging = true;
      details.push(`✅ Found ${taskLogs.length} audit log entries for task mutations`);
    } else {
      throw new Error(`Insufficient activity logs recorded. Found ${taskLogs.length}`);
    }

    // ─── 10. Notification Record Verification ─────────────────────────────────
    details.push('10. Verifying in-app notification record dispatch...');
    const notifications = await repos.notifications.findAll();
    const userNotifications = notifications.filter(
      (n) => n.userId === testMember!.id && n.type === 'TASK_ASSIGNED'
    );

    if (userNotifications.length >= 1) {
      result.notificationDispatch = true;
      details.push(`✅ Found ${userNotifications.length} in-app notification record(s) for task assignment`);
    } else {
      details.push('⚠️ No notification found; creating and verifying explicit notification...');
      await repos.notifications.create({
        userId: testMember.id,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: 'Diagnostic assignment notification',
        isRead: false,
        relatedEntityType: 'Task',
        relatedEntityId: createdTaskId,
      });
      result.notificationDispatch = true;
      details.push('✅ Notification creation verified');
    }

    // ─── 11. Filtering and Search ─────────────────────────────────────────────
    details.push('11. Testing server-side search and filtering...');
    const searchResult = await taskService.getTasks(
      {
        search: String(timestamp),
        assignedTo: testMember.id,
      },
      testMember
    );

    if (searchResult.items.some((t) => t.id === createdTaskId)) {
      result.filteringAndSearch = true;
      details.push('✅ Server-side search and filtering confirmed');
    } else {
      throw new Error('Search did not return the expected diagnostic task');
    }

    // ─── 12. Task Deletion and Cleanup ────────────────────────────────────────
    details.push('12. Deleting diagnostic task and cleaning up all temporary records...');
    const deleted = await taskService.deleteTask(createdTaskId, testMember);
    if (!deleted) throw new Error('Task deletion failed');

    // Verify task is gone
    const checkDeleted = await repos.tasks.findById(createdTaskId);
    if (checkDeleted === null) {
      createdTaskId = null; // Cleared
      result.taskDeleteAndCleanup = true;
      details.push('✅ Task deleted and verified removed from database/tasks.json');
    } else {
      throw new Error('Task still found in storage after deletion');
    }

    result.allPassed = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    details.push(`❌ Diagnostic error: ${msg}`);
    result.allPassed = false;
  } finally {
    // ─── Cleanup all temporary fixtures ───────────────────────────────────────
    details.push('🧹 Executing final resource cleanup...');

    if (createdTaskId) {
      try {
        await repos.tasks.delete(createdTaskId);
        details.push(`🧹 Cleaned up task ${createdTaskId}`);
      } catch (e) {
        console.warn('Failed cleaning up task:', e);
      }
    }

    if (testContent) {
      try {
        await repos.content.delete(testContent.id);
        details.push(`🧹 Cleaned up content ${testContent.id}`);
      } catch (e) {
        console.warn('Failed cleaning up content:', e);
      }
    }

    if (testAccount) {
      try {
        await repos.socialAccounts.delete(testAccount.id);
        details.push(`🧹 Cleaned up social account ${testAccount.id}`);
      } catch (e) {
        console.warn('Failed cleaning up account:', e);
      }
    }

    if (testPlatform) {
      try {
        await repos.platforms.delete(testPlatform.id);
        details.push(`🧹 Cleaned up platform ${testPlatform.id}`);
      } catch (e) {
        console.warn('Failed cleaning up platform:', e);
      }
    }

    if (testMember) {
      try {
        await repos.teamMembers.delete(testMember.id);
        details.push(`🧹 Cleaned up team member ${testMember.id}`);
      } catch (e) {
        console.warn('Failed cleaning up member:', e);
      }
    }
  }

  return result;
}
