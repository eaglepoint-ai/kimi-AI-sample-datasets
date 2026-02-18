# Trajectory — Data Aggregation Script Optimization (x4p5c9)

## Problem Statement

The original script processes 400 records by loading them, normalizing names, computing statistics, generating a report, and analyzing it. While it produces correct output, it suffers from severe performance issues that make it unsuitable for larger datasets.

The script has multiple critical problems:
- **Quadratic and cubic time complexity**: Nested loops cause runtime to grow quadratically or cubically with data size
- **Shared mutable global state**: `GLOBAL_RECORDS` and `GLOBAL_NORMALIZED` make the code hard to test and reason about
- **Inefficient string building**: Character-by-character concatenation in loops creates many intermediate strings
- **Pointless operations**: Inner loops that do nothing but waste cycles
- **Poor scalability**: Doubling the data size causes 4x or 8x slowdown, making it impractical for production use

## Goal

Refactor so the script keeps **identical console output** (character-for-character) while achieving O(n) time and memory, no shared mutable state (pure functions with explicit inputs/outputs), single-pass algorithms, and standard library only—with no change to what the user sees.

## Strategy

### Strategy 1: Keep globals but optimize loops

My first attempt was to keep the global variables but optimize the nested loops:

```python
GLOBAL_RECORDS = []
GLOBAL_NORMALIZED = []

def compute_statistics():
    total = 0
    count = 0
    for record in GLOBAL_RECORDS:
        total += record["value"]  # Single loop instead of double
        count += 1
```

**Why it failed:**
- Still uses shared mutable global state, making testing difficult
- Functions have hidden dependencies on globals
- Can't easily test individual functions in isolation
- Global state can be modified between calls, breaking determinism
- The test suite explicitly checks for absence of globals

I realized that globals were a fundamental architectural problem, not just a performance issue.

### Strategy 2: Use caching to avoid recomputation

I thought I could cache intermediate results to speed things up:

```python
_cache = {}
def normalize_names():
    if 'normalized' in _cache:
        return _cache['normalized']
    # ... compute ...
    _cache['normalized'] = result
    return result
```

**Why it failed:**
- Adds complexity without addressing the core algorithmic issues
- Caching doesn't fix quadratic complexity in nested loops
- Still uses shared mutable state (the cache)
- The requirement is for linear algorithms, not cached quadratic ones
- Tests verify linear scaling, which caching can't provide

This approach missed the point—the algorithms themselves needed to be fixed, not cached.

### Strategy 3: Optimize string building but keep nested loops

I tried to fix the string building while keeping the nested loops:

```python
def generate_report(total, count):
    report_parts = []
    for name in GLOBAL_NORMALIZED:
        report_parts.append(name)
    report = "".join(report_parts)
    # ... rest
```

**Why it failed:**
- Still uses global state
- The nested loop in `analyze_report()` remains quadratic: O(n²) for n characters
- The double loop in `compute_statistics()` is still O(n²) even though it only adds each value once
- String building optimization helps but doesn't solve the fundamental complexity issues
- Tests verify linear time complexity, which nested loops can't achieve

I needed to rethink the entire approach, not just optimize parts of it.

### Strategy 4: Use list comprehensions but keep globals

I tried using more Pythonic list comprehensions:

```python
GLOBAL_NORMALIZED = [record["name"].lower() for record in GLOBAL_RECORDS]
```

**Why it failed:**
- Still relies on global state
- Doesn't address the quadratic analysis algorithm
- The `compute_statistics()` double loop is still inefficient
- Functions can't be tested independently
- Violates the requirement for no shared mutable state

The problem wasn't the syntax—it was the architecture and algorithms.

### Strategy 5: Parallel processing

I considered using multiprocessing to speed things up:

```python
from multiprocessing import Pool
def process_chunk(chunk):
    # process in parallel
```

**Why it failed:**
- Adds external complexity and dependencies
- Requirement specifies standard library only
- Doesn't fix the fundamental O(n²) algorithms
- Parallelization is orthogonal to fixing algorithmic complexity
- The goal is linear algorithms, not parallelized quadratic ones

This was overengineering—the algorithms needed to be fixed first.

## Correct Approach

After these failed attempts, I realized the solution required a complete architectural redesign: eliminate global state and rewrite all algorithms to be single-pass and linear.

### Phase 1: Eliminate Global State

The first step was to remove all shared mutable globals and make functions pure:

**Why this works:**
- Pure functions are easier to test—same inputs always produce same outputs
- No hidden dependencies—all inputs are explicit parameters
- Deterministic behavior—no shared state can cause unexpected side effects
- Functions can be composed and reused easily

**Implementation details:**

1. **`load_records(n)`**: Changed from mutating `GLOBAL_RECORDS` to returning a list. Added optional `n` parameter for testing different sizes. Now it's a pure function that returns data without side effects.

2. **`normalize_names(records)`**: Changed from mutating `GLOBAL_NORMALIZED` to taking records as input and returning normalized names. Uses list comprehension: `[record["name"].lower() for record in records]`—single pass, O(n).

