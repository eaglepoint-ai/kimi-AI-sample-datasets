# Task Rubric: H2O Concurrency Synchronization

**Task ID:** `IMKWHD`
**Category:** `New Feature Development`

## 1. Objective

Implement a thread-safe solution in Java that coordinates Oxygen (O) and Hydrogen (H) threads to form water molecules ($H_2O$). The system must ensure that for every three threads released, exactly two are Hydrogen and one is Oxygen, and that molecules are formed atomically without interleaving with the next group.

## 2. Required Success Criteria

- The solution must strictly permit two `hydrogen()` calls for every one `oxygen()` call. No sequence of three released threads can deviate from this ratio.
- A synchronization primitive must be used to ensure that all three threads (1 O, 2 H) arrive before any of them call their respective `release` method.
- The code must ensure that all three threads in a specific molecule "bond" (pass the barrier) before any thread from a _subsequent_ molecule is allowed to proceed.
- Oxygen threads must block if $< 2$ Hydrogen threads are available.
- Hydrogen threads must block if $< 1$ Oxygen or $< 1$ other Hydrogen thread is available.
- After three threads have bonded, the internal counters/permits must reset correctly to allow the next threads to process without deadlock or stale state.
- The solution must be free of race conditions under high contention (e.g., $n=20$ molecules arriving simultaneously).

## 3. Regression & Safety Criteria

- The system must not enter a state where threads are indefinitely waiting when a complete set of 1O and 2H is technically available in the pool.
- The solution should ideally handle `InterruptedException` without leaving semaphores or barriers in a "broken" state that prevents future molecules from forming.
- Shared variables (counters, flags) must be properly guarded using `volatile`, `AtomicInteger`, or `synchronized` blocks to ensure visibility across threads.

## 4. Structural Constraints

- Must utilize classes from `java.util.concurrent`. A "pure" `synchronized/wait/notify` approach is acceptable only if it handles the "spurious wakeup" and "barging" problems correctly.
- Must implement `hydrogen(Runnable releaseHydrogen)` and `oxygen(Runnable releaseOxygen)` as defined in standard concurrency challenges.
- Threads must be suspended while waiting (no `while(true)` loops without a blocking call) to conserve CPU cycles.

## 5. Failure Conditions

- If thread $H_3$ from the second molecule passes the barrier before $O_1$ from the first molecule has finished its release method.
- Any execution sequence that results in "HHO" then "HOO" or any other non-2:1 permutation.
- A scenario where Hydrogen threads are available but the Oxygen thread never "wakes" them up.
- Failure to release locks or permits in a `finally` block if an exception occurs (if applicable).

## 6. Evaluation Method

- Run the code with a variety of shuffled inputs (e.g., `OHHOHH`, `HHHHOO`). Capture the output of `releaseHydrogen` and `releaseOxygen`. Split the output string into groups of three. Check does every substring of length 3 contain 'H', 'H', and 'O' in any order?
- Execute $N=20$ with a `CachedThreadPool` to maximize thread interleaving. Ensure the program terminates gracefully every time.
- Verify that `barrier.await()` or `semaphore.release()` is called in the correct order to prevent "bleeding" into the next molecule's cycle.
