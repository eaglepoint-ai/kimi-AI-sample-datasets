# Trajectory – Enhance React Kanban Board (47XCS1)

## 1. Audit the Original Code

I examined the existing Kanban board. It has drag-and-drop working with `dataTransfer.setData("id", name)`. The `onDrop` function mutates tasks inside a `filter` — this is a React anti-pattern that could cause re-render bugs. Tasks have shape `{ name, category, bgcolor }`. The bgcolor values vary but I need to map them to priorities.

## 2. Define Feature Requirements

Five features needed: add task, edit task, delete task, priority display/change, localStorage persistence. Constraints: no new dependencies, preserve drag-and-drop, task shape unchanged, inline styles only, `name` is the unique identifier following `STORY-XXXX: <Title>` format.

## 3. First Attempt: Add Task Modal

I added an "Add Task" button per column. Created `addModal` state to track which column. Rendered a modal inline with title input and priority dropdown. 

Bug: Modal closes when clicking inside it. The click bubbles to the overlay. Fixed by checking `e.target === overlayRef.current`.

Bug: How to generate unique `STORY-XXXX` prefix? Wrote `generateStoryNumber` with random 4-digit number, but realized collision risk. Updated to loop until finding a non-colliding `${prefix}: ${title}` combination.

## 4. Implement Edit Feature

Added `editingName` and `editValue` state. Double-click extracts suffix after `STORY-XXXX:` for editing.

Bug: Card drags while editing text. Added `draggable={!isEditing}` and `e.preventDefault()` in `onDragStart`.

Bug: Saving empty title creates `STORY-1234: ` (no suffix). Added check to revert if trimmed value is empty.

Bug: Editing to an existing task name overwrites it. Added duplicate check — if new name exists and differs from current, revert instead of saving.

## 5. Delete Feature with Hover Button

Wanted a `×` button appearing on hover. Inline styles can't do `:hover`. Tried `onMouseEnter`/`onMouseLeave` but it caused excessive re-renders.

Solution: Injected `<style>` tag with `.task-card:hover .delete-x { display: block !important; }`. Button has `display: none` by default.

Bug: Clicking delete triggers drag. Added `stopPropagation` on `onMouseDown` and `onClick`.

## 6. Priority Mapping

Mapped bgcolor to priority by examining seed data: `#ee9090` → High (red dot), `#eeed90` → Medium (orange dot), `lightgreen` → Low (green dot). Unknown colors → "None" (grey dot). Created `BGCOLOR_PRIORITY` and `PRIORITY_BGCOLOR` constants.

## 7. Context Menu for Priority

Right-click opens menu at cursor position. Added `contextMenu` state with `{ name, x, y }`.

Bug: Menu doesn't close on outside click. Added `useEffect` with document click listener. Had to include `contextMenu` in dependency array so effect re-runs when menu opens.

## 8. localStorage Persistence

Created `useTasks` hook with lazy initialization: `useState(loadTasks)`. The `loadTasks` validates structure: array, non-empty, each task has exactly 3 keys (`name`, `category`, `bgcolor`), all strings, category is "wip" or "complete". Falls back to `DEFAULT_TASKS` on failure.

Bug: Forgot try/catch around localStorage. In private browsing, `localStorage.getItem` throws. Added try/catch in both `loadTasks` and `saveTasks`.

## 9. Keyboard Handling Conflicts

Added global Escape listener to close modals/menus/edit.

Bug: Escape closes everything at once, even inactive states. Fixed by checking which state is active: `if (addModal) closeAddModal(); if (contextMenu) closeContextMenu(); ...`

Bug: Enter in add modal submits even when focus is on dropdown. Added `e.preventDefault()` in keydown handler.

## 10. Fix Original Drag-and-Drop Bug

Changed `onDrop` from mutation-based `filter` to immutable `map`:
```javascript
const newTasks = tasks.map((task) =>
  task.name === id ? { ...task, category: cat } : task
);
```

## 11. Component Extraction

`App.js` became messy. Extracted: `AddTaskModal`, `Column`, `TaskCard`, `DeleteConfirmDialog`, `ContextMenu`. Created `columnProps` object to share props between columns. Moved helpers to `utils/helpers.js`, constants to `constants/index.js`, hook to `hooks/useTasks.js`.

## 12. Manual Testing & Fixes

Tested each feature:
- Add: Modal wasn't resetting priority. Fixed by resetting `addPriority` in `closeAddModal`.
- Delete: Confirmation dialog didn't focus "Yes". Added `autoFocus`.
- Priority: Context menu stayed open after selection. Added `setContextMenu(null)` in `choosePriority`.
- localStorage: Wasn't validating category values. Added `VALID_CATEGORIES` set check.

## 13. Result

All five features working. Drag-and-drop preserved. localStorage handles errors gracefully. Inline styles throughout except hover (via `<style>` tag). No new dependencies added.