#!/usr/bin/env node

/**
 * Evaluation Script for TaskQueue Test Suite
 *
 * This script runs both the main test suite and meta-tests,
 * then generates a comprehensive evaluation report.
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as crypto from 'crypto';

// --- Configuration ---
const ROOT_DIR = path.dirname(path.dirname(__filename));
const OUTPUT_PATH = process.env.OUTPUT || path.join(ROOT_DIR, 'evaluation', 'report.json');
const TIMEOUT = 120000; // 120 seconds (meta-tests take longer)

const FORBIDDEN_MARKERS = [
  'heap out of memory',
  'JavaScript heap out of memory',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'RangeError',
  'URIError',
  'EvalError',
  'InternalError',
  'AggregateError',
  'panic:',
  'FATAL ERROR',
];

// Commands to run tests
const TEST_CMDS = {
  main: ['npx', 'jest', 'repository_after/', '--json', '--no-coverage'],
  meta: ['npx', 'jest', 'tests/meta-test.test.ts', '--json', '--no-coverage'],
};

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface TestResult {
  name: string;
  outcome: string;
  duration: number;
  failureMessages: string[];
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
}

interface BugDetail {
  name: string;
  caught: boolean;
  failureReason: string | null;
}

interface BugAnalysis {
  totalBugs: number;
  bugsCaught: number;
  bugsNotCaught: number;
  detectionRate: string;
  originalPassed: boolean;
  coveragePassed: boolean;
  bugDetails: BugDetail[];
}

function runCommand(cmd: string[], cwd: string, envVars: Record<string, string>): Promise<CommandResult> {
  return new Promise((resolve) => {
    const env = { ...process.env, ...envVars };
    exec(
      cmd.join(' '),
      { cwd, env, timeout: TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = error ? (error as any).code || -1 : 0;
        resolve({ exitCode, stdout, stderr });
      }
    );
  });
}

function parseTestResults(output: string, testType: string): { summary: TestSummary; tests: TestResult[] } {
  // Try to extract JSON from output
  try {
    // Jest outputs JSON at the end, try to find it
    const lines = output.split('\n');
    let jsonStr = '';
    let foundJson = false;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{')) {
        foundJson = true;
      }
      if (foundJson) {
        jsonStr = line + jsonStr;
        if (line.startsWith('{')) {
          break;
        }
      }
    }

    if (jsonStr) {
      const json = JSON.parse(jsonStr);
      const tests: TestResult[] = [];

      if (json.testResults) {
        json.testResults.forEach((suite: any) => {
          if (suite.assertionResults) {
            suite.assertionResults.forEach((test: any) => {
              tests.push({
                name: test.title,
                outcome: test.status === 'passed' ? 'passed' : 'failed',
                duration: test.duration || 0,
                failureMessages: test.failureMessages || [],
              });
            });
          }
        });
      }

      const summary: TestSummary = {
        total: json.numTotalTests || 0,
        passed: json.numPassedTests || 0,
        failed: json.numFailedTests || 0,
        skipped: json.numPendingTests || 0,
        errors: json.numRuntimeErrorTestSuites || 0,
      };

      return { summary, tests };
    }
  } catch (e: any) {
    console.error(`JSON parse error for ${testType}:`, e.message);
  }

  // Fallback parsing
  const tests: TestResult[] = [];
  const lines = output.split('\n');

  lines.forEach((line) => {
    if (line.includes('✓') || line.includes('✗') || line.includes('PASS') || line.includes('FAIL')) {
      const name = line.replace(/^[✓✗]\s*/, '').trim();
      const outcome = line.includes('✓') || line.includes('PASS') ? 'passed' : 'failed';
      if (name) {
        tests.push({ name, outcome, duration: 0, failureMessages: [] });
      }
    }
  });

  const summary: TestSummary = {
    total: tests.length,
    passed: tests.filter((t) => t.outcome === 'passed').length,
    failed: tests.filter((t) => t.outcome === 'failed').length,
    skipped: 0,
    errors: 0,
  };

  return { summary, tests };
}

function analyzeBugDetection(metaTests: TestResult[]): BugAnalysis {
  const bugTests = metaTests.filter((t) => t.name.startsWith('Bug'));
  const verificationTest = metaTests.find((t) => t.name.includes('Verification: Original'));
  const coverageTest = metaTests.find((t) => t.name.includes('Coverage verification'));

  const bugsCaught = bugTests.filter((t) => t.outcome === 'passed').length;
  const bugsNotCaught = bugTests.filter((t) => t.outcome === 'failed').length;
  const totalBugs = bugTests.length;

  return {
    totalBugs,
    bugsCaught,
    bugsNotCaught,
    detectionRate: totalBugs > 0 ? ((bugsCaught / totalBugs) * 100).toFixed(2) : '0',
    originalPassed: verificationTest ? verificationTest.outcome === 'passed' : false,
    coveragePassed: coverageTest ? coverageTest.outcome === 'passed' : false,
    bugDetails: bugTests.map((t) => ({
      name: t.name,
      caught: t.outcome === 'passed',
      failureReason: t.failureMessages.length > 0 ? t.failureMessages[0] : null,
    })),
  };
}

