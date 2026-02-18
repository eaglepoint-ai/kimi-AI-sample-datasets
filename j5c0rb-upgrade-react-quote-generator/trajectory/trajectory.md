# Trajectory — React Quote Generator Upgrade (J5C0RB)

The task is to upgrade an existing React quote generator that currently only displays random quotes from a static array. We need to add four new features — favorites management (heart icon, max 10, no duplicates), case-insensitive search filtering, a 5-second undo mechanism for removals with deferred localStorage persistence, and data persistence across page refreshes — all while preserving the original random quote generation behavior.

## 1. Analysis

Audited `Quote.js` — found a 26-line class component with a single state field (`randomQuoteIndex`), one button, and no persistence or personalization.

Decomposed the prompt into five feature areas:
1. **Favorites management** — heart toggle, max 10, duplicate prevention by quote text only
2. **Search** — case-insensitive filter on both quote text and author, real-time
3. **Undo** — 5-second window, restore to original position, only one at a time
4. **Persistence** — localStorage, survive refresh
5. **Preserve original behavior** — random quote generation must keep working

Identified three critical feature interactions:
- Undo ↔ Heart: removal must immediately unfill the heart and free the slot
- Undo ↔ Add: adding a new favorite while undo is pending must finalize the removal (prevents exceeding 10 on undo)
- Search ↔ Remove: filtered indices ≠ actual array indices

## 2. Strategy

**Kept class component** — converting to hooks risks behavioral differences; `componentDidMount`/`componentWillUnmount` naturally fit localStorage loading and timer cleanup. [Docs](https://react.dev/reference/react/Component)

**Chose flat state over reducer** — five fields are simple enough that a reducer adds indirection without benefit:

```javascript
state = {
    randomQuoteIndex: 0,
    favorites: [],         searchQuery: "",
    pendingRemoval: null,  // {item, originalIndex}
    undoTimerId: null
}
```

**Freed slot immediately on removal** — `getEffectiveFavoritesCount()` returns `favorites.length` directly, so removing a favorite re-enables the heart right away:

```javascript
// ... inside getEffectiveFavoritesCount()
return this.state.favorites.length;
```

> ⚠️ **Self-correction:** Initially added +1 for `pendingRemoval` to reserve the slot — but this kept the heart disabled for 5 seconds after removing from a full list, preventing re-adding. Fixed by returning `favorites.length` directly and instead finalizing the pending removal when adding a new favorite.

**Heart reflects only actual favorites** — `isQuoteFavorited` checks only the `favorites` array, not `pendingRemoval`. Removal immediately unfills the heart:

```javascript
// ... inside isQuoteFavorited()
return favorites.some(fav => fav.quote === quoteText);
```

> ⚠️ **Self-correction:** Initially also checked `pendingRemoval` — heart stayed filled after removal and a short-circuit in `handleHeartClick` blocked re-adding. Requirement says heart is filled only when quote is in favorites. Fixed by checking only `favorites` array.

**Finalized pending undo on new add** — if a user adds a favorite while undo is active, the pending removal is finalized (timer cleared, `pendingRemoval` nulled). This prevents undo from pushing count above 10.

**Deferred localStorage write** — delayed `localStorage.setItem` until the 5s timeout expires so refreshing during undo preserves the item. [Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

> ⚠️ **Self-correction:** First approach wrote to localStorage immediately on remove — violated requirement that localStorage retains the item during undo. Switched to deferred write after the 5-second timeout.

**Mapped original indices for filtered views** — attached `originalIndex` to each filtered item so removals target the correct position in the unfiltered array:

```javascript
// ... inside getFilteredFavorites()
.map((fav, idx) => ({ ...fav, originalIndex: idx }))
.filter(fav =>
    fav.quote.toLowerCase().includes(query) ||
    fav.author.toLowerCase().includes(query)
);
```

> ⚠️ **Self-correction:** Initially passed the filtered `.map()` index to `removeFavorite()` — removed the wrong item when search was active. Fixed by attaching `originalIndex` and using it in the click handler.

**Preserved original `Math.round(Math.random()*30)`** — the hardcoded multiplier is part of the original behavior.

> ⚠️ **Self-correction:** Initially changed to `Math.random()*(qt.length-1)` — altered distribution and eliminated the original hardcoded index behavior. Violated "preserve current behavior." Reverted to original `*30`.

## 3. Execution

1. **Extracted constants** — `STORAGE_KEY`, `MAX_FAVORITES = 10`, `UNDO_TIMEOUT_MS = 5000` to avoid magic strings/numbers.

2. **Loaded favorites defensively** in `componentDidMount` — three layers: check key exists, try/catch `JSON.parse`, verify `Array.isArray`:

```javascript
// ... inside componentDidMount()
const parsed = JSON.parse(stored);
if (Array.isArray(parsed)) {
    this.setState({ favorites: parsed });
}
```

3. **Cleaned up timers** in `componentWillUnmount` — `clearTimeout(this.state.undoTimerId)` to prevent memory leaks.

4. **Preserved original random index** — kept `Math.round(Math.random()*30)` exactly as in the original code.

5. **Built heart toggle with two branches** — existing → remove, else → check capacity → finalize pending undo → append via spread for oldest-first order:

```javascript
// ... inside handleHeartClick()
if (existingIndex !== -1) {
    this.removeFavorite(existingIndex);
} else {
    if (!this.canAddFavorite()) return;
    // Finalize any pending removal before adding
    if (pendingRemoval && undoTimerId) {
        clearTimeout(undoTimerId);
    }
    const newFavorites = [...favorites, newFavorite];
    this.setState({
        favorites: newFavorites,
        pendingRemoval: null,
        undoTimerId: null
    }, () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    });
}
```

6. **Implemented undo-aware removal** — finalized prior undo first, then removed from array, stored `{item, originalIndex}`, and started a 5s timer that writes to localStorage using `this.state.favorites` (read at execution time, not closure capture):

```javascript
// ... inside removeFavorite()
const timerId = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.favorites));
    this.setState({ pendingRemoval: null, undoTimerId: null });
}, UNDO_TIMEOUT_MS);
// ...
```

> ⚠️ **Self-correction:** Initially captured `favorites` in the closure at creation time — second removal during the undo window wrote stale data. Fixed by reading `this.state.favorites` inside the callback at execution time.

7. **Implemented position-aware undo** — cleared timer, spliced item back to original index:

```javascript
// ... inside handleUndo()
const restoredFavorites = [
    ...favorites.slice(0, pendingRemoval.originalIndex),
    pendingRemoval.item,
    ...favorites.slice(pendingRemoval.originalIndex)
];
// ...
```

8. **Computed derived state in render** — calculated `isFavorited`, `canAdd`, `filteredFavorites` each cycle instead of storing in state. [Docs](https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state)

9. **Styled all new components** — heart button (filled/empty/disabled + scale hover), favorites cards, search input, undo banner, empty-state messages.

## 4. Resources

- [React.Component lifecycle](https://react.dev/reference/react/Component) — `componentDidMount`, `componentWillUnmount`
- [setState callback](https://legacy.reactjs.org/docs/state-and-lifecycle.html) — post-update persistence
- [Avoiding redundant state](https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state) — derived computation in render
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — persistence
- [setTimeout / clearTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout) — undo timer
- [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) — immutable array operations
- **Deferred Write Pattern** — delaying side effects to allow transient undo (similar to Gmail "Undo send")
- **Effective Count / Reservation Pattern** — counting logically-present-but-physically-absent items to maintain capacity invariants
