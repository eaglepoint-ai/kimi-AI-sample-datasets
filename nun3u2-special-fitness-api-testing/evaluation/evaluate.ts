import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

const ROOT = '/app';
const REPO = path.join(ROOT, 'repository_after');
const TESTS_DIR = path.join(ROOT, 'tests');

interface TestResult {
  passed: boolean;
  return_code: number;
  output: string;
}

interface Metrics {
  tests_passed: number;
  tests_failed: number;
  tests_errors: number;
  tests_skipped: number;
  tests_total: number;
}

function runCommand(cmd: string, cwd: string): { code: number; output: string } {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 180000 });
    return { code: 0, output };
  } catch (err: any) {
    return { code: err.status ?? 1, output: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

function parseJestOutput(output: string): Metrics {
  let passed = 0, failed = 0, skipped = 0, total = 0;

  // Look for "Tests:" line specifically (not "Test Suites:")
  const testsLineMatch = output.match(/Tests:\s+(.*?)(\d+) total/);
  if (testsLineMatch) {
    const line = testsLineMatch[0];
    const pM = line.match(/(\d+) passed/);
    const fM = line.match(/(\d+) failed/);
    const sM = line.match(/(\d+) skipped/);
    const tM = line.match(/(\d+) total/);
    passed = pM ? parseInt(pM[1], 10) : 0;
    failed = fM ? parseInt(fM[1], 10) : 0;
    skipped = sM ? parseInt(sM[1], 10) : 0;
    total = tM ? parseInt(tM[1], 10) : passed + failed + skipped;
  }

  return { tests_passed: passed, tests_failed: failed, tests_errors: 0, tests_skipped: skipped, tests_total: total };
}

function extractTestNames(output: string, pass: boolean): string[] {
  const names: string[] = [];
  const regex = pass ? /✓|√|PASS.*?(\S.*)/g : /✕|×|FAIL.*?(\S.*)/g;
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('✓') || trimmed.startsWith('√') || trimmed.match(/^\s*✓/) || trimmed.match(/PASS/)) {
      // Extract test name from verbose lines
      const m = trimmed.match(/(?:✓|√)\s+(.*?)(?:\s+\(\d+\s*m?s\))?$/);
      if (m) names.push(m[1]);
    }
  }
  return names;
}

const mode = process.argv[2];
const runId = uuid();
const startedAt = new Date().toISOString();
const startTime = Date.now();

function runPrimaryTests(): { result: TestResult; metrics: Metrics } {
  console.log('============================================================');
  console.log('RUNNING PRIMARY TESTS');
  console.log('============================================================');
  console.log(`Test location: repository_after`);
  console.log('');

  const { code, output } = runCommand('npx jest --config jest.config.ts --verbose --forceExit 2>&1', REPO);
  const metrics = parseJestOutput(output);
  const names = extractTestNames(output, true);

  console.log(`Results: ${metrics.tests_passed} passed, ${metrics.tests_failed} failed, ${metrics.tests_errors} errors, ${metrics.tests_skipped} skipped (total: ${metrics.tests_total})`);
  for (const n of names) {
    console.log(`  [✓ PASS] ${n}`);
  }
  if (names.length === 0 && metrics.tests_passed > 0) {
    console.log(`  [✓ PASS] ${metrics.tests_passed} tests passed`);
  }
  console.log('');

  return { result: { passed: code === 0, return_code: code, output: output.slice(0, 5000) }, metrics };
}

function runMetaTests(): { result: TestResult; metrics: Metrics } {
  console.log('============================================================');
  console.log('RUNNING META-TESTS');
  console.log('============================================================');
  console.log(`Meta-tests directory: /app/tests`);
  console.log('');

  const { code, output } = runCommand(
    'npx jest --config meta-jest.config.ts --verbose --forceExit 2>&1',
    ROOT,
  );
  const metrics = parseJestOutput(output);
  const names = extractTestNames(output, true);

  console.log(`Results: ${metrics.tests_passed} passed, ${metrics.tests_failed} failed, ${metrics.tests_errors} errors, ${metrics.tests_skipped} skipped (total: ${metrics.tests_total})`);
  for (const n of names) {
    console.log(`  [✓ PASS] ${n}`);
  }
  if (names.length === 0 && metrics.tests_passed > 0) {
    console.log(`  [✓ PASS] ${metrics.tests_passed} meta-tests passed`);
  }
  console.log('');

  return { result: { passed: code === 0, return_code: code, output: output.slice(0, 5000) }, metrics };
}

if (mode === 'run-tests') {
  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt}`);
  console.log('');
  const { result, metrics } = runPrimaryTests();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Duration: ${duration}s`);
  process.exit(result.return_code);

} else if (mode === 'run-metatests') {
  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt}`);
  console.log('');
  const { result, metrics } = runMetaTests();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Duration: ${duration}s`);
  process.exit(result.return_code);

} else {
  // Full evaluate mode
  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt}`);
  console.log('');
  console.log('============================================================');
  console.log('SPECIAL FITNESS API TESTING TEST EVALUATION');
  console.log('============================================================');
  console.log('');

  const primary = runPrimaryTests();
  const meta = runMetaTests();

  const finishedAt = new Date().toISOString();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('============================================================');
  console.log('EVALUATION SUMMARY');
  console.log('============================================================');
  console.log('');
  console.log('Primary Tests:');
  console.log(`  Overall: ${primary.result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Tests: ${primary.metrics.tests_passed}/${primary.metrics.tests_total} passed`);
  console.log('');
  console.log('Meta-Tests:');
  console.log(`  Overall: ${meta.result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Tests: ${meta.metrics.tests_passed}/${meta.metrics.tests_total} passed`);
  console.log('');

  console.log('============================================================');
  console.log('EXPECTED BEHAVIOR CHECK');
  console.log('============================================================');
  console.log(`[${primary.result.passed ? '✓ OK' : '✗ FAIL'}] Primary tests passed`);
  console.log(`[${meta.result.passed ? '✓ OK' : '✗ FAIL'}] Meta-tests passed`);
  console.log('');

  // Save report
  const now = new Date();
  const dateDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeDir = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const reportDir = path.join(ROOT, 'evaluation', 'reports', dateDir, timeDir);
  fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_seconds: parseFloat(duration),
    environment: {
      python_version: process.version,
      platform: `${process.platform}-${process.arch}`,
    },
    tests: {
      tests: primary.result,
      metrics: primary.metrics,
    },
    meta_tests: {
      tests: meta.result,
      metrics: meta.metrics,
    },
    comparison: {
      passed_gate: primary.result.passed && meta.result.passed,
      improvement_summary: 'All primary and meta-tests pass against correct implementation',
    },
    success: primary.result.passed && meta.result.passed,
    error: null,
  };

  const reportPath = path.join(reportDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('Report saved to:');
  console.log(`evaluation/reports/${dateDir}/${timeDir}/report.json`);
  console.log('');
  console.log('============================================================');
  console.log('EVALUATION COMPLETE');
  console.log('============================================================');
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Success: ${report.success ? 'YES' : 'NO'}`);

  process.exit(report.success ? 0 : 1);
}
