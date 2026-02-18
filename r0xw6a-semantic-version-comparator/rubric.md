# Task Rubric: Semantic Version Comparator

**Task ID:** `R0XW6A`
**Category:** `Code Testing`

## 1. Objective

Implement a deterministic semantic version comparator that matches the existing, pinned behavior in tests. The comparator must parse and compare version strings using only the Go standard library, remain panic-free for invalid inputs, and produce consistent results across a wide range of edge cases.

## 2. Required Success Criteria

- `Compare(a, b)` returns `-1`, `0`, or `1` based on ordering of the parsed versions.
- Leading/trailing whitespace is ignored (`strings.TrimSpace`).
- Any prerelease suffix (substring after the first `-`) is stripped before parsing.
- **Parsing rules:**
  - Split on `.` into components.
  - For each component, parse digits only; non-digits are ignored.
  - Empty components parse as `0` (e.g., `"1..2" -> [1,0,2]`).
  - A `v` prefix (e.g., `"v1.2.3"`) is treated as non-digit and therefore ignored during parsing.
- **Comparison rules:**
  - Compare at most the first 3 components.
  - Comparison loop length is `min(3, len(partsA), len(partsB))`.
  - Only shared components are compared; extra components beyond the loop are ignored.
  - Missing components are effectively treated as zero for equality under the shared limit (e.g., `"1"` equals `"1.0.0"`).
- No panics; invalid or empty inputs must safely return a result.

## 3. Regression & Consistency Criteria

- Output must match the provided test cases exactly, including:
  - `"01.002.0003" == "1.2.3"`
  - `"1.2.3.9" == "1.2.3"` and `"1.2.3" == "1.2.3.999"`
  - `"." == ""` (no panic, equality under shared comparison limit)
- Behavior must be deterministic for identical inputs.
- No third‑party packages.

## 4. Structural Constraints

- Exported API must be `Compare(a, b string) int` in package `semver`.
- Implementation must be readable and maintainable; keep parsing and comparison logic clearly separated.
- No panics must escape `Compare` under any input.

## 5. Failure Conditions

- Panics on empty or malformed inputs.
- Comparing prerelease identifiers instead of stripping them.
- Using full semver libraries or external dependencies.
- Changing comparison semantics for extra components or missing components beyond the shared limit.
- Deviations from expected return values for the pinned test cases.

## 6. Evaluation Method

- Run the provided test suite; all tests in `tests/` and `repository_after/semver_test.go` must pass.
- Meta-tests must fail on known mutants and pass on the correct implementation.
- Spot-check edge cases listed in the tests to ensure byte-for-byte parity in results.
