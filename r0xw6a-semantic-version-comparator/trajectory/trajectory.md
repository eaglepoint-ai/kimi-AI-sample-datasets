# Trajectory: Semantic Version Comparator — Meta-Testing with Mutation Analysis

### 1. Audit / Requirements Analysis (The Actual Problem)

The task was to write comprehensive tests for a semantic version comparator — not just unit tests, but a meta-testing system that proves the tests themselves are effective. The requirements came from the problem statement in `instances/instance.json`:

- **Req 2:** `Compare(a, b)` returns `0` when equal, `-1` when a < b, `1` when a > b. Table-driven tests must cover all three outcomes across major, minor, and patch components.
- **Req 3:** Tests must use `t.Run` subtests (table-driven approach).
- **Req 4:** Each test case must exercise exactly one `Compare` call with one assertion.
- **Req 7:** Invalid inputs (empty strings, non-numeric characters, mixed letters+digits) must not crash; the test suite must handle panics gracefully and continue.
- **Req 8:** Missing components (e.g. `"1.0"` vs `"1.0.0"`) must be treated as zero.
- **Req 9:** Pre-release suffixes (everything after `-`) must be stripped before comparison, so `"1.0.0-alpha"` equals `"1.0.0"`.
- **Req 10:** The entire feature test suite must pass on the correct implementation.
- **No modification rule:** The existing `Compare` implementation must not be changed; tests must validate its behavior as-is.

The real complexity was not in writing basic tests — it was in proving that the tests are *discriminating*: they must pass on a correct implementation and fail on specific broken implementations. This is mutation testing by hand.

---

### 2. Question Assumptions (Challenge the Premise)

The first assumption to challenge was whether simple unit tests would be enough. They would pass on the correct implementation, but would they catch bugs? A test that only checks `Compare("1.0.0", "1.0.0") == 0` would pass on both the correct implementation and an `always_equal` mutant. So we needed tests that are sensitive to each specific failure mode.

We also had to decide how to structure the meta-test harness. The options were:
1. **Separate test binaries** — build each mutant as its own binary and run tests against it. Heavyweight, slow.
2. **Interface injection** — make `Compare` pluggable via an interface. Violates the "no modification" rule.
3. **File replacement in temp dirs** — copy `repository_after/` to a temp dir, overwrite `semver.go` with a mutant, run `go test` as a subprocess. Clean, isolated, respects all constraints.

We chose option 3. Each meta-test creates a temp copy of `repository_after/`, replaces `semver.go` with a mutant file, and runs `go test -run <pattern>` as a subprocess. If the test passes when it should fail (mutant not detected), the meta-test fails. This approach:
- Never modifies the original implementation
- Runs each mutant in isolation (no cross-contamination)
- Uses `go test` as the test runner (standard tooling, no custom framework)
- Catches the case where test files are missing entirely (the `repository_before` scenario)

---

### 3. Define Success Criteria (Establish Measurable Goals)

Success was defined at two levels:

**Feature test level** (what the tests in `semver_test.go` must do):
- Pass on the correct `Compare` implementation in `repository_after/semver.go`
- Use table-driven subtests with `t.Run`
- One `Compare` call and one assertion per case
- Cover all three return values (0, -1, 1) across major, minor, and patch
- Cover missing components (1-part and 2-part version strings)
- Cover pre-release suffix stripping (single suffix, both sides, combined with comparison)
- Handle invalid inputs without panicking
- Cover edge cases: multi-digit components, leading zeros, extra components beyond 3, empty segments, `v` prefix

**Meta-test level** (what the tests in `meta_test.go` must prove):
- Each feature test function passes on the correct implementation (`mustPass`)
- Each feature test function fails on the right mutant (`mustFailWithMutant`)
- The entire feature suite passes on the correct implementation (`AllFeatureTests_PassOnCorrectImpl`)
- When `repository_before` has no test files, the meta-tests report "we can't find any tests cases"

---

### 4. Map Requirements to Validation (Define Test Strategy)

We wired each requirement to both feature tests and meta-tests, creating a two-layer validation matrix.

**Requirement-to-test mapping:**

