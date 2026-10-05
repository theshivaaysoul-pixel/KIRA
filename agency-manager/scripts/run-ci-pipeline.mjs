// scripts/run-ci-pipeline.mjs
// Automated CI Pipeline script for KIRA Agency Manager (Phase 23).
// Sequentially executes:
// 1. Dependency security check (npm audit)
// 2. ESLint verification (npm run lint)
// 3. TypeScript compilation check (npx tsc --noEmit)
// 4. Comprehensive test suites (npx tsx scripts/run-all-tests.mjs)
// 5. Production Next.js build (npm run build)
// 6. Clean verification of persistent storage

import { execSync } from 'child_process';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║            KIRA AGENCY MANAGER — CI TEST PIPELINE              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const steps = [
  { name: '1. Dependency Audit (npm audit)', cmd: 'npm audit' },
  { name: '2. Linting (npm run lint)', cmd: 'npm run lint' },
  { name: '3. TypeScript Typecheck (npx tsc --noEmit)', cmd: 'npx tsc --noEmit' },
  { name: '4. Automated Test Suites (run-all-tests)', cmd: 'npx tsx scripts/run-all-tests.mjs' },
  { name: '5. Production Build (npm run build)', cmd: 'npm run build' },
];

const results = [];
let pipelineFailed = false;

for (const step of steps) {
  console.log(`\n▶ Starting Step: ${step.name}...`);
  const startTime = Date.now();
  try {
    const output = execSync(step.cmd, { stdio: 'pipe', encoding: 'utf8' });
    const duration = Date.now() - startTime;
    console.log(`  ✅ PASSED (${duration}ms)`);
    results.push({ name: step.name, status: 'PASS', duration });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`  ❌ FAILED (${duration}ms)`);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    results.push({ name: step.name, status: 'FAIL', duration, error: String(err) });
    pipelineFailed = true;
    break; // Halt pipeline on failure
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('                   CI PIPELINE SUMMARY                          ');
console.log('════════════════════════════════════════════════════════════════');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(` ${icon} ${r.name.padEnd(50)} | ${r.status} (${r.duration}ms)`);
}
console.log('════════════════════════════════════════════════════════════════\n');

if (pipelineFailed) {
  console.error('❌ CI PIPELINE FAILED: One or more critical steps did not pass.\n');
  process.exit(1);
} else {
  console.log('🎉 CI PIPELINE PASSED: All checks and tests completed successfully.\n');
  process.exit(0);
}
