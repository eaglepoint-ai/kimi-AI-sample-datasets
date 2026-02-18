#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

function randomID() {
  return crypto.randomBytes(4).toString("hex");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getRootDir() {
  const cwd = process.cwd();
  const base = path.basename(cwd);
  if (base === "evaluation" || base === "tests") return path.dirname(cwd);
  return cwd;
}

function newReportDir(rootDir, dateObj) {
  const date = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
  const time = `${pad2(dateObj.getHours())}-${pad2(dateObj.getMinutes())}-${pad2(dateObj.getSeconds())}`;
  return path.join(rootDir, "evaluation", date, time);
}

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function hasAnySources(repoPath) {
  // Similar idea to your Go "hasGoSources", but generalized:
  // if repo dir exists and has package.json or any .ts/.js/.go files, consider it testable.
  try {
    const st = await fsp.stat(repoPath);
    if (!st.isDirectory()) return false;
  } catch {
    return false;
  }

  let found = false;

  async function walk(dir) {
    if (found) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (found) return;
      const full = path.join(dir, e.name);

      // skip heavy folders
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "build") continue;
        await walk(full);
        continue;
      }

      const n = e.name.toLowerCase();
      if (
        n === "package.json" ||
        n === "go.mod" ||
        n.endsWith(".go") ||
        n.endsWith(".ts") ||
        n.endsWith(".tsx") ||
        n.endsWith(".js") ||
        n.endsWith(".jsx")
      ) {
        found = true;
        return;
      }
    }
  }

  await walk(repoPath);
  return found;
}

function emptyResult(message) {
  return {
    success: false,
    exit_code: 1,
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 },
    stdout: message,
    stderr: ""
  };
}

async function getGitInfo(cwd) {
  async function runGit(args) {
    return new Promise((resolve) => {
      const p = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stdout.on("data", (d) => (out += d.toString("utf-8")));
      p.on("close", (code) => resolve(code === 0 ? out.trim() : "unknown"));
      p.on("error", () => resolve("unknown"));
    });
  }

  const commit = await runGit(["rev-parse", "--short", "HEAD"]);
  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  return { commit, branch };
}

async function getOSRelease() {
  if (process.platform === "win32") return "unknown";
  // try uname -r
  return new Promise((resolve) => {
    const p = spawn("uname", ["-r"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString("utf-8")));
    p.on("close", (code) => resolve(code === 0 ? out.trim() : "unknown"));
    p.on("error", () => resolve("unknown"));
  });
}

async function getEnvironmentInfo(rootDir) {
  const { commit, branch } = await getGitInfo(rootDir);
  const osRelease = await getOSRelease();
  const platform = `${process.platform}-${osRelease}-${process.arch}`;
  return {
    node_version: process.version,
    platform,
    os: process.platform,
    os_release: osRelease,
    architecture: process.arch,
    hostname: os.hostname(),
    git_commit: commit,
    git_branch: branch
  };
}

