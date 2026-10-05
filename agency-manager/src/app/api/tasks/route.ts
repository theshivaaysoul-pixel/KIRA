// src/app/api/tasks/route.ts
// GET  /api/tasks — list tasks with server-side filters, search, sort, pagination
// POST /api/tasks — create new task with validation, activity log, and notifications

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getTaskService, TaskServiceError } from '@/lib/services/task-service';
import type { ApiResponse } from '@/lib/types';
import type { TaskQueryResult, TaskWithRelations } from '@/lib/services/task-service';
import type { TaskPriority, TaskStatus } from '@/lib/types/domain';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'tasks.read');
  if (errorResponse) return errorResponse;

  const sp = req.nextUrl.searchParams;

  const filters = {
    search: sp.get('search') || undefined,
    status: (sp.get('status') as TaskStatus | 'ALL') || undefined,
    priority: (sp.get('priority') as TaskPriority | 'ALL') || undefined,
    assignedTo: sp.get('assignedTo') || undefined,
    relatedContentId: sp.get('relatedContentId') || undefined,
    relatedAccountId: sp.get('relatedAccountId') || undefined,
    overdue: sp.get('overdue') === 'true' ? true : (sp.get('overdue') === 'false' ? false : undefined),
    dueSoon: sp.get('dueSoon') === 'true' ? true : (sp.get('dueSoon') === 'false' ? false : undefined),
    sort: (sp.get('sort') as 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title') || undefined,
    order: (sp.get('order') as 'asc' | 'desc') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
  };

  try {
    const taskService = getTaskService();
    const result = await taskService.getTasks(filters, member!);

    return NextResponse.json<ApiResponse<TaskQueryResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof TaskServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[GET /api/tasks]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve tasks.' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'tasks.create');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const taskService = getTaskService();
    const createdTask = await taskService.createTask(body, member!);

    return NextResponse.json<ApiResponse<TaskWithRelations>>(
      {
        success: true,
        data: createdTask,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TaskServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error('[POST /api/tasks]', err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create task.' } },
      { status: 500 }
    );
  }
}
