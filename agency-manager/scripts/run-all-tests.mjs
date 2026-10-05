// scripts/run-all-tests.mjs
// Master test runner for Phase 23: Comprehensive Testing & Quality Assurance.
// Executes all test suites across unit, integration, GCS, security, API, dynamic platform, performance, and E2E.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const { harness } = await import('../tests/test-helper.ts');
const { runUnitTests } = await import('../tests/unit/validation-and-workflows.test.ts');
const { runRepositoryTests } = await import('../tests/integration/repository.test.ts');
const { runStorageTests } = await import('../tests/gcs/storage.test.ts');
const { runSecurityTests } = await import('../tests/security/security-and-rbac.test.ts');
const { runApiTests } = await import('../tests/api/api-endpoints.test.ts');
const { runDynamicPlatformTests } = await import('../tests/platform/dynamic-platform.test.ts');
const { runPerformanceTests } = await import('../tests/performance/performance.test.ts');
const { runUiE2eTests } = await import('../tests/e2e/ui-e2e.test.ts');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║       KIRA AGENCY MANAGER — PHASE 23 MASTER TEST RUNNER        ║');
console.log('║               Comprehensive Quality Assurance                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const suiteRunners = [
  { name: 'Unit Tests', runner: runUnitTests },
  { name: 'Repository Integration Tests', runner: runRepositoryTests },
  { name: 'GCS Storage Integration Tests', runner: runStorageTests },
  { name: 'Security & RBAC Tests', runner: runSecurityTests },
  { name: 'API Endpoint Tests', runner: runApiTests },
  { name: 'Dynamic Platform & Publishing Tests', runner: runDynamicPlatformTests },
  { name: 'Performance Regression Tests', runner: runPerformanceTests },
  { name: 'UI & E2E Tests', runner: runUiE2eTests },
];

const suiteSummaries = [];
const overallStartTime = Date.now();

try {
  for (const { name, runner } of suiteRunners) {
    await runner();
    const summary = harness.getSuiteSummary(name);
    suiteSummaries.push(summary);
  }
} catch (runnerErr) {
  console.error('\n❌ CRITICAL: Test suite runner encountered an unhandled exception:', runnerErr);
} finally {
  // Execute any registered cleanup handlers to guarantee no test pollution
  await harness.executeCleanups();
}

const totalDurationMs = Date.now() - overallStartTime;
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;

console.log('\n\n════════════════════════════════════════════════════════════════');
console.log('                     PHASE 23 TEST REPORT                       ');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('SUITE BREAKDOWN:');
console.log('----------------------------------------------------------------');
for (const s of suiteSummaries) {
  totalTests += s.total;
  totalPassed += s.passed;
  totalFailed += s.failed;
  const statusIcon = s.failed === 0 ? '✅' : '❌';
  console.log(
    ` ${statusIcon} ${s.suite.padEnd(40)} | Total: ${String(s.total).padStart(3)} | Passed: ${String(s.passed).padStart(3)} | Failed: ${String(s.failed).padStart(2)} | (${s.durationMs}ms)`
  );
}
console.log('----------------------------------------------------------------');
console.log(
  ` OVERALL SUMMARY: Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | (${totalDurationMs}ms)\n`
);

if (totalFailed > 0) {
  console.log('FAILURES ENCOUNTERED:');
  for (const s of suiteSummaries) {
    if (s.failures.length > 0) {
      console.log(`\n [${s.suite}]`);
      for (const f of s.failures) {
        console.log(`   - ${f.test}: ${f.error}`);
      }
    }
  }
  console.log('\n❌ RESULT: FAIL\n');
  process.exit(1);
} else {
  console.log('🎉 RESULT: PASS — All test suites completed with 0 failures.\n');
  process.exit(0);
}