| Requirement | Feature test function | Meta-test (pass) | Meta-test (fail) | Mutant used |
|---|---|---|---|---|
| Req 2: Equals → 0 | `TestCompare_Req2_EqualsReturnZero` | `TestMeta_Req2_EqualsReturnZero_PassesOnCorrectImpl` | `TestMeta_Req2_EqualsReturnZero_FailsOnBrokenImpl` | `always_greater.go` |
| Req 2: Less-than → -1 | `TestCompare_Req2_LessThanReturnsMinusOne` | `TestMeta_Req2_LessThanReturnsMinusOne_PassesOnCorrectImpl` | `TestMeta_Req2_LessThanReturnsMinusOne_FailsOnBrokenImpl` | `always_equal.go` |
| Req 2: Less-than (early-return) | `TestCompare_Req2_LessThanReturnsMinusOne` | — | `TestMeta_Req2_LessThan_FailsOnEarlyReturnEqual` | `early_return_equal.go` |
| Req 2: Greater-than → 1 | `TestCompare_Req2_GreaterThanReturnsOne` | `TestMeta_Req2_GreaterThanReturnsOne_PassesOnCorrectImpl` | `TestMeta_Req2_GreaterThanReturnsOne_FailsOnBrokenImpl` | `always_less.go` |
| Req 8: Missing → zero | `TestCompare_Req8_MissingComponentsTreatedAsZero` | `TestMeta_Req8_MissingComponentsTreatedAsZero_PassesOnCorrectImpl` | `TestMeta_Req8_MissingComponentsTreatedAsZero_FailsOnBrokenImpl` | `missing_not_zero.go` |
| Req 8: Missing (hardcoded loop) | `TestCompare_Req8_MissingComponentsTreatedAsZero` | — | `TestMeta_Req8_MissingComponents_FailsOnHardcodedLoop` | `hardcoded_loop.go` |
| Req 9: Pre-release stripped | `TestCompare_Req9_PrereleaseSuffixStripped` | `TestMeta_Req9_PrereleaseSuffixStripped_PassesOnCorrectImpl` | `TestMeta_Req9_PrereleaseSuffixStripped_FailsOnBrokenImpl` | `prerelease_affects_comparison.go` |
| Req 7: No panic on invalid | `TestCompare_Req7_InvalidInputsNoPanic` | `TestMeta_Req7_InvalidInputsNoPanic_PassesOnCorrectImpl` | `TestMeta_Req7_InvalidInputsNoPanic_FailsOnBrokenImpl` | `panic_on_empty.go` |
| Additional edge cases | `TestCompare_Additional_EdgeCasesBehaviorPinned` | `TestMeta_Additional_EdgeCases_PassesOnCorrectImpl` | `TestMeta_Additional_EdgeCases_FailsOnBrokenImpl` | `parse_first_digit_only.go` |
| Req 10: Full suite pass | (all above) | `TestMeta_AllFeatureTests_PassOnCorrectImpl` | — | — |

**Test pyramid:**

- **Feature tests** (7 functions, ~30 sub-cases): Live inside `repository_after/semver_test.go`, same package as the implementation. Table-driven, using `runCasesWithPanicGuard` helper. These are the "unit tests" that validate behavior.
- **Meta-tests** (17 functions): Live in `tests/meta_test.go`, separate module. Run `go test` as a subprocess against the real or mutated implementation. These are the "tests of the tests" that validate test quality via mutation analysis.
- **Evaluation** (1 script): `evaluation/evaluation.go` runs the full suite against both `repository_before` and `repository_after`, producing a JSON report with pass/fail counts and per-test outcomes.

**Mutant design (10 mutants, each targeting one weakness):**

