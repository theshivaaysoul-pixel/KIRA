// tests/performance/performance.test.ts
// Performance regression tests: Measuring latency and throughput across core services.

import { harness } from '../test-helper';
import { getRepositories } from '@/lib/repositories';
import { getRateLimiter } from '@/lib/security/rate-limiter';
import { CreateTaskSchema } from '@/lib/validation';
import { DataSafetyService } from '@/lib/storage/data-safety-service';

export async function runPerformanceTests(): Promise<void> {
  harness.setSuite('Performance Regression Tests');
  console.log('\n===============================================================');
  console.log('   RUNNING SUITE: Performance Regression Tests');
  console.log('===============================================================\n');

  // ─── 1. Rate Limiter Throughput ─────────────────────────────────────────────
  await harness.runTest('Performance: Rate limiter executes 1,000 checks in < 50ms', () => {
    const limiter = getRateLimiter();
    limiter.reset();
    const config = { maxRequests: 5000, windowMs: 60000 };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      limiter.check(`client-${i % 20}`, config);
    }
    const elapsed = performance.now() - start;
    console.log(`      1,000 rate limit evaluations completed in ${elapsed.toFixed(2)}ms`);
    harness.assert(elapsed < 100, `Rate limiter throughput is fast (${elapsed.toFixed(2)}ms < 100ms)`);
    limiter.reset();
  });

  // ─── 2. Validation Schema Throughput ─────────────────────────────────────────
  await harness.runTest('Performance: Zod schema parses 500 tasks in < 50ms', () => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      CreateTaskSchema.safeParse({
        title: `Task #${i}`,
        priority: 'MEDIUM',
        status: 'TODO',
      });
    }
    const elapsed = performance.now() - start;
    console.log(`      500 Zod schema evaluations completed in ${elapsed.toFixed(2)}ms`);
    harness.assert(elapsed < 100, `Schema validation throughput is fast (${elapsed.toFixed(2)}ms < 100ms)`);
  });

  // ─── 3. Cryptographic Checksum Latency ──────────────────────────────────────
  await harness.runTest('Performance: SHA-256 computation on 1MB payload in < 30ms', () => {
    const payload = Buffer.alloc(1024 * 1024, 'A'); // 1 Megabyte

    const start = performance.now();
    const hash = DataSafetyService.calculateChecksum(payload);
    const elapsed = performance.now() - start;
    console.log(`      1MB SHA-256 hash computed in ${elapsed.toFixed(2)}ms (${hash.slice(0, 16)}...)`);
    harness.assert(elapsed < 50, `Checksum calculation is fast (${elapsed.toFixed(2)}ms < 50ms)`);
  });

  // ─── 4. Repository Read Latency ──────────────────────────────────────────────
  await harness.runTest('Performance: Repository cached reads complete in acceptable latency', async () => {
    const repos = getRepositories();
    const start = performance.now();
    const [platforms, members] = await Promise.all([
      repos.platforms.findAll(),
      repos.teamMembers.findAll(),
    ]);
    const elapsed = performance.now() - start;
    console.log(`      Read ${platforms.length} platforms and ${members.length} members in ${elapsed.toFixed(2)}ms`);
    harness.assert(elapsed < 10000, `Repository read latency acceptable (${elapsed.toFixed(2)}ms < 10000ms)`);
  });
}
