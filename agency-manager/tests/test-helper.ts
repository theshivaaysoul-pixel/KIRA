// tests/test-helper.ts
// Shared testing utilities, assertion harness, and safe cleanup registry for Phase 23.

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface SuiteSummary {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{ test: string; error: string }>;
}

class TestHarness {
  private currentSuite: string = 'Default';
  private currentTest: string = '';
  private testStartTime: number = 0;
  private results: TestResult[] = [];
  private cleanupStack: Array<() => Promise<void>> = [];

  setSuite(name: string) {
    this.currentSuite = name;
  }

  async runTest(name: string, fn: () => Promise<void> | void) {
    this.currentTest = name;
    this.testStartTime = Date.now();
    try {
      await fn();
      const durationMs = Date.now() - this.testStartTime;
      this.results.push({
        suite: this.currentSuite,
        name,
        passed: true,
        durationMs,
      });
      console.log(`   ✅ PASS: ${name} (${durationMs}ms)`);
    } catch (err: unknown) {
      const durationMs = Date.now() - this.testStartTime;
      const errorMsg = err instanceof Error ? (err.stack || err.message) : String(err);
      this.results.push({
        suite: this.currentSuite,
        name,
        passed: false,
        error: errorMsg,
        durationMs,
      });
      console.error(`   ❌ FAIL: ${name} (${durationMs}ms)`);
      console.error(`      Error: ${errorMsg}`);
    }
  }

  assert(condition: unknown, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, message: string) {
    if (actual !== expected) {
      throw new Error(`Assertion failed: ${message} (Expected: ${String(expected)}, Actual: ${String(actual)})`);
    }
  }

  assertDeepEqual<T>(actual: T, expected: T, message: string) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new Error(`Assertion failed: ${message} (Expected: ${expStr}, Actual: ${actStr})`);
    }
  }

  async assertRejects(
    promise: Promise<unknown>,
    expectedMatcher?: string | RegExp | ((err: unknown) => boolean),
    message?: string
  ) {
    try {
      await promise;
      throw new Error(`Expected promise to reject, but it resolved successfully. ${message || ''}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Expected promise to reject')) {
        throw err;
      }
      if (expectedMatcher) {
        if (typeof expectedMatcher === 'string') {
          const errStr = String((err as Record<string, unknown>)?.code || (err as Error)?.message || err);
          if (!errStr.includes(expectedMatcher)) {
            throw new Error(`Expected error to include "${expectedMatcher}", got "${errStr}". ${message || ''}`);
          }
        } else if (expectedMatcher instanceof RegExp) {
          const errStr = (err as Error)?.message || String(err);
          if (!expectedMatcher.test(errStr)) {
            throw new Error(`Expected error to match ${expectedMatcher}, got "${errStr}". ${message || ''}`);
          }
        } else if (typeof expectedMatcher === 'function') {
          if (!expectedMatcher(err)) {
            throw new Error(`Error did not satisfy custom matcher. ${message || ''}`);
          }
        }
      }
    }
  }

  registerCleanup(cleanupFn: () => Promise<void>) {
    this.cleanupStack.push(cleanupFn);
  }

  async executeCleanups() {
    while (this.cleanupStack.length > 0) {
      const cleanupFn = this.cleanupStack.pop();
      if (cleanupFn) {
        try {
          await cleanupFn();
        } catch (cleanupErr) {
          console.warn('[TestHarness] Warning: Cleanup handler failed:', cleanupErr);
        }
      }
    }
  }

  getSuiteSummary(suiteName: string): SuiteSummary {
    const suiteResults = this.results.filter((r) => r.suite === suiteName);
    const passed = suiteResults.filter((r) => r.passed).length;
    const failed = suiteResults.filter((r) => !r.passed).length;
    const durationMs = suiteResults.reduce((acc, r) => acc + r.durationMs, 0);
    const failures = suiteResults
      .filter((r) => !r.passed)
      .map((r) => ({ test: r.name, error: r.error || 'Unknown failure' }));

    return {
      suite: suiteName,
      total: suiteResults.length,
      passed,
      failed,
      skipped: 0,
      durationMs,
      failures,
    };
  }

  getAllResults(): TestResult[] {
    return [...this.results];
  }

  clear() {
    this.results = [];
    this.cleanupStack = [];
  }
}

export const harness = new TestHarness();
