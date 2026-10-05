// src/app/api/tasks/[id]/route.ts
// GET    /api/tasks/:id — get task details with relations
// PATCH  /api/tasks/:id — update task fields / status transition / assignment
// DELETE /api/tasks/:id — delete task

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/authorization';
import { getTaskService, TaskServiceError } from '@/lib/services/task-service';
import type { ApiResponse } from '@/lib/types';
import type { TaskWithRelations } from '@/lib/services/task-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'tasks.read');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const taskService = getTaskService();
    const task = await taskService.getTaskById(id, member!);

    return NextResponse.json<ApiResponse<TaskWithRelations>>({
      success: true,
      data: task,
    });
  } catch (err) {
    if (err instanceof TaskServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[GET /api/tasks/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve task.' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'tasks.update');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const taskService = getTaskService();
    const updatedTask = await taskService.updateTask(id, body, member!);

    return NextResponse.json<ApiResponse<TaskWithRelations>>({
      success: true,
      data: updatedTask,
    });
  } catch (err) {
    if (err instanceof TaskServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[PATCH /api/tasks/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update task.' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { member, errorResponse } = await requirePermission(req, 'tasks.delete');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const taskService = getTaskService();
    const deleted = await taskService.deleteTask(id, member!);

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted },
    });
  } catch (err) {
    if (err instanceof TaskServiceError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error(`[DELETE /api/tasks/${id}]`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete task.' } },
      { status: 500 }
    );
  }
}