3. **`compute_statistics(records)`**: Changed from using globals to taking records as parameter. The original double loop `for record in GLOBAL_RECORDS: for record2 in GLOBAL_RECORDS:` only ever added when `record["id"] == record2["id"]`, meaning each record's value was added exactly once. Simplified to a single loop: `for record in records: total += record["value"]`—same result, O(n) instead of O(n²).

4. **`generate_report(normalized_names, total, count)`**: Changed from using `GLOBAL_NORMALIZED` to taking normalized names as parameter. Uses `"".join(normalized_names)` instead of character-by-character concatenation—single pass, O(n) instead of O(n²).

5. **`analyze_report(report)`**: The original double loop counted pairs `(i, j)` where `report[i] == report[j]`. This is equivalent to: for each character `c`, count its frequency `f`, then sum `f²` over all characters. Changed to: one pass to count frequencies, then sum squares—O(n) instead of O(n²).

### Phase 2: Fix Algorithmic Complexity

Each function was rewritten to use single-pass algorithms:

**Why this works:**
- Single-pass algorithms are O(n) instead of O(n²) or O(n³)
- Linear scaling means doubling input roughly doubles runtime
- Memory usage is also linear—no quadratic memory growth
- Predictable performance makes the script production-ready

**Implementation details:**

1. **Normalization**: Removed the pointless inner loop that checked `if existing == new_name: pass`. This loop did nothing but waste cycles. The new version just lowercases each name once.

2. **Statistics computation**: The original double loop was O(n²) but only added each value once (when `id == id`). Replaced with single loop that directly sums values—same result, O(n).

3. **Report generation**: The original nested loop built strings character-by-character: `report = report + ch`. This creates many intermediate strings. Changed to `"".join(normalized_names)` which builds the string in one operation—O(n) instead of O(n²).

4. **Report analysis**: The original counted pairs `(i, j)` with a double loop: O(n²) for n characters. The insight: counting pairs where `report[i] == report[j]` equals summing `freq(c)²` for each character `c`. New algorithm: one pass to count frequencies, then sum squares—O(n).

### Phase 3: Orchestration in `main()`

The `main()` function wires everything together:

```python
def main():
    print("Starting analysis...")
    records = load_records()
    normalized = normalize_names(records)
    total, count = compute_statistics(records)
    report = generate_report(normalized, total, count)
    print(report)
    analyze_report(report)
    print("Analysis finished.")
```

**Why this works:**
- Clear data flow: load → normalize → compute → generate → analyze
- Each step is independent and testable
- No shared state between steps
- Easy to understand and maintain

## Bugs Encountered and Fixed

### Bug 1: Forgetting to remove the pointless inner loop

**The problem**: In `normalize_names()`, I initially kept the inner loop that checked `if existing == new_name: pass`. This loop did nothing but still ran for every name, wasting cycles.

**The fix**: Removed the entire inner loop. The normalization only needs to lowercase each name once.

### Bug 2: Incorrect statistics computation

**The problem**: I initially tried to optimize `compute_statistics()` by summing values directly, but I misunderstood the original logic. The double loop only added when `record["id"] == record2["id"]`, which happens exactly once per record.

**The fix**: Realized that the condition `record["id"] == record2["id"]` means we're only adding each record's value once. Simplified to a single loop that sums all values directly.

### Bug 3: String concatenation in report generation

**The problem**: Initially tried to optimize by building a list and joining, but still had nested loops for character-by-character building.

**The fix**: Realized that `normalized_names` is already a list of strings. Just use `"".join(normalized_names)` directly—no need to iterate over characters.

### Bug 4: Wrong analysis formula

**The problem**: The original analysis counted pairs `(i, j)` where `report[i] == report[j]`. I initially tried to optimize by counting characters, but used the wrong formula.

**The fix**: Realized that for each character `c` appearing `f` times, there are `f²` pairs `(i, j)` where both indices point to `c`. So the total is `sum(freq(c)²)` for all characters `c`. One pass to count frequencies, then sum squares.

### Bug 5: Functions still accessing globals

**The problem**: After removing globals, some function calls still referenced `GLOBAL_RECORDS` or `GLOBAL_NORMALIZED`.

**The fix**: Updated all function signatures to take parameters and return values. Updated `main()` to pass data between functions explicitly.

### Bug 6: Missing parameter in function calls

**The problem**: After changing function signatures, forgot to update some call sites to pass the new parameters.

**The fix**: Systematically went through `main()` and all test code to ensure all function calls match the new signatures.

### Bug 7: Output format changed

**The problem**: During optimization, accidentally changed the output format slightly (extra spaces, different line endings).

**The fix**: Carefully compared output character-by-character with the original. Used the test suite's `compute_expected_console_output()` function as the golden reference.


## Resources

- Big-O notation and algorithmic complexity: Understanding why nested loops cause quadratic behavior
- Python string building best practices: Why `str.join()` is more efficient than concatenation
- Functional programming concepts: How pure functions improve testability and maintainability
- Python standard library documentation: Using only built-in functions and data structures