function getEnvInfo(): Record<string, string> {
  const info: Record<string, string> = {
    platform: os.platform() + ' ' + os.arch(),
    node: process.version,
  };

  const tools = ['docker', 'git', 'npm'];
  tools.forEach((tool) => {
    try {
      const { execSync } = require('child_process');
      const version = execSync(`${tool} --version`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      info[tool] = version.split('\n')[0];
    } catch {
      info[tool] = 'not available';
    }
  });

  return info;
}

async function main() {
  const runId = randomHex(4);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Starting TaskQueue Test Suite Evaluation [Run ID: ${runId}]`);
  console.log(`${'='.repeat(80)}\n`);

  const startTime = new Date().toISOString();
  const results: any = {};

  // 1. Run Main Test Suite
  console.log('Running Main Test Suite...');
  const mainStart = Date.now();
  const mainResult = await runCommand(TEST_CMDS.main, ROOT_DIR, {});
  const mainDuration = Date.now() - mainStart;

  const mainOutput = mainResult.stdout + mainResult.stderr;
  const mainParsed = parseTestResults(mainOutput, 'main');
  const mainForbidden = FORBIDDEN_MARKERS.some((marker) => mainOutput.includes(marker));

  results.main = {
    success: mainResult.exitCode === 0 && mainParsed.summary.failed === 0,
    exit_code: mainResult.exitCode,
    duration_ms: mainDuration,
    summary: mainParsed.summary,
    tests: mainParsed.tests,
    forbidden_markers_detected: mainForbidden,
    output_sample: mainOutput.substring(0, 2000),
  };

  console.log(`   ✓ Completed in ${(mainDuration / 1000).toFixed(2)}s`);
  console.log(`   Tests: ${mainParsed.summary.passed}/${mainParsed.summary.total} passed\n`);

  // 2. Run Meta-Test Suite
  console.log('Running Meta-Test Suite (Bug Detection)...');
  const metaStart = Date.now();
  const metaResult = await runCommand(TEST_CMDS.meta, ROOT_DIR, {});
  const metaDuration = Date.now() - metaStart;

  const metaOutput = metaResult.stdout + metaResult.stderr;
  const metaParsed = parseTestResults(metaOutput, 'meta');
  const metaForbidden = FORBIDDEN_MARKERS.some((marker) => metaOutput.includes(marker));

  const bugAnalysis = analyzeBugDetection(metaParsed.tests);

  results.meta = {
    success: metaResult.exitCode === 0 && metaParsed.summary.failed === 0,
    exit_code: metaResult.exitCode,
    duration_ms: metaDuration,
    summary: metaParsed.summary,
    tests: metaParsed.tests,
    forbidden_markers_detected: metaForbidden,
    bug_detection: bugAnalysis,
    output_sample: metaOutput.substring(0, 2000),
  };

  console.log(`   ✓ Completed in ${(metaDuration / 1000).toFixed(2)}s`);
  console.log(`   Bugs Caught: ${bugAnalysis.bugsCaught}/${bugAnalysis.totalBugs} (${bugAnalysis.detectionRate}%)\n`);

  // 3. Generate Comprehensive Report
  const report = {
    run_id: runId,
    tool: 'TaskQueue Test Suite Evaluator',
    started_at: startTime,
    completed_at: new Date().toISOString(),
    environment: getEnvInfo(),
    runs: results,
    criteria_analysis: {
      main_tests_passed: results.main.success ? 'Pass' : 'Fail',
      meta_tests_passed: results.meta.success ? 'Pass' : 'Fail',
      forbidden_markers:
        results.main.forbidden_markers_detected || results.meta.forbidden_markers_detected ? 'Fail' : 'Pass',
      overall_assessment:
        results.main.success && parseFloat(bugAnalysis.detectionRate) >= 90 && bugAnalysis.originalPassed
          ? 'EXCELLENT'
          : results.main.success && parseFloat(bugAnalysis.detectionRate) >= 80
          ? 'GOOD'
          : 'NEEDS_IMPROVEMENT',
    },
    statistics: {
      total_tests: results.main.summary.total + results.meta.summary.total,
      total_passed: results.main.summary.passed + results.meta.summary.passed,
      total_failed: results.main.summary.failed + results.meta.summary.failed,
      main_test_count: results.main.summary.total,
      meta_test_count: results.meta.summary.total,
      bugs_caught: bugAnalysis.bugsCaught,
      bugs_missed: bugAnalysis.bugsNotCaught,
    },
  };

  // 4. Save Report
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

  // 5. Display Summary
  console.log(`${'='.repeat(80)}`);
  console.log('EVALUATION SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Overall Assessment: ${report.criteria_analysis.overall_assessment}`);
  console.log();
  console.log('Main Test Suite:');
  console.log(`  Status: ${results.main.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Tests: ${results.main.summary.passed}/${results.main.summary.total} passed`);
  console.log(`  Duration: ${(results.main.duration_ms / 1000).toFixed(2)}s`);
  console.log();
  console.log('Meta-Test Suite (Bug Detection):');
  console.log(`  Status: ${results.meta.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Tests: ${results.meta.summary.passed}/${results.meta.summary.total} passed`);
  console.log(`  Bugs Caught: ${bugAnalysis.bugsCaught}/${bugAnalysis.totalBugs} (${bugAnalysis.detectionRate}%)`);
  console.log(`  Original Implementation: ${bugAnalysis.originalPassed ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`  Duration: ${(results.meta.duration_ms / 1000).toFixed(2)}s`);
  console.log();
  console.log('Bug Detection Details:');
  bugAnalysis.bugDetails.forEach((bug, idx) => {
    const status = bug.caught ? '✅' : '❌';
    console.log(`  ${idx + 1}. ${status} ${bug.name}`);
  });
  console.log();
  console.log(`${'='.repeat(80)}`);
  console.log(`📄 Full report saved to: ${OUTPUT_PATH}`);
  console.log(`${'='.repeat(80)}\n`);

  // 6. Exit with appropriate code
  const exitCode = results.main.success && parseFloat(bugAnalysis.detectionRate) >= 90 ? 0 : 1;
  process.exit(exitCode);
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
