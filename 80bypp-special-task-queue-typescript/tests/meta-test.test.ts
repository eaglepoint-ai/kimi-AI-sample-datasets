/**
 * Meta-Test Suite
 *
 * This suite tests the robustness of the TaskQueue test suite by using
 * intentionally buggy implementations and verifying that the tests catch them.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Meta-Test: Test Suite Robustness', () => {
  const originalQueuePath = path.join(__dirname, '../repository_after/src/queue.ts');
  const resourcesDir = path.join(__dirname, 'resources');

  let originalCode: string;

  beforeAll(() => {
    originalCode = fs.readFileSync(originalQueuePath, 'utf-8');
  });

  afterEach(() => {
    fs.writeFileSync(originalQueuePath, originalCode);
  });

  const runTests = (): { passed: boolean; output: string } => {
    try {
      const output = execSync(
        'npx jest repository_after/ --no-coverage --silent',
        {
          encoding: 'utf-8',
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe'
        }
      );
      return { passed: true, output };
    } catch (error: any) {
      return { passed: false, output: error.stdout || error.message };
    }
  };

  const useBuggyImplementation = (bugFileName: string) => {
    const buggyPath = path.join(resourcesDir, bugFileName);
    const buggyCode = fs.readFileSync(buggyPath, 'utf-8');
    fs.writeFileSync(originalQueuePath, buggyCode);
  };

  test('Bug 1: Priority ordering broken - higher priority not processed first', () => {
    useBuggyImplementation('bug-01-priority-reversed.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/priority/i);
  });

  test('Bug 2: Retry count not enforced - exceeds maxRetries', () => {
    useBuggyImplementation('bug-02-retry-count-exceeded.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/retry|attempts/i);
  });

  test('Bug 3: Exponential backoff not working - constant delay', () => {
    useBuggyImplementation('bug-03-constant-backoff.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/backoff|delay/i);
  });

  test('Bug 4: Timeout not clearing on early completion - timer leak', () => {
    useBuggyImplementation('bug-04-timeout-not-cleared.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
  });

  test('Bug 5: Task status not set to pending initially', () => {
    useBuggyImplementation('bug-05-wrong-initial-status.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/pending|status/i);
  });

  test('Bug 6: Concurrency limit not enforced', () => {
    useBuggyImplementation('bug-06-concurrency-not-enforced.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/concurrency/i);
  });

  test('Bug 7: Running set not cleaned up after timeout', () => {
    useBuggyImplementation('bug-07-running-set-leak.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/running|timeout/i);
  });

  test('Bug 8: Task result not stored on completion', () => {
    useBuggyImplementation('bug-08-result-not-stored.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/result/i);
  });

  test('Bug 9: Failed callback not called after retries exhausted', () => {
    useBuggyImplementation('bug-09-callback-not-called.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/callback|failed/i);
  });

  test('Bug 10: Pause not preventing new task execution', () => {
    useBuggyImplementation('bug-10-pause-not-working.ts');
    const result = runTests();

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/pause/i);
  });

  test('Verification: Original implementation passes all tests', () => {
    const result = runTests();

    expect(result.passed).toBe(true);
  });

  test('Meta-Test Summary: Coverage verification', () => {
    const testFilesDir = path.join(__dirname, '../repository_after/tests');
    const testFiles = fs.readdirSync(testFilesDir).filter(f => f.endsWith('.test.ts'));

    expect(testFiles.length).toBeGreaterThanOrEqual(8);

    let totalTests = 0;
    testFiles.forEach(file => {
      const content = fs.readFileSync(path.join(testFilesDir, file), 'utf-8');
      totalTests += (content.match(/test\(/g) || []).length;
    });

    expect(totalTests).toBeGreaterThanOrEqual(30);
  });
});
