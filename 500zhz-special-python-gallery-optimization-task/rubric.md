# Task Rubric: Image Gallery Pagination Optimization

**Task ID:** `500ZHZ`
**Category:** `Performance Optimization`

## 1. Objective

Refactor the `get_paginated_images` function to move from an $O(N)$ retrieval model (where $N$ is total dataset size) to an $O(K)$ model (where $K$ is page size). The solution must utilize efficient data structures to ensure scalability while maintaining perfect behavioral transparency.

## 2. Required Success Criteria

- After any necessary initialization, the retrieval of a single page must execute in $O(K)$ time. Total collection size $N$ must not affect request latency.
- The implementation must utilize an internal index to ensure that filtering by `album_id` does not involve scanning records from other albums.
- The implementation must maintain deterministic ordering, specifically handling duplicate timestamps by using a secondary sort key if necessary to match the original implementation's behavior.
- The function must avoid creating intermediate full-list copies or materializing the entire filtered dataset. It should use slicing on pre-computed sequences or generators to return only the requested window.
- The public API of `get_paginated_images` must remain unchanged (same parameters, same return type).
- Return an empty list for out-of-range pages.
- Raise `ValueError` for `page < 1`.
- Correctly return all images when `album_id` is `None` or empty.

## 3. Regression & Consistency Criteria

- For any given seed dataset, the output of the optimized function must be bit-for-bit identical to the original $O(N)$  implementation (ordering, metadata keys, and values).
- No use of `pandas`, `numpy`, or other external performance libraries. The solution must rely on Python’s `bisect`, `collections`, or native `dict`/`list` optimizations.
- The internal index must be updated in a way that doesn't trigger a full $O(N \log N)$ re-sort on every request.

## 4. Structural Constraints

- All new or refactored methods must include full Python type hints.
- Code must pass linting for indentation, naming conventions (snake_case), and docstring standards.
- Internal comments must explicitly explain the memory optimization strategy and the choice of data structures for the index.

## 5. Failure Conditions

- Calling `sorted()` or `list(filter())` inside the `get_paginated_images` call.
- Any deviation in image order compared to the baseline implementation.
- Converting a large generator into a full list before slicing it.
- Using fixed page sizes or assuming a specific number of albums.

## 6. Evaluation Method

- Run a test with $N=1,000,000$ records. The request time for page 1 should be nearly identical to the request time for page 50,000.
- A dedicated test suite must run the original function and the optimized function against the same dataset and `assert original_output == optimized_output`.
- Inspect the initialization logic. Verify that album-specific lookups use a dictionary/hash-map rather than a loop-based filter.
