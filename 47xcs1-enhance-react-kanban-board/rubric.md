# Task Rubric: Enhance React Kanban Board

**Task ID:** `47XCS1`
**Category:** `Frontend / React / Feature Enhancement`

## 1. Objective

Add five features — Add Task, Edit Task, Delete Task, Priority Display/Change, and localStorage Persistence — to a two-column React Kanban board while preserving drag-and-drop, the task shape `{ name, category, bgcolor }`, and the existing column layout (`In-PROGRESS` / `COMPLETED`). The solution must pass all 91 automated tests with zero failures.

## 2. Required Success Criteria

- The app must render with heading `JIRA BOARD: Sprint 21U`, column headers `In-PROGRESS` and `COMPLETED`, and all 5 default seed tasks (`STORY-4513`, `STORY-4547`, `STORY-4525`, `STORY-4526`, `STORY-4520`) when no localStorage is present.
- No forbidden libraries may be listed in `package.json` or imported in `src/` (`react-dnd`, `react-beautiful-dnd`, `@dnd-kit/*`, `sortablejs`, `uuid`, `nanoid`, `@mui/material`, `antd`, `@chakra-ui/react`).
- Add Task buttons (`add-task-wip`, `add-task-complete`) must open a modal (`add-modal`) containing a title input, description input, and a priority `<select>` with options `Low`, `Medium`, `High`. The modal must close on valid submit, outside-click on overlay, or Escape. Pressing Enter on the title input or priority select must also submit.
- Empty title submissions must be rejected (task count stays at 5). Valid submissions must produce a task name matching `/^STORY-\d{4}: <Title>$/` where XXXX $\in [1000, 9999]$, with no duplicate full names. Collisions must trigger regeneration of the random number.
- Task shape must remain exactly `{ name, category, bgcolor }` — no additional top-level fields. The bgcolor map is: `#ee9090` $\leftrightarrow$ High, `#eeed90` $\leftrightarrow$ Medium, `lightgreen` $\leftrightarrow$ Low. Priority dots must reflect: `#ee9090` → red, `#eeed90` → orange, `lightgreen` → green, unmapped → grey.
- Double-clicking a card must reveal an inline `edit-input` pre-filled with the part after the first `:` (trimmed). Saving must preserve the `STORY-XXXX:` prefix. An edit creating a duplicate full name must silently revert. Empty input on Enter or blur must revert. Escape must cancel. The card must have `draggable="false"` while editing.
- Each card must have a delete button (`delete-btn-<task.name>`) with inline `display: none`, shown on hover via a `<style>` tag (`.task-card:hover .delete-x { display: block }`). Clicking delete must open a confirmation dialog (`delete-confirm-dialog`) with `"Delete this task?"`, `delete-yes`, and `delete-no` buttons. Clicking `delete-no` or the overlay must cancel.
- `mousedown` on the delete button must call `stopPropagation()`, and `dragstart` must call both `stopPropagation()` and `preventDefault()` to prevent drag interference.
- Right-clicking a card must open a context menu (`context-menu`) with `ctx-low`, `ctx-medium`, `ctx-high` options. Selecting an option must set the card's `style.backgroundColor` per the bgcolor map and close the menu. The menu must not set any card's `draggable` to `false`. Clicking `document.body` must close the menu.
- Add, delete, edit, priority change, and drag-move must all persist to `localStorage` under key `kanban-tasks` immediately.
- On mount, localStorage data must be accepted only if `getItem` does not throw, the raw string parses as valid JSON, the parsed value is a non-empty `Array`, and every element is a non-null object with exactly 3 keys (`name` as string, `category` $\in$ `{"wip", "complete"}`, `bgcolor` as string). All other cases — absent key, invalid JSON, bad shape, `null`, string, number, plain object, empty array, mixed valid/invalid entries — must fall back to the default seed. `getItem` throwing must not crash the app, and `setItem` throwing must not prevent task addition.
- Each `.task-card` must have inline styles: truthy `backgroundColor`, `height: "50px"`, `display: "flex"`, `alignItems: "center"`, `justifyContent: "center"`, `borderRadius: "5px"`, `margin: "5px"`, `padding: "5px"`, `position: "relative"`. The `app-container` must have `textAlign: "center"`, `fontFamily: "monospace"`. The `board` must have `display: "flex"`, `justifyContent: "space-around"`. The heading must have `textDecorationLine: "underline"`, `fontSize: "1.5rem"`. Cards must retain CSS class `task-card`.
- Escape must close the context menu, delete dialog, add modal, and cancel inline edit. Tab on the last add-modal element (`add-cancel-btn`) must wrap focus to `add-title-input`, and Shift+Tab on the first must wrap to the last. Tab on `delete-no` must move to `delete-yes`, and Shift+Tab on `delete-yes` must move to `delete-no`.
- Cards must have `draggable="true"` when not in edit mode. Drag simulation must move tasks between columns and update `category` in localStorage. Feature combinations (add→edit, add→delete, priority→edit) must all work correctly in sequence.
- `console.error` must not be called during render, add, edit, delete, priority change, drag, or localStorage-throws-on-priority. `console.warn` must not be called during render, add, edit, delete, priority change, or drag.
- Adding or editing with a 1000-character title must succeed. A 2000-character title must trigger no `console.error`.

