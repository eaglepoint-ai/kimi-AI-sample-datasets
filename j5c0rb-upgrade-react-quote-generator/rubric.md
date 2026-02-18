# Task Rubric: Upgrade React Quote Generator

**Task ID:** `J5C0RB`
**Category:** `Frontend / React Feature Enhancement`

## 1. Objective

Enhance an existing React class-based quote generator with heart-based favorites, search, undo-capable removal, and localStorage persistence — without external dependencies or changes to the original quote display and data shape. The component must remain a class extending `React.Component`, the `quotes()` data function must stay unmodified, and all original rendering behavior (`randomQuoteIndex`, `handleChange`, `Math.random()`, "Generate Random Quote" button, `.quote-section` class) must be preserved.

## 2. Required Success Criteria

- `Quote.js` must contain `import React`, import from the quotes data module, have a default export, maintain `randomQuoteIndex` in state, implement a `handleChange` method using `Math.random`, render a button matching `/Generate.*Quote|Random.*Quote/i`, and display `.quote` and `.author` properties within a `.quote-section` class.
- `quotes.js` must export a function named `quotes` returning an array of objects with `"id"`, `"quote"`, and `"author"` fields, with $\geq 10$ quotes present.
- The component must use `class Quote extends React.Component` (exact match), have a `render()` method returning JSX with `<div>` elements, and contain no references to external state management (`redux`, `mobx`, `recoil`) or external timer libraries (`lodash` + `debounce`).
- A heart icon ($\heartsuit$, $\varheartsuit$, or the word "heart") must exist with CSS class `heart-btn`. The `filled` class must be applied when the current quote is favorited. Component state must contain a `favorites` array. Code must check whether the current quote is already favorited, and the heart state must update in real time when the random quote changes.
- A maximum of 10 favorites must be enforced, with a length check before adding. The effective count must consider the pending-removal state. Duplicate detection must compare `.quote` text only (author ignored).
- Favorites must render in a list structure (`<ul>`, `<ol>`, or `.map()`), with new favorites appended to the end (oldest first). Each item must have CSS class `favorite-item` and show quote text in an element with class `favorite-quote`.
- A search text input must exist (class `search-input`), tracking `searchQuery` in state. Filtering must be case-insensitive via `toLowerCase()`, match against both `.quote` and `.author`, and use a filter method or filtered variable.
- An undo option must exist with a 5-second timeout (`setTimeout` / `5000`). Pending removal must be tracked in state, and the original position must be stored for restore. `clearTimeout` must be called to cancel previous timers. Required CSS classes: `remove-btn` on remove buttons, `undo-btn` on the undo button, `undo-banner` on the undo banner.
- localStorage key must be exactly `"favoriteQuotes"`. Favorites must load from localStorage on mount, display in correct order (oldest first), handle max 10 from storage correctly, and yield an empty list when localStorage is empty. Invalid JSON must not crash the component. localStorage must NOT be written on the remove action itself, must be written after the undo timeout expires ($\approx 5100$ms), and must be written immediately on undo (restore).
- On initial mount with seeded localStorage, no undo UI (`.undo-btn`, `.undo-banner`) must be visible, no undo timer must be active, and displayed favorites must exactly match the localStorage data in count and content.

## 3. Regression & Safety Criteria

- `src/data/quotes.js` must be byte-identical to the original (empty diff).
- The quote component must remain a class component — no conversion to function/hooks.
- "Generate Random Quote" button must be present and functional.
- `randomQuoteIndex` and `handleChange` must exist in the component.
- Quote and author rendering in `.quote-section` must be preserved.
- `repository_before` must FAIL the full test suite (baseline gate), and `repository_after` must PASS.

## 4. Structural Constraints

- Only `src/components/Quote.js` and `src/App.css` may be modified. `quotes.js`, `App.js`, `index.js`, and `index.html` must not change behaviorally.
- No new npm dependencies allowed. Only `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `react`, `react-dom`, `react-scripts`, and `web-vitals` are permitted.
- Must use React class component patterns only (state, lifecycle methods, class properties) — no external state management or timer/utility libraries.
- Required CSS classes in DOM: `quote-section`, `heart-btn`, `filled` (conditional), `favorites-list`, `favorite-item`, `favorite-quote`, `favorite-author`, `search-input`, `remove-btn`, `undo-btn`, `undo-banner`.
- localStorage value format: JSON array of `{ quote: string, author: string }`.

## 5. Failure Conditions

- Component converted to a function or hook-based component.
- `quotes.js` data file modified in content, signature, or shape.
- New npm dependency added, or external state management / timer library imported.
- `randomQuoteIndex`, `handleChange`, or `Math.random` removed or renamed.
- "Generate Random Quote" button removed or non-functional.
- Favorites exceed 10 items at any point, or duplicate favorites (same quote text) are allowed.
- localStorage written during the undo window (on the remove action).
- Undo state persists across page refresh.
- Component crashes on invalid localStorage JSON.
- Console errors or warnings during normal operation.
- Heart icon does not reflect the correct state after a random quote change.
- Undo restore places a quote at the wrong position.
- Search filtering mutates the underlying favorites order.

## 6. Evaluation Method

- Run `npm install` in the project root with Node.js 18+, verifying `jest.config.js` targets `tests/setup.js` and `tests/**/*.test.js`.
- Execute original-functionality tests: `REPO_PATH=./repository_after npx jest --testPathPattern=tests/original-functionality.test.js --forceExit` — all 14 tests must pass with exit code 0.
- Execute feature tests: `REPO_PATH=./repository_after npx jest --testPathPattern=tests/quote-features.test.js --forceExit` — all 17 tests must pass with exit code 0.
- Execute runtime-behavior tests: `REPO_PATH=./repository_after npx jest --testPathPattern=tests/runtime-requirements.test.js --forceExit` — all 13 tests must pass with exit code 0.
- Run the baseline regression gate: `REPO_PATH=./repository_before npx jest --testPathPattern=tests/ --forceExit` — must exit non-zero (original codebase lacks new features).
- Run `node evaluation/evaluation.js` — verify `report.success === true`, `report.after.tests.passed === true`, `report.before.tests.passed === false`, exit code 0.
- Inspect `repository_after/src/components/Quote.js` to confirm: `class Quote extends React.Component` is present, no imports beyond `react` and `../data/quotes`, `localStorage.setItem` is absent from the `removeFavorite` synchronous path, `clearTimeout` is called before setting a new undo timer, and `componentWillUnmount` clears the active timer.
- The full test suite ($\approx 35$ tests) must complete within 120 seconds. The undo timeout must trigger a localStorage write within 5100ms of removal. The component must render 10 pre-seeded favorites within the `waitFor` default timeout (1000ms).