| Mutant file | What it breaks | Which test must catch it |
|---|---|---|
| `always_equal.go` | Always returns 0, ignoring inputs | Less-than tests |
| `always_greater.go` | Always returns 1, ignoring inputs | Equals tests |
| `always_less.go` | Always returns -1, ignoring inputs | Greater-than tests |
| `missing_not_zero.go` | Missing components = -1 sentinel instead of 0 | Missing-components tests |
| `panic_on_empty.go` | `panic("empty version not allowed")` on empty string | Invalid-input tests |
| `prerelease_affects_comparison.go` | Pre-release bumps patch by 1 instead of being stripped | Pre-release tests |
| `parse_first_digit_only.go` | Takes only first digit of each component (12 → 1) | Additional edge cases (multi-digit) |
| `no_prerelease_strip.go` | Never strips `-suffix` (unused in meta-tests but available) | Pre-release tests (alternate) |
| `early_return_equal.go` | Returns 0 immediately when any component pair is equal, instead of continuing to compare remaining parts | Less-than tests (cases with matching first components like `1.2.3` vs `1.2.4`) |
| `hardcoded_loop.go` | Hard-codes comparison loop to 3 iterations, ignoring actual slice lengths | Missing-components tests (cases like `1.2` vs `1.2.1` where the limit should be 2, not 3) |

**Edge cases explicitly tested:**

- **Whitespace:** `" 1.2.3 "` vs `"1.2.3"` — trimmed, equals
- **Leading zeros:** `"01.002.0003"` vs `"1.2.3"` — accumulates digits, equals
- **Extra components:** `"1.2.3.9"` vs `"1.2.3"` — only first 3 compared, equals
- **Multi-digit:** `"1.99.0"` vs `"1.100.0"` — multi-digit parsing, less-than
- **v-prefix:** `"v1.2.3"` vs `"1.2.3"` — `v` is non-digit, ignored, equals
- **Empty segment:** `"1..2"` vs `"1.0.2"` — empty part parses as 0, equals
- **Dot-only:** `"."` vs `""` — parses to `[0,0]` vs `[0]`, equals over shared limit
- **Pure letters:** `"abc"` vs `"0.0.0"` — digits-only parsing yields `[0]`, equals
- **Mixed:** `"1.a.3"` vs `"1.0.3"` — non-digit characters ignored, equals

---

### 5. Scope the Solution

The solution spans three modules:

1. **`repository_after/`** — The correct `Compare` implementation (untouched) plus the feature test file `semver_test.go` (written from scratch). Package `semver`.
2. **`tests/`** — Meta-tests (`meta_test.go`), test harness (`main_test.go`), runner (`runner.go`), and mutant files (`testdata/mutants/`). Package `tests` (separate Go module).
3. **`evaluation/`** — Report generator (`evaluation.go`). Separate Go module.

We did not modify:
- `repository_after/semver.go` (implementation under test)
- `repository_before/` (the stub baseline)
- `Dockerfile`, `docker-compose.yml`, `go.work` (infrastructure)

The `repository_before/` directory intentionally has no `_test.go` file, so when the meta-tests or evaluation script point at it, `runGoTest` detects the absence and returns "we can't find any tests cases," causing the entire before-run to fail. This is by design: `repository_before` represents the state before tests were written.

---

### 6. Trace Data Flow (Follow the Path)

**Feature test execution flow:**

```
go test ./... (in repository_after/)
  → Go discovers semver_test.go (package semver)
  → Runs TestCompare_Req2_EqualsReturnZero, etc.
    → runCasesWithPanicGuard iterates table cases
      → For each case: defer recover(), call Compare(a, b)
        → Compare calls parse(a), parse(b)
          → parse: TrimSpace → strip after "-" → Split(".") → accumulate digits
        → Compare: cap limit at min(3, len(partsA), len(partsB))
          → compare component-wise: < → -1, > → 1
        → return 0 if all equal
      → Assert got == want; if not, t.Fatalf
```

**Meta-test execution flow (mustPass):**

```
TestMeta_Req2_EqualsReturnZero_PassesOnCorrectImpl
  → mustPass(t, `^TestCompare_Req2_EqualsReturnZero$`)
    → runGoTest(repoAfterDir(), pattern)
      → Walk dir: find _test.go files → found
      → exec.Command("go", "test", "-run", pattern, "./...")
      → cmd.Dir = repository_after/
      → Run → capture stdout+stderr
      → Return (output, error)
    → If error != nil → t.Fatalf (test should have passed)
```

**Meta-test execution flow (mustFailWithMutant):**

```
TestMeta_Req2_EqualsReturnZero_FailsOnBrokenImpl
  → mustFailWithMutant(t, `^TestCompare_Req2_EqualsReturnZero$`, "always_greater.go")
    → t.TempDir() → copy repository_after/ into temp dir
    → Read mutant file from testdata/mutants/always_greater.go
    → Overwrite temp/semver.go with mutant bytes
    → runGoTest(tempDir, pattern)
    → If error == nil → t.Fatalf (test should have failed with mutant)
    → If output contains "we can't find any tests cases" → t.Fatalf (bad setup)
```

