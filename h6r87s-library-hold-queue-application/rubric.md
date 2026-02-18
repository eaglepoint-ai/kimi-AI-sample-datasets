# Task Rubric: Library Hold Queue System

**Task ID:** `H6R87S`
**Category:** `Full Stack Development`

## 1. Objective

Develop a full-stack library management system that handles book holds with a "freeze" mechanic. The system must maintain stable, 1-based queue positions and implement a specific skip-logic algorithm for copy assignment using a Node.js/Express backend and a React frontend.

## 2. Required Success Criteria

- Hold positions must be assigned once (1-based) and **never change** or renumber, even if earlier holds are fulfilled or cancelled.
- When a copy is returned, the system must scan the queue in ascending position order.
- The copy is assigned to the first person who is **not fulfilled** and **not frozen**.
- If Alice (Pos 1) is frozen and Bob (Pos 2) is active, Bob must receive the copy.
- `POST /api/freeze` must mark a hold as skipped for future assignments without moving its position.
- `POST /api/unfreeze` must trigger an immediate check. If a copy is available, the unfrozen hold must be fulfilled immediately.
- Reject `POST /api/hold` if the email already has an active (non-fulfilled) hold for that `bookId`.
- Must strictly validate for the presence of `@` and `.` (no external libs).
- Both `bookId` and `holdId` must be integers incremented manually (1, 2, 3...).
- All data must persist in `backend/data/*.json`. The application must handle the state such that a server restart does not lose the queue or current assignments.

## 3. Regression & Consistency Criteria

- Copy assignment must be atomic. A single returned copy cannot be assigned to two users, and a user cannot be fulfilled twice.
- `availableCopies` must decrement when a hold is fulfilled and increment when a book is returned (if no eligible holds exist).
- The frontend must accurately reflect the queue order, the `availableCopies` count, and the user's specific position as returned by the API.

## 4. Structural Constraints

- Project must contain a `/frontend` (React) and `/backend` (Node/Express) directory.
- Use of `uuid`, `mongodb`, `sequelize`, or `validator` is strictly prohibited. Implementation must use native JS and the `fs` module.
- Endpoints must match the prompt exactly (e.g., `POST /api/return` must take `bookId`).

## 5. Failure Conditions

- If deleting or fulfilling a hold causes other users' positions to shift (e.g., Pos 2 becoming Pos 1).
- If a copy is assigned to a user while their `frozen` flag is `true`.
- If a copy is available, but a user unfreezes and remains "pending" instead of being immediately fulfilled.
- If data is lost when the Node.js process terminates.
- If two concurrent `POST /api/hold` requests for the last copy result in both users being marked as fulfilled.

## 6. Evaluation Method

- **Scenario Test:**
    1. Create book with 0 available copies.
    2. Place holds for Alice (Pos 1), Bob (Pos 2), Charlie (Pos 3).
    3. Freeze Alice.
    4. Return a copy.
    5. _Verify:_ Bob is fulfilled; Alice remains at Pos 1 (pending/frozen).
- Stop the server, restart, and verify the queue positions and frozen statuses remain identical.
- Rapidly trigger `unfreeze` on multiple users when one copy is available; ensure only the lowest position gets the copy.
- Ensure the frontend correctly displays "Already on hold for this book" upon duplicate attempts.