function parseVitestJsonReport(maybeJson) {
  // Best-effort: Vitest json reporter output shape can vary by version.
  // We try to extract test cases and a summary.
  try {
    const obj = JSON.parse(maybeJson);

    // If it already contains a "testResults" or "results"
    // We'll normalize to { tests: [{name,outcome}], summary: {...} }
    const tests = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    const pushTest = (name, outcome) => {
      tests.push({ nodeid: `tests::${name}`, name, outcome });
      if (outcome === "passed") passed++;
      else if (outcome === "failed") failed++;
      else if (outcome === "skipped") skipped++;
    };

    // common patterns
    // 1) obj.testResults (jest-like)
    if (Array.isArray(obj.testResults)) {
      for (const suite of obj.testResults) {
        const suiteName = suite.name || suite.file || "suite";
        const assertions = suite.assertionResults || [];
        for (const a of assertions) {
          const name = `${suiteName}::${a.fullName || a.title || a.name || "test"}`;
          const status = a.status || a.outcome;
          const outcome =
            status === "passed" ? "passed" : status === "failed" ? "failed" : status === "pending" ? "skipped" : "skipped";
          pushTest(name, outcome);
        }
      }
      return {
        ok: true,
        tests,
        summary: { total: tests.length, passed, failed, errors: 0, skipped }
      };
    }

    // 2) Vitest native JSON often contains obj.files -> tasks
    if (Array.isArray(obj.files)) {
      for (const f of obj.files) {
        const fileName = f.filepath || f.name || "file";
        const tasks = Array.isArray(f.tasks) ? f.tasks : [];
        for (const t of tasks) {
          if (!t || !t.name) continue;
          // status: pass|fail|skip
          const s = t.result?.state || t.state || t.result?.status;
          const outcome = s === "pass" ? "passed" : s === "fail" ? "failed" : s === "skip" ? "skipped" : "skipped";
          pushTest(`${fileName}::${t.name}`, outcome);
        }
      }
      return {
        ok: true,
        tests,
        summary: { total: tests.length, passed, failed, errors: 0, skipped }
      };
    }

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function runCommand({ cwd, env, command, args, timeoutMs }) {
  return new Promise((resolve) => {
    const p = spawn(command, args, {
      cwd,
      env,
      shell: process.platform === "win32", // helps on Windows
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    p.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    p.stderr.on("data", (d) => (stderr += d.toString("utf-8")));

    let killed = false;
    const timer =
      timeoutMs != null
        ? setTimeout(() => {
            killed = true;
            p.kill("SIGKILL");
          }, timeoutMs)
        : null;

    p.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: typeof code === "number" ? code : 1,
        stdout,
        stderr,
        killed
      });
    });

    p.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\nspawn error: ${err.message}\n`,
        killed: false
      });
    });
  });
}

async function runTests(repoPath, rootDir) {
  const testsDir = path.join(rootDir, "tests");

  // This runner assumes your tests are driven from /tests using npm.
  // You can customize which script to run here (e.g., test:all).
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["run", "test:all"]; // recommended: define tests/test:all in your tests package.json
  const env = { ...process.env, REPO_PATH: repoPath };

  const result = await runCommand({
    cwd: testsDir,
    env,
    command: cmd,
    args,
    timeoutMs: 15 * 60 * 1000 // 15 minutes
  });

  // Try to parse JSON report if your tests produce one (optional).
  // For example: tests can write tests/.reports/vitest.json or playwright.json
  // We'll look for a common file:
  const jsonReportPath = path.join(testsDir, ".reports", "report.json");
  let tests = [];
  let summary = { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 };

  if (await fileExists(jsonReportPath)) {
    try {
      const raw = await fsp.readFile(jsonReportPath, "utf-8");
      const parsed = parseVitestJsonReport(raw);
      if (parsed.ok) {
        tests = parsed.tests;
        summary = parsed.summary;
      }
    } catch {
      // ignore; we still return stdout/stderr
    }
  } else {
    // Best-effort parse directly from stdout if it contains JSON
    const parsed = parseVitestJsonReport(result.stdout);
    if (parsed.ok) {
      tests = parsed.tests;
      summary = parsed.summary;
    }
  }

  // If we couldn't parse per-test details, still return minimal summary
  if (summary.total === 0) {
    summary = {
      total: 0,
      passed: result.exitCode === 0 ? 1 : 0,
      failed: result.exitCode === 0 ? 0 : 1,
      errors: 0,
      skipped: 0
    };
  }

  return {
    success: result.exitCode === 0,
    exit_code: result.exitCode,
    tests,
    summary,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

async function main() {
  const start = new Date();
  const startTs = start.toISOString();
  const rootDir = getRootDir();
  const reportDir = newReportDir(rootDir, start);

  await fsp.mkdir(reportDir, { recursive: true });

  const beforePath = path.join(rootDir, "repository_before");
  const afterPath = path.join(rootDir, "repository_after");

  let before = emptyResult("repository_before is empty; skipping tests");
  if (await hasAnySources(beforePath)) {
    before = await runTests(beforePath, rootDir);
  }

  const after = await runTests(afterPath, rootDir);

  const comparison = {
    before_tests_passed: !!before.success,
    after_tests_passed: !!after.success,
    before_total: before.summary.total,
    before_passed: before.summary.passed,
    before_failed: before.summary.failed,
    after_total: after.summary.total,
    after_passed: after.summary.passed,
    after_failed: after.summary.failed
  };

  const env = await getEnvironmentInfo(rootDir);
  const finished = new Date();
  const report = {
    run_id: randomID(),
    started_at: startTs,
    finished_at: finished.toISOString(),
    duration_seconds: (finished.getTime() - start.getTime()) / 1000,
    success: !!after.success,
    error: null,
    environment: env,
    results: {
      before,
      after,
      comparison
    }
  };

  const outPath = path.join(reportDir, "report.json");
  await fsp.writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`report written to ${outPath}`);
}

main().catch((err) => {
  console.error(`fatal: ${err?.stack || err}`);
  process.exit(1);
});