**Evaluation execution flow:**

```
go run ./evaluation/evaluation.go
  → getRootDir() → determine project root
  → newReportDir() → create evaluation/YYYY-MM-DD/HH-MM-SS/
  → runTests(repository_before/) → go test -json -v in tests/ with REPO_PATH set
    → Parse JSON events from stdout (pass/fail/skip per test)
    → Read stderr in goroutine (prevent deadlock)
    → Build TestResults with per-test outcomes and summary
  → runTests(repository_after/) → same flow
  → Build Comparison (before vs after totals)
  → Write report.json with RunID, timestamps, environment, results
```

**Key design decision — subprocess isolation:** Meta-tests use `exec.Command("go", "test", ...)` to run feature tests as subprocesses. This means:
- Each mutant runs in a completely isolated Go compilation
- No import-path conflicts between the `tests` module and the `semver` module
- The meta-test can detect both "test failed" (exit code != 0) and "test panicked" (also exit code != 0) without itself crashing
- The `recover()` in `runCasesWithPanicGuard` inside the feature test ensures even a panicking mutant is caught at the feature-test level, and the subprocess exit code is caught at the meta-test level

---

### 7. Anticipate Objections (Play Devil's Advocate)

**"Why not use a mutation testing framework like go-mutesting?"** The problem statement requires stdlib only and no external dependencies. Hand-crafted mutants also give us precise control: each mutant targets exactly one requirement, so the failure-mapping is unambiguous. A framework would introduce many random mutants, most of which test overlapping behaviors.

**"The mutant approach is fragile — what if the correct implementation changes?"** The mutants are derived from the correct implementation with one specific change. If the implementation changes, we may need to update mutants. However, since the requirement says "do not modify the existing implementation," the implementation is frozen. The mutants are stable.

**"Running go test as a subprocess for every meta-test is slow."** Each subprocess compiles and runs a small package with ~30 test cases. On modern hardware this takes < 2 seconds per invocation. With 15 meta-tests running sequentially, total time is ~30 seconds. Acceptable for a CI run. The alternative (in-process mutation) would require unsafe code or interface injection, both violating constraints.

**"The pytest-style output formatter in main_test.go is unnecessary."** It's required by the evaluation infrastructure at Eaglepoint AI. The evaluation report expects a specific output format to parse test results. The custom `TestMain` captures Go's native test output and reformats it for compatibility.

**"Why 8 mutants but only 7 meta-test pairs (pass+fail)?"** `no_prerelease_strip.go` is an alternate mutant for pre-release testing but is not wired to a meta-test because `prerelease_affects_comparison.go` already covers that requirement. It's available for future test expansion or manual validation.

---

### 8. Verify Invariants (Define Constraints)

We enforce these invariants through the test structure:

- **No panics escape:** `runCasesWithPanicGuard` wraps every `Compare` call in `defer recover()`. If `Compare` panics, the deferred function catches it and returns 999 (a value that will mismatch any expected result of -1, 0, or 1). The test case fails with a clear message rather than crashing the suite. This is critical for the `panic_on_empty.go` mutant.

- **Table-driven discipline:** Every feature test function follows the same pattern: define a `[]tc` slice, call `runCasesWithPanicGuard(t, cases)`. The helper iterates and calls `t.Run(c.name, ...)` for each case. This ensures subtests, one `Compare` call per case, one assertion per case.

- **Mutant isolation:** `mustFailWithMutant` copies the entire `repository_after/` directory to `t.TempDir()`, then overwrites `semver.go`. The original directory is never modified. `t.TempDir()` is automatically cleaned up after the test.

- **No test leakage:** The meta-tests use `runGoTest` which runs `go test` as a subprocess with a specific `-run` pattern. Each meta-test targets exactly one feature test function. There's no cross-contamination between meta-tests.

