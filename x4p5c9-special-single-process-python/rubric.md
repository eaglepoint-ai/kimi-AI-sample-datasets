# Task Rubric: Single-Process Python Refactor & Optimization

**Task ID:** `X4P5C9`
**Category:** `Performance Optimization`

## 1. Objective

Refactor the provided deterministic, single-process Python script to preserve byte-identical console output while reducing algorithmic time complexity and memory overhead. The optimized implementation must use only the Python standard library, eliminate shared mutable globals, and cleanly separate data loading, processing, aggregation, reporting, and analysis into independently testable units.

## 2. Required Success Criteria

- Console output must be byte-identical to the original script (content, ordering, formatting).
- **Complexity targets:**
  - Load: $O(n)$
  - Normalize: $O(n)$ using `str.lower()` directly (no inner scan, no per-char concatenation)
  - Statistics: $O(n)$ single pass (no nested self-join)
  - Report generation: $O(n \cdot m)$ using `"".join(...)` or equivalent (no repeated concatenation)
  - Report analysis: $O(n)$ using frequency counting (no $O(n^2)$ double loop)
- Memory usage must scale linearly with input size; no redundant intermediate structures.
- No concurrency, no caching layers, no external frameworks; standard library only.
- Shared mutable globals must be eliminated; functions accept inputs and return outputs.
- Remove unused imports and all no-op loops or dead code.

## 3. Structural Constraints

- Clear separation of concerns with distinct functions for:
  - Data loading
  - Normalization
  - Aggregation/statistics
  - Report generation
  - Report analysis
- Each stage must be independently testable with no shared mutable state.
- All string assembly must use join-based techniques; no loop-based concatenation of strings.

## 4. Regression & Consistency Criteria

- For any fixed input dataset, the refactored output must match the original script exactly.
- Normalization must preserve semantic behavior while improving complexity (e.g., `name.lower()` semantics must match original output).
- Report analysis must compute the same character-pair counts as the original algorithm.
- Any refactor must not change record ordering, aggregation rules, or report formatting.

## 5. Failure Conditions

- Use of nested loops where $O(n)$ is required (e.g., normalization list scans, statistics self-join, analysis double loop).
- Any usage of repeated string concatenation in report generation.
- Introduction of global shared mutable state or hidden caches.
- Use of third-party libraries or non-standard-library modules.
- Any deviation in output bytes compared to the original script.

## 6. Evaluation Method

- Run original and refactored implementations on identical inputs and `assert output_bytes_equal`.
- Inspect the implementation to ensure no nested loops in the specified stages and that `join`-based assembly is used.
- Execute with large $n$ to confirm near-linear scaling and absence of quadratic growth.
- Validate each processing stage independently with controlled inputs and outputs.

## 7. Test Suite Requirements

A comprehensive test suite must:

- Verify byte-identical output across multiple datasets (including edge cases).
- Validate that no shared mutable globals are used (e.g., by checking module attributes and ensuring functions accept/return data).
- Test each stage in isolation: loading, normalization, aggregation, report generation, and analysis.
- Include at least one performance-oriented test that fails if quadratic growth is observed (e.g., time/operation-count thresholds).
- Run without external dependencies and pass with standard library tools only.
