# Task Rubric: Python Markdown to HTML Parser

**Task ID:** `07X20K`
**Category:** `New Feature Development`

## 1. Objective

Implement a robust Markdown-to-HTML parser in Python that adheres to strict implementation constraints (no regex, no external libraries). The parser must correctly handle block-level elements (headings, lists, code blocks, paragraphs) and inline-level elements (bold, italic, links, inline code) using a state-machine or recursive descent architecture.

## 2. Required Success Criteria

* The implementation must **not** import or use the `re` module. Parsing must be performed via character-by-character iteration or manual string splitting/scanning.
* Support `#` to `######` followed by a mandatory space. Trailing hashes must be stripped.
* Consecutive non-blank lines must be wrapped in `<p>` tags; blank lines act as delimiters.
* Triple backticks (`````) must trigger `<pre><code>` blocks. Support for an optional language class (e.g., `class="language-python"`) is required.
* Support `-`, `*`, and `+`.
* Support `1.` (and other numbers).
* Correctly handle list indentation to create nested `<ul>`/`<ol>` structures.
* Support bold (`**`, `__`) and italic (`*`, `_`). Must correctly distinguish between single and double delimiters.
* Single backticks (```) must wrap content in `<code>` tags.
* `[text](url)` syntax must convert to `<a href="url">text</a>`.
* Use `html.escape` (or manual equivalent) for all text content, especially inside code blocks and inline code.
* Explicitly reject/neutralize `javascript:` protocol links in the `href` attribute.
* Unclosed delimiters (e.g., a single `**` without a pair) must be rendered as literal text, not broken HTML.



## 3. Regression & Robustness Criteria

* Switching from a list context to a paragraph or code block context must close all open tags (`</ul>`, `</ol>`, etc.) in the correct order.
* The parser must handle varied spacing (e.g., multiple blank lines between paragraphs) without generating empty tags.
* The implementation should avoid deep recursion that could lead to a `RecursionError` on extremely long documents; a state-machine/iterative approach is preferred for block-level elements.

## 4. Structural Constraints

* Only `html` or `collections` (for deques/stacks) are permitted.
* The `parse_markdown` function and any helper classes must use Python type hints (`str`, `List`, `Optional`).
* The resulting HTML should not contain unnecessary whitespace or malformed nested tags (e.g., no `<p>` inside a `<p>`).

## 5. Failure Conditions (Automatic Rejection)

* Any use of the `re` module for tokenization or pattern matching.
* Use of `markdown`, `beautifulsoup`, or `mistune`.
* Allowing `<script>` tags to pass through unescaped or allowing `javascript:` URLs.
* Generating HTML like `<ul><li>...</ul></li>` (incorrect closing order).
* Crashing on a 1MB Markdown file due to inefficient string concatenation or recursive depth.

## 6. Evaluation Method

* Run a series of tests covering:
    1. Standard Markdown (Headings, Paragraphs).
    2. Nested Lists (3+ levels deep).
    3. Mixed Inline Styles (e.g., `**bold and _italic_**`).
    4. Escaping (e.g., `2 < 5` becomes `2 &lt; 5`).
* Provide a complex technical document string and verify the output against a "Golden Master" HTML file.
* Attempt to inject a `javascript:alert(1)` link and verify it is blocked or sanitized.
* Scan the source code for the string `import re` or `from re`.