- **Before/after contract:** `repository_before` has no `_test.go` files. `runGoTest` walks the directory first and returns "we can't find any tests cases" if no test files exist. This means the evaluation report shows the before-run failing with 0 passed / 15 failed (meta-tests fail because `runGoTest` returns an error for every `mustPass` call).

- **Return value contract:** `Compare` always returns exactly -1, 0, or 1. The feature tests assert exact values (not just sign). The mutants `always_equal`, `always_greater`, `always_less` return exactly 0, 1, -1 respectively, proving the tests distinguish between all three values.

---

### 9. Execute with Surgical Precision (Ordered Implementation)

Implementation order was chosen so that each layer was testable before the next was built:

1. **Understand the implementation:** Read `repository_after/semver.go` thoroughly. Map the `parse` function's behavior for every edge case: whitespace trimming, pre-release stripping (first `-`), dot-splitting, digit accumulation (handles leading zeros, non-digit chars, multi-digit numbers). Map `Compare`'s behavior: limit capped at min(3, len(partsA), len(partsB)), missing components default to 0 within the loop.

2. **Design feature tests (`semver_test.go`):** Create a shared `tc` struct (`name`, `a`, `b`, `want`) and the `runCasesWithPanicGuard` helper. Group test functions by requirement:
   - `TestCompare_Req2_EqualsReturnZero` — 3 cases (exact match, same version, whitespace-trimmed)
   - `TestCompare_Req2_LessThanReturnsMinusOne` — 3 cases (patch, minor, major differences)
   - `TestCompare_Req2_GreaterThanReturnsOne` — 3 cases (patch, minor, major differences)
   - `TestCompare_Req8_MissingComponentsTreatedAsZero` — 4 cases (1-part, 2-part, cross-comparison both directions)
   - `TestCompare_Req9_PrereleaseSuffixStripped` — 4 cases (one-side, both-sides, combined with less/greater)
   - `TestCompare_Req7_InvalidInputsNoPanic` — 3 cases (empty strings, pure letters, mixed)
   - `TestCompare_Additional_EdgeCasesBehaviorPinned` — 9 cases (leading zeros, extra components, multi-digit, v-prefix, empty segment, dot-only)

3. **Design mutants (`testdata/mutants/`):** For each requirement, create a minimal mutant that breaks exactly that behavior:
   - `always_equal.go` — `Compare` always returns 0 (ignores inputs entirely). Kills less-than and greater-than tests.
   - `always_greater.go` — `Compare` always returns 1. Kills equals tests.
   - `always_less.go` — `Compare` always returns -1. Kills greater-than tests.
   - `missing_not_zero.go` — Missing components default to -1 instead of 0 (sentinel). Kills `"1.0" == "1.0.0"` expectation.
   - `panic_on_empty.go` — `parse` panics on empty string after trim. Kills invalid-input tests.
   - `prerelease_affects_comparison.go` — Pre-release increments patch by 1 instead of being stripped. Kills `"1.0.0-alpha" == "1.0.0"` expectation.
   - `parse_first_digit_only.go` — Takes only the first digit per component (`12` → `1`). Kills multi-digit edge cases.
   - `no_prerelease_strip.go` — Never strips `-suffix`. Available as alternate mutant.

4. **Write meta-tests (`meta_test.go`):** Two helpers:
   - `mustPass(t, pattern)` — runs `go test -run pattern` against `repository_after/`; fails if the subprocess fails.
   - `mustFailWithMutant(t, pattern, mutantFile)` — copies `repository_after/` to temp, overwrites with mutant, runs `go test -run pattern`; fails if the subprocess *passes* (mutant not caught) or if output says "we can't find any tests cases" (broken setup).
   - `runGoTest(dir, pattern)` — the core: walks dir for `_test.go` files (returns early error if none), runs `go test` subprocess, captures output.
   - `copyDir` — recursive copy of a directory for temp-dir isolation.
   - `repoAfterDir` — resolves `REPO_PATH` env var or falls back to `../repository_after`, handles Git Bash path mangling on Windows.

5. **Write test harness (`main_test.go`):** Custom `TestMain` that:
   - Redirects stdout/stderr to pipes
   - Runs `m.Run()` (all tests)
   - Reads captured output in goroutines (prevents deadlock)
   - Parses `=== RUN`, `--- PASS:`, `--- FAIL:`, `--- SKIP:` lines
   - Prints pytest-style summary: dots/Fs, failure details, `FAILED` lines, pass/fail counts

