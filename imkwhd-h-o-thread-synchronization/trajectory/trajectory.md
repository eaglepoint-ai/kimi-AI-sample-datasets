# Trajectory

## Problem Analysis

The task requires synchronizing hydrogen and oxygen threads so they form water molecules (H₂O). Each molecule needs exactly 2 hydrogen threads and 1 oxygen thread to bond together before any of them can proceed. The key challenge is ensuring thread-safe grouping under concurrent arrivals.

### Core Constraints Identified
1. Threads must pass in groups of exactly 3 (2H + 1O)
2. An oxygen must wait for 2 hydrogens; a hydrogen must wait for its partners
3. All 3 threads in a group must bond before the next group starts
4. Must use `java.util.concurrent` synchronization tools
5. Must handle high contention, interruption, and avoid deadlocks

## Approach Selection

### Why Semaphores?

The problem naturally maps to a **producer-consumer pattern with permits**:
- Hydrogen threads *produce* signals that oxygen threads *consume*
- Oxygen threads *produce* signals that hydrogen threads *consume*

This mutual signaling is exactly what `Semaphore` provides. Other approaches (e.g., `ReentrantLock` + `Condition`, `CyclicBarrier`) would work but add unnecessary complexity.

### Design: Two Semaphores

We use two semaphores with a key insight — they form a **feedback loop**:

| Semaphore | Initial Permits | Meaning |
|---|---|---|
| `h` | 2 | How many hydrogens may enter the current cycle |
| `o` | 0 | How many "hydrogen signals" have been received by oxygen |

**Flow:**
1. Each hydrogen thread acquires 1 permit from `h` (blocks if no permits), runs its release callback, then releases 1 permit to `o`
2. The oxygen thread acquires 2 permits from `o` (blocks until 2 hydrogens have signaled), runs its release callback, then releases 2 permits back to `h`

This creates a cycle:
```
H acquires h(1) → signals o(1) ─┐
H acquires h(1) → signals o(1) ─┤
                                 ▼
              O acquires o(2) → signals h(2) → next cycle
```

### Why This Satisfies All Requirements

1. **Groups of 3 (2H + 1O):** `h` starts with 2 permits (exactly 2 H per cycle), `o` starts at 0 and needs 2 signals (exactly 1 O waits for 2 H)
2. **Oxygen waits for hydrogen:** `o.acquire(2)` blocks until 2 hydrogens have released
3. **Hydrogen waits for partners:** `h` only has 2 permits; a 3rd hydrogen blocks until oxygen resets with `h.release(2)`
4. **Bonding before next group:** Oxygen resets `h` permits only after all 3 have bonded — no new hydrogens can enter until oxygen completes
5. **Barrier resets:** `h.release(2)` in the oxygen method reopens the gate for the next molecule
6. **No early proceed:** Semaphore permit counts enforce strict ordering
7. **2H:1O ratio:** Mathematically guaranteed by the permit structure
8. **Recheck conditions:** Semaphores handle spurious wakeups internally
9. **Notification:** `Semaphore.release()` wakes waiting threads
10. **Interruption safety:** `Semaphore.acquire()` throws `InterruptedException` cleanly
11. **No extra releases:** Permit counts cap at exactly 2H + 1O per cycle
12. **High contention:** Fair semaphores (`true` flag) ensure FIFO ordering under contention
13. **Complete molecules:** Every thread that enters must complete the cycle
14. **No deadlocks:** The feedback loop ensures forward progress — 2 H always unlocks 1 O, which always unlocks the next 2 H

## Final Solution

```java
import java.util.concurrent.*;

class H2O {

    Semaphore h, o;

    public H2O() {
        h = new Semaphore(2, true);
        o = new Semaphore(0, true);
    }

    public void hydrogen(Runnable releaseHydrogen) throws InterruptedException {
        h.acquire();
        releaseHydrogen.run();
        o.release();
    }

    public void oxygen(Runnable releaseOxygen) throws InterruptedException {
        o.acquire(2);
        releaseOxygen.run();
        h.release(2);
    }
}
```

## Why Not Other Approaches?

| Approach | Drawback |
|---|---|
| `CyclicBarrier(3)` + Semaphores | More moving parts, barrier action needed for reset |
| `ReentrantLock` + `Condition` | Manual wait/signal logic, prone to subtle bugs |
| `wait()`/`notify()` | Low-level, hard to get right under contention |
| `Phaser` | Overkill for fixed group size |

The two-semaphore approach is minimal (24 lines), correct by construction, and maps directly to the problem's constraints.