## 3. Regression & Safety Criteria

- The existing drag-and-drop behavior must remain fully functional after all feature additions.
- Tasks with extra fields in localStorage must trigger fallback to defaults — the system must never silently accept malformed data.
- localStorage errors (both `getItem` and `setItem` throwing) must be handled gracefully without crashing the app or leaving it in an inconsistent state.
- Layout styles on tested elements must be applied via inline styles, not CSS classes, to ensure test compatibility.
- All required `data-testid` attributes must be present when their corresponding elements are rendered.

## 4. Structural Constraints

- All source must reside under `repository_after/src/`. Files `repository_before/`, `tests/App.test.js`, `evaluation/evaluation.js`, and `jest.config.js` must not be modified.
- React functional components and hooks only — no class components, no external state management.
- Task name format: `STORY-XXXX: <Title>`, XXXX $\in [1000, 9999]$.
- CSS classes retained: `task-card` on cards, `delete-x` on delete button, `wip` on the WIP column.
- The following `data-testid` contract must be honored: `app-container` (root wrapper), `board` (flex container), `column-wip` / `column-complete` (drop targets), `add-task-wip` / `add-task-complete` (add buttons), `add-modal` / `add-modal-overlay` (modal and backdrop), `add-title-input` / `add-description-input` / `add-priority-select` (form fields), `add-submit-btn` / `add-cancel-btn` (modal buttons), `edit-input` (inline edit), `delete-btn-<name>` (per-card delete), `delete-confirm-dialog` / `delete-confirm-overlay` (delete dialog and backdrop), `delete-yes` / `delete-no` (confirm/cancel), `context-menu` (priority menu), `ctx-low` / `ctx-medium` / `ctx-high` (priority options), `priority-dot-<name>` (per-card priority dot).

## 5. Failure Conditions

- Task object contains a key other than `name`, `category`, `bgcolor`.
- Task created with a name not matching `/^STORY-\d{4}: .+$/`.
- Duplicate `name` values exist simultaneously.
- Edit modifies the `STORY-XXXX:` prefix.
- Edit saves an empty title.
- Card has `draggable="true"` during edit mode.
- Delete button interaction starts a drag.
- Context menu sets any card's `draggable` to `false`.
- localStorage error crashes the app.
- `console.error` or `console.warn` fires during any operation.
- Forbidden library imported or listed in `package.json`.
- Invalid localStorage data crashes the app instead of falling back to defaults.
- Any required `data-testid` missing when its element should render.
- Layout styles on tested elements applied via CSS classes instead of inline.

## 6. Evaluation Method

- Run `cd repository_after && npm install`, then execute `node evaluation/evaluation.js`. This runs all 91 tests via Jest against `repository_after/src/`, outputs per-test pass/fail, and generates `evaluation/reports/<date>/<time>/report.json`.
- Exit code must be `0`, `report.success` must be `true`, `report.after.metrics.failed` must be `0`, `report.after.metrics.errors` must be `0`, and `report.after.metrics.passed` must be `91`.
- All 91 tests must pass within 120 seconds total, with a per-test timeout of 30 seconds, under Node.js/jsdom.
- Verdict is binary: **PASS** if all 91 tests pass with exit code 0, **FAIL** if any test fails. No partial credit.