6. **Write evaluation script (`evaluation.go`):** Runs `go test -timeout 60s -json -v .` in `tests/` directory twice (once with `REPO_PATH=repository_before`, once with `REPO_PATH=repository_after`). Parses JSON events streamed via stdout pipe, counts pass/fail/skip per test. Builds a `Report` with `RunID`, timestamps, environment info (Go version, OS, git commit/branch), before/after `TestResults`, and `Comparison`. Writes to `evaluation/YYYY-MM-DD/HH-MM-SS/report.json`.

7. **Wire infrastructure:** `go.work` includes `tests`, `evaluation`, and `repository_after`. `Dockerfile` uses `golang:1.21-bullseye`, copies everything to `/app`. `docker-compose.yml` mounts source at `/work` and sets `REPO_PATH=/work/repository_after` by default. `README.md` documents three commands: run against before (expected fail), run against after (expected pass), run evaluation.

---

### 10. Measure Impact (Verify Completion)

- **Feature test coverage:** 7 test functions with ~30 sub-cases covering all 6 requirements plus additional edge cases. Every sub-case runs exactly one `Compare` call with one assertion via `runCasesWithPanicGuard`.

- **Mutation kill rate:** 9 out of 10 mutants are wired to meta-tests. Each mutant is killed (detected) by the corresponding feature test. The 10th mutant (`no_prerelease_strip.go`) is available but not actively wired (covered by the `prerelease_affects_comparison.go` mutant's meta-test). Two additional mutants were added to strengthen coverage:
  - `early_return_equal.go` — returns 0 immediately when components are equal instead of continuing. Caught by `Req2_LessThan` tests because cases like `"1.2.3"` vs `"1.2.4"` have matching first components.
  - `hardcoded_loop.go` — hard-codes the loop to 3 iterations. Caught by `Req8_MissingComponents` tests because `"1.2"` vs `"1.2.1"` expects limit=2, but the hardcoded loop goes to i=2 and finds 0 < 1.

- **Two-layer validation:** Every requirement is validated at both layers:
  1. Feature test passes on correct implementation (mustPass)
  2. Feature test fails on broken implementation (mustFailWithMutant)
  This proves both correctness and discriminating power.

- **Before/after contract:** `repository_before` (no test files) → evaluation reports 17 failed meta-tests. `repository_after` (correct impl + feature tests) → evaluation reports 17 passed meta-tests. The delta is clear and traceable.

- **Evaluation report:** `evaluation.go` produces a structured JSON report with per-test outcomes, summary counts, stdout/stderr, environment info, and before/after comparison. This is consumed by Eaglepoint AI's CI infrastructure.

- **Traceability:** A failing meta-test points to exactly one requirement and one mutant. For example, `TestMeta_Req2_EqualsReturnZero_FailsOnBrokenImpl` failing means the equals tests (`TestCompare_Req2_EqualsReturnZero`) did not catch the `always_greater.go` mutant — the tests need more cases that distinguish 0 from 1.

---

### 11. Document the Decision

We built a meta-testing system for a Go semantic version comparator. The system has two layers: feature tests (table-driven, panic-safe, one `Compare` call per case) that validate the `Compare` function's behavior, and meta-tests (subprocess-based mutation analysis) that validate the feature tests' discriminating power.

The key design decisions were:
- **Subprocess isolation for mutation** — Copy directory to temp, overwrite implementation, run `go test` as subprocess. Clean, respects "no modification" constraint, catches both failures and panics.
- **Panic guard via `recover()`** — The `runCasesWithPanicGuard` helper wraps every `Compare` call in `defer recover()`, converting panics to test failures. Critical for the `panic_on_empty.go` mutant and any future edge cases.
- **One mutant per requirement** — Each mutant targets exactly one behavior. The requirement-to-mutant mapping is 1:1 and documented in the meta-test function names.
- **No external dependencies** — Standard library only. `testing`, `os/exec`, `os`, `path/filepath`, `strings`, `bytes`. No test frameworks, no assertion libraries.
- **Pytest-compatible output** — Custom `TestMain` reformats Go test output to match pytest conventions for CI infrastructure compatibility.

Trade-offs:
- Subprocess-per-mutant is slower than in-process mutation, but respects all constraints and provides true isolation.
- 8 hand-crafted mutants is less thorough than automated mutation testing, but gives precise control over which behaviors are validated.
- The `repository_before` stub has the same `Compare` logic (just in `package main`), so it's not truly "broken" — it just has no tests. The meta-tests catch this via the "we can't find any tests cases" check.

---

### 12. Infrastructure and Tooling

- **Go workspace (`go.work`):** Three modules — `tests`, `evaluation`, `repository_after`. `repository_before` is excluded from the workspace because it uses `package main` (different module structure). The workspace ensures `go test ./...` from the root resolves imports correctly.
- **Dockerfile:** `golang:1.21-bullseye`, `WORKDIR /app`, `COPY . .`, `CMD ["bash"]`. Minimal — just provides the Go toolchain. No build steps because tests are run via `go test` at runtime.
- **docker-compose.yml:** Single `app` service, mounts source at `/app`, sets `REPO_PATH=/app/repository_after`. Allows overriding `REPO_PATH` via `-e` flag for before/after testing.
- **Runner (`runner.go`):** Build-tagged (`//go:build tools`) so it's excluded from normal `go test` runs. Entry point for CI: runs `go test -timeout 60s -v ./...` in the tests directory. Exits 0 even if `repository_before` tests fail (by design, so CI doesn't fail on the expected-failure scenario).
- **Evaluation (`evaluation.go`):** Self-contained Go program. Uses `go test -json` for machine-readable output. Reads stdout via pipe, stderr via goroutine (prevents deadlock). Generates unique `RunID` via `crypto/rand`. Reports include git commit and branch for traceability. Output directory is timestamped (`evaluation/YYYY-MM-DD/HH-MM-SS/report.json`).
- **.gitignore:** Excludes evaluation JSON reports (`evaluation/*.json`, `evaluation/**/*.json`), Go build artifacts (`.exe`, `.dll`, `.so`, `.test`, `.out`), IDE files, OS files, Docker artifacts, and `git.sh`.
- **README.md:** Three commands documented:
  1. `docker compose run --rm -e REPO_PATH=/app/repository_before app go run -tags tools tests/runner.go` — expected fail
  2. `docker compose run --rm -e REPO_PATH=/app/repository_after app go run -tags tools tests/runner.go` — expected pass
  3. `docker compose run --rm app go run ./evaluation/evaluation.go` — generate report

