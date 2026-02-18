# Task Rubric: Jest Test Suite for TypeScript Priority Task Queue

**Task ID:** `80BYPP`
**Category:** `Test Engineering — Async Systems / Priority Queue / Retry Logic`

## 1. Objective

Write a comprehensive Jest test suite for `TaskQueue` at `repository_after/src/queue.ts`. The suite must cover all public methods (`enqueue`, `getTask`, `getStats`, `pause`, `resume`, `clear`, `dispose`, `onTaskComplete`, `onTaskFailed`), priority ordering, exponential backoff, concurrency limits, and timeout recovery. All tests must pass the correct implementation, detect $\geq 90\%$ of 10 known buggy variants, and be fully deterministic with no flaky tests.

## 2. Required Success Criteria

- Enqueued tasks must default to priority `3`, `maxRetries` matching the constructor default (`3`), `attempts` at `0`, and `createdAt` as a `Date`. Returned task IDs must be unique non-empty strings. Initial status must be `"pending"`. Custom priority and `maxRetries` must override defaults.
- At least 5 validation/error tests are required: missing or non-function handler → `"Task handler must be a function"`, priority $< 1$, $> 5$, or non-integer → `"Priority must be an integer between 1 and 5"`, negative `maxRetries` → `"maxRetries must be a non-negative integer"`, enqueue after `dispose()` → `"Cannot enqueue tasks on a disposed queue"`, `maxConcurrency: 0` → `"maxConcurrency must be at least 1"`.
- Priority 1 tasks must execute before priority 5 tasks. Equal-priority tasks must follow FIFO order. A high-priority task enqueued after low-priority ones must still execute first. Ordering must hold under load ($\geq 10$ mixed-priority tasks, execution order non-decreasing).
- Status transitions `pending` → `running` → `completed` must be verified at each stage. Handlers must auto-execute after enqueue and receive the correct data payload. The result must be stored on the task object. `startedAt` and `completedAt` must be set as `Date` instances.
- At least 2 concurrency tests are required: no more than `maxConcurrency` tasks may run simultaneously (tracked via a concurrent counter), and the next queued task must start immediately when a slot frees.
- Failed tasks must retry, with total attempts not exceeding `maxRetries`. Exponential backoff delay must equal `baseDelay * 2^(attempts-1)`, verified with fake timer advancement. A task succeeding on retry must become `"completed"` with the correct `attempts` count. A task exhausting retries must become `"failed"` with the last error recorded. Status must reset to `"pending"` before retry re-queue.
- Tasks exceeding `defaultTimeout` must be marked `"timed_out"`. Timed-out tasks must retry if retries remain. The timeout timer must be cleared on early completion. The running set must be cleaned on timeout (no leak).
- `getTask(id)` must return the correct task, `getTask('nonexistent')` must return `undefined`, and the result must reflect live status. `getStats()` must return accurate counts for `pending`, `running`, `completed`, `failed`, `timedOut`, and `total` — verified through lifecycle transitions.
- `pause()` must prevent new processing while allowing running tasks to complete. `resume()` must restart queued task processing. `clear()` must remove pending tasks without affecting running tasks and must reset the pending count.
- `onTaskComplete` must be invoked with task details including `status: 'completed'` and `result`. `onTaskFailed` must be invoked after retries are exhausted, with the error.
- The handler must receive the original data reference without mutation. At least 1 test must use a complex nested object ($\geq 2$ nesting levels) as payload.
- Every test file must include `afterEach` that calls `queue.dispose()`, `jest.clearAllTimers()`, and `jest.useRealTimers()`. No leaked handles (`--detectOpenHandles` clean).
- Quantitative minimums: $\geq 30$ `test()`/`it()` blocks, $\geq 8$ test files in `repository_after/tests/`, $\geq 5$ error/edge-case tests, $\geq 3$ timing tests (fake timers + backoff/timeout assertions), $\geq 2$ concurrency tests, $\geq 1$ complex nested payload test, $\geq 1$ state-transition test (`pending→running→completed` in one test).

## 3. Regression & Safety Criteria

- All tests must pass the correct `repository_after/src/queue.ts` with Jest exit 0 and 0 failures.
- The suite must detect $\geq 90\%$ (9/10) of the known bug variants: bug-01 (priority reversed via `>` instead of `<`), bug-02 (extra retry via `<=` instead of `<`), bug-03 (constant delay instead of exponential), bug-04 (`clearTimeout` removed from success path), bug-05 (initial status `"running"` instead of `"pending"`), bug-06 (concurrency limit doubled), bug-07 (`running.delete(id)` removed from timeout), bug-08 (`task.result = result` removed), bug-09 (`onFailedCallback` invocation removed), bug-10 (`this.paused` check removed from `processNext`). 100% detection is required for an EXCELLENT rating.
- Tests must import only from `../src/queue`. No private member access (`generateId`, `insertByPriority`, `processNext`, `executeTask`, `scheduleRetry`).

## 4. Structural Constraints

- All tests must reside in `repository_after/tests/*.test.ts`, organized by feature area across $\geq 8$ files.
- The following files must not be modified: `repository_after/src/queue.ts`, `tests/meta-test.test.ts`, `tests/resources/*.ts`, `evaluation/evaluation.ts`.
- No `test.skip`, `test.only`, `xit`, `fit`, `xdescribe`, or `fdescribe` markers allowed.
- No empty test bodies. All timing tests must use `jest.useFakeTimers()`.
- Test names must be descriptive, and `describe()` blocks must label feature areas.

## 5. Failure Conditions

- Any test fails against the correct implementation.
- Bug detection rate falls below 90%.
- Fewer than 30 test cases, 8 test files, 5 error/edge-case tests, 3 timing tests with fake timers, or 2 concurrency tests.
- No nested-object payload test present.
- Missing `afterEach` cleanup in any file.
- Source file modified.
- Private member access in tests.
- Skipped or focused test markers present.
- Leaked handles detected.
- Forbidden markers in output (`heap out of memory`, `SyntaxError`, `TypeError`, `RangeError`, `ReferenceError`, `FATAL ERROR`).
- Total suite execution exceeds 30 seconds or any individual test exceeds 10 seconds.
- Priority load test uses fewer than 10 tasks or concurrency test uses fewer than 4 tasks (with `maxConcurrency` $< 4$).
- Results are not identical across 3 consecutive runs.

## 6. Evaluation Method

- Run `npm install`, then verify $\geq 8$ test files exist in `repository_after/tests/*.test.ts` with $\geq 30$ total `test()` blocks, and no `test.skip`/`test.only`/`xit`/`fit` markers.
- Execute `npx jest repository_after/ --no-coverage --json` — must exit 0 with `numFailedTests == 0` and `numPassedTests >= 30`.
- Execute `npx jest tests/meta-test.test.ts --no-coverage --json` — the "Verification: Original" suite must pass and $\geq 9/10$ bugs must be caught.
- Run `npx ts-node evaluation/evaluation.ts` to produce `report.json`. Verify `runs.main.success == true` and `detectionRate >= 90`.
