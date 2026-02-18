# Task Rubric: Fitness Tracking API Validation Suite

**Task ID:** `NUN3U2`
**Category:** `Code Testing`

## 1. Objective

Construct a deterministic, high-fidelity integration test suite using Jest and Supertest to verify the functional correctness, business logic, and data integrity of the Fitness Tracking Express API.

## 2. Required Success Criteria

- Tests must initialize using Jest with TypeScript and utilize Supertest to wrap the application instance without launching a network listener.

- Implement `beforeEach` hooks that reset `data.json` using a baseline from a `test-fixtures` directory. The original `data.json` must be backed up before the suite and restored upon completion.

- Verify `GET /users` returns all users with correct schema (ID, streak, badges, etc.) and respects the `activeOnly` filter.

- Verify `POST /users` returns 201 with a unique ID and handles validation errors (400 for missing fields/invalid email, 409 for duplicates).

- Verify `GET /workouts` supports filtering by `userId`, date ranges, and exercise types, including ascending/descending sorts.

- Verify `POST /workouts/:id/complete` updates the `completedAt` timestamp and triggers secondary effects (badge evaluation, PR updates).

- Verify that streaks increment on consecutive days, reset to 1 after a missed day, and do not double-count multiple workouts on the same day.

- Verify awarding of count-based (1, 50, 100 workouts), streak-based (7, 14, 30 days), and weight-milestone (Bench Press 200lbs) badges.

- Verify recommendations exclude exercises requiring unavailable equipment and deprioritize the 5 most recently performed exercises.

- Use clock manipulation to verify streak calculations across midnight boundaries and DST transitions.

## 3. Regression Criteria

- All existing API response structures and status codes must remain identical to the current production implementation.

- The state of `data.json` after the test suite completes must be identical to its state before the suite began.

- Existing streak calculation logic in `app.ts` must not be modified or bypassed to make tests pass.

## 4. Structural Constraints

- Define and use TypeScript interfaces for all expected API response shapes to ensure compile-time verification.

- Tests must be organized into separate files or `describe` blocks based on feature domains (Users, Workouts, Recommendations).

- Every asynchronous call (Supertest requests, FS operations) must be properly `awaited` to prevent race conditions.

## 5. Failure Conditions

- Any test that fails intermittently due to system time reliance or unseeded randomness.

- Failure to reset `data.json` between tests, leading to cross-test dependencies.

- Tests that verify specific IDs or strings that are expected to be dynamically generated.

- Suppressing API errors within `try/catch` blocks instead of asserting specific error status codes.

## 6. Evaluation Method

- Run docker test command and ensure 100% pass rate.

- Verify that every business rule mentioned in the prompt has a corresponding test anchor.

- Verify the existence of the `test-fixtures` directory and the file backup/restoration logic.