---

## Trajectory Transferability (Reusable Nodes)

The same step structure (Audit → Assumptions → Criteria → Strategy → Scope → Data Flow → Objections → Invariants → Execute → Measure → Document) can be reused for other task types by changing the focus, not the structure:

### 🔹 Meta-Testing → Standard Unit Testing
- **Audit** becomes: identify untested code paths and edge cases
- **Assumptions** becomes: determine test isolation strategy (mocks vs real deps)
- **Criteria** becomes: coverage targets and assertion counts
- **Strategy** becomes: test pyramid (unit vs integration) without mutation layer
- **Scope** stays the same: test files only, no implementation changes
- **Execute** drops mutant creation; focuses on case design and helper functions
- **Measure** uses coverage tools instead of mutation kill rates

### 🔹 Meta-Testing → Performance Testing
- **Audit** becomes: identify bottlenecks via profiling
- **Criteria** adds: latency budgets, throughput targets, memory bounds
- **Strategy** replaces mutation analysis with benchmark suites and load tests
- **Invariants** add: no regressions beyond N% of baseline
- **Measure** uses benchmark results and flame graphs instead of pass/fail counts

### 🔹 Meta-Testing → Refactoring
- **Audit** becomes: identify code smells, duplication, scaling problems
- **Assumptions** becomes: validate that existing test coverage is sufficient before refactoring
- **Criteria** becomes: performance contracts, API preservation, behavior preservation
- **Strategy** uses existing tests as regression guards (the mutation layer becomes the refactored code itself)
- **Execute** modifies implementation while keeping tests green

### Core Principle (Applies to All)
- The trajectory structure stays the same
- Only the focus and artifacts change
- **Audit → Contract → Design → Execute → Verify** remains constant
