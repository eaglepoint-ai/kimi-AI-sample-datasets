const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

/* ── Config ────────────────────────────────────────────── */
const TASK_TITLE = "Enhance React Kanban Board";
const ROOT = path.resolve(__dirname, "..");
const REPO_AFTER = path.join(ROOT, "repository_after");
const TESTS_DIR = path.join(ROOT, "tests");

/* ── Helpers ───────────────────────────────────────────── */
function iso() {
  return new Date().toISOString();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function parseJestJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const results = {
      passed: 0,
      failed: 0,
      errors: 0,
      skipped: 0,
      total: 0,
      tests: [],
    };
    if (data.testResults) {
      data.testResults.forEach((suite) => {
        (suite.assertionResults || []).forEach((t) => {
          const status = t.status; // 'passed' | 'failed' | 'pending'
          const nodeId = (t.ancestorTitles || []).concat(t.title).join(" > ");
          results.tests.push({ nodeId, status });
          if (status === "passed") results.passed++;
          else if (status === "failed") results.failed++;
          else if (status === "pending") results.skipped++;
        });
      });
    }
    results.total = results.passed + results.failed + results.skipped + results.errors;
    return results;
  } catch {
    return null;
  }
}

function runTests() {
  let testOutput = "";
  let returnCode = 0;
  let parsed = null;

  // Try running with --json to get structured output
  try {
    const jsonResultPath = path.join("/tmp", "test-results.json");
    testOutput = execSync(
      `npx react-scripts test --watchAll=false --json --outputFile=${jsonResultPath} --env=jsdom --verbose 2>&1`,
      {
        cwd: REPO_AFTER,
        env: {
          ...process.env,
          CI: "true",
        },
        timeout: 120000,
        encoding: "utf-8",
      }
    );
    returnCode = 0;

    // Read JSON results
    if (fs.existsSync(jsonResultPath)) {
      const jsonContent = fs.readFileSync(jsonResultPath, "utf-8");
      parsed = parseJestJson(jsonContent);
    }
  } catch (err) {
    testOutput = (err.stdout || "") + (err.stderr || "");
    returnCode = err.status || 1;

    // Try to read JSON results even on failure
    const jsonResultPath = path.join("/tmp", "test-results.json");
    if (fs.existsSync(jsonResultPath)) {
      try {
        const jsonContent = fs.readFileSync(jsonResultPath, "utf-8");
        parsed = parseJestJson(jsonContent);
      } catch { /* ignore */ }
    }
  }

  // Fallback: parse verbose output
  if (!parsed) {
    parsed = { passed: 0, failed: 0, errors: 0, skipped: 0, total: 0, tests: [] };

    const passRegex = /✓\s+(.*?)(?:\s+\(\d+\s*ms\))?\s*$/gm;
    const failRegex = /✕\s+(.*?)(?:\s+\(\d+\s*ms\))?\s*$/gm;
    let m;
    while ((m = passRegex.exec(testOutput)) !== null) {
      parsed.tests.push({ nodeId: m[1].trim(), status: "passed" });
      parsed.passed++;
    }
    while ((m = failRegex.exec(testOutput)) !== null) {
      parsed.tests.push({ nodeId: m[1].trim(), status: "failed" });
      parsed.failed++;
    }
    parsed.total = parsed.passed + parsed.failed;

    // Also check summary line
    const summaryMatch = testOutput.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed(?:,\s+(\d+)\s+total)?/);
    if (summaryMatch) {
      if (summaryMatch[1]) parsed.failed = parseInt(summaryMatch[1], 10);
      parsed.passed = parseInt(summaryMatch[2], 10);
      if (summaryMatch[3]) parsed.total = parseInt(summaryMatch[3], 10);
      else parsed.total = parsed.passed + parsed.failed;
    }
  }

  return { testOutput, returnCode, parsed };
}

/* ── Main ──────────────────────────────────────────────── */
function main() {
  const runId = crypto.randomUUID();
  const startedAt = iso();
  const startTime = Date.now();

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt}`);
  console.log("============================================================");
  console.log(`${TASK_TITLE} EVALUATION`);
  console.log("============================================================");
  console.log("");
  console.log("============================================================");
  console.log("RUNNING TESTS (REPOSITORY_AFTER)");
  console.log("============================================================");
  console.log(`Environment: repository_after`);
  console.log(`Tests directory: ${TESTS_DIR}`);

  const { testOutput, returnCode, parsed } = runTests();

  const allPassed = parsed.failed === 0 && parsed.errors === 0 && returnCode === 0;

  console.log(
    `Results: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.errors} errors, ${parsed.skipped} skipped (total: ${parsed.total})`
  );
  parsed.tests.forEach((t) => {
    const icon = t.status === "passed" ? "✓ PASS" : "✗ FAIL";
    console.log(` [${icon}] ${t.nodeId}`);
  });

  console.log("");
  console.log("============================================================");
  console.log("EVALUATION SUMMARY");
  console.log("============================================================");
  console.log("Implementation (repository_after):");
  console.log(` Overall: ${allPassed ? "PASSED" : "FAILED"}`);
  console.log(` Tests: ${parsed.passed}/${parsed.total} passed`);
  console.log("");
  console.log("============================================================");
  console.log("EXPECTED BEHAVIOR CHECK");
  console.log("============================================================");

  if (allPassed) {
    console.log("[✓ OK] All tests passed (expected)");
  } else {
    console.log("[✗ FAIL] Some tests failed");
  }

  /* ── Generate report ──────────────────────────────────── */
  const finishedAt = iso();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const now = new Date();
  const dateDir = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeDir = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const reportDir = path.join(ROOT, "evaluation", "reports", dateDir, timeDir);

  fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_seconds: parseFloat(duration),
    environment: {
      node_version: process.version,
      platform: `${os.platform()}-${os.arch()}`,
    },
    after: {
      tests: {
        passed: allPassed,
        return_code: returnCode,
        output: testOutput.substring(0, 5000),
        details: parsed.tests.map((t) => ({ nodeId: t.nodeId, status: t.status })),
      },
      metrics: {
        total: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        errors: parsed.errors,
        skipped: parsed.skipped,
      },
    },
    success: allPassed,
    error: allPassed ? null : "Some tests failed",
  };

  const reportPath = path.join(reportDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("");
  console.log("Report saved to:");
  console.log(reportPath);
  console.log("");
  console.log("============================================================");
  console.log("EVALUATION COMPLETE");
  console.log("============================================================");
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Success: ${allPassed ? "YES" : "NO"}`);

  process.exit(allPassed ? 0 : 1);
}

main();
