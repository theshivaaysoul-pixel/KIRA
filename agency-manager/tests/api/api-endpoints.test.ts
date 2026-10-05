// tests/api/api-endpoints.test.ts
// API route handlers tests: Verifying unauthenticated protections, public health, and responses.

import { NextRequest } from 'next/server';
import { harness } from '../test-helper';

export async function runApiTests(): Promise<void> {
  harness.setSuite('API Endpoint Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: API Endpoint Tests');
  console.log('===============================================================\n');

  // ─── 1. Public Health Check ─────────────────────────────────────────────────
  await harness.runTest('API /api/health: Public health check returns 200', async () => {
    const { GET: healthHandler } = await import('@/app/api/health/route');
    const res = await healthHandler();
    harness.assertEqual(res.status, 200, 'Public health endpoint returned HTTP 200');
    const json = await res.json();
    harness.assertEqual(json.success, true, 'Health check returns success: true');
    harness.assertEqual(json.data?.app, 'ok', 'Health app status is "ok"');
    harness.assert(typeof json.data?.timestamp === 'string', 'Health check returns timestamp');
  });

  // ─── 2. Protected Route Handlers Rejection (401) ────────────────────────────
  const protectedGetRoutes = [
    { path: '/api/platforms', handlerImport: () => import('@/app/api/platforms/route'), name: 'Platforms' },
    { path: '/api/social-accounts', handlerImport: () => import('@/app/api/social-accounts/route'), name: 'SocialAccounts' },
    { path: '/api/content', handlerImport: () => import('@/app/api/content/route'), name: 'Content' },
    { path: '/api/tasks', handlerImport: () => import('@/app/api/tasks/route'), name: 'Tasks' },
    { path: '/api/calendar', handlerImport: () => import('@/app/api/calendar/route'), name: 'Calendar' },
    { path: '/api/search?q=test', handlerImport: () => import('@/app/api/search/route'), name: 'Search' },
    { path: '/api/settings', handlerImport: () => import('@/app/api/settings/route'), name: 'Settings' },
    { path: '/api/admin/data-health', handlerImport: () => import('@/app/api/admin/data-health/route'), name: 'Admin Data Health' },
    { path: '/api/admin/platform-audit', handlerImport: () => import('@/app/api/admin/platform-audit/route'), name: 'Admin Platform Audit' },
    { path: '/api/health/storage', handlerImport: () => import('@/app/api/health/storage/route'), name: 'Health Storage Diagnostic' },
  ];

  for (const { path, handlerImport, name } of protectedGetRoutes) {
    await harness.runTest(`API ${path}: Unauthenticated request rejected (401)`, async () => {
      const mod = await handlerImport();
      const req = new NextRequest(`http://localhost:3000${path}`);
      const res = await mod.GET(req);
      harness.assertEqual(res.status, 401, `${name} endpoint rejected unauthenticated request with 401`);
    });
  }

  // ─── 3. Diagnostic Endpoints Protected POST (401) ───────────────────────────
  await harness.runTest('API /api/diagnostic/repository: Unauthenticated POST rejected (401)', async () => {
    const { POST: repoDiagnosticHandler } = await import('@/app/api/diagnostic/repository/route');
    const req = new NextRequest('http://localhost:3000/api/diagnostic/repository', { method: 'POST' });
    const res = await repoDiagnosticHandler(req);
    harness.assertEqual(res.status, 401, 'Repository diagnostic rejected unauthenticated with 401');
  });

  await harness.runTest('API /api/diagnostic/tasks: Unauthenticated POST rejected (401)', async () => {
    const { POST: tasksDiagnosticHandler } = await import('@/app/api/diagnostic/tasks/route');
    const req = new NextRequest('http://localhost:3000/api/diagnostic/tasks', { method: 'POST' });
    const res = await tasksDiagnosticHandler(req);
    harness.assertEqual(res.status, 401, 'Tasks diagnostic rejected unauthenticated with 401');
  });

  // ─── 4. Auth Activity Lifecycle Route ───────────────────────────────────────
  await harness.runTest('API /api/auth/activity: Unauthenticated record defaults safely to anonymous', async () => {
    const { POST: activityHandler } = await import('@/app/api/auth/activity/route');
    const req = new NextRequest('http://localhost:3000/api/auth/activity', {
      method: 'POST',
      body: JSON.stringify({ action: 'LOGIN', uid: 'spoofed-hacker-id' }),
    });
    const res = await activityHandler(req);
    harness.assertEqual(res.status, 200, 'Auth activity returned 200');
    const json = await res.json();
    harness.assertEqual(json.success, true, 'Auth activity logged event safely');
  });
}
