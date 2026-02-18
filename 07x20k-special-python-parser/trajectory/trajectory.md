# Trajectory: Lightweight Markdown Parser

## Problem Statement

The documentation site generator currently uses a third-party Markdown library that's approximately 500KB in size. This library includes many features that aren't actually used in the documentation, making it unnecessarily heavy. We need a lightweight replacement that handles only the specific Markdown syntax used in our documentation.

The parser must:
- Convert Markdown to valid HTML
- Support nested formatting (e.g., bold text inside links, italic inside bold)
- Prevent XSS attacks from user-provided content
- Have no external dependencies
- Handle headings, paragraphs, bold, italic, links, inline code, code blocks, and nested lists

## Goal

Build a minimal, custom Markdown parser that replaces the 500KB third-party library. The parser should be a single Python module with one public function: `parse_markdown(markdown: str) -> str` that converts Markdown strings to HTML strings.

## Strategy

### Strategy 1: Regex-based parsing

My first instinct was to use regular expressions for everything. I thought I could write patterns like `r'\*\*(.*?)\*\*'` for bold and `r'\[(.*?)\]\((.*?)\)'` for links.

**Why it failed:**
- Regex can't handle nested structures. When I tried `r'\*\*(.*?)\*\*'` for bold, it would match `**bold *italic* text**` incorrectly, treating the inner `*italic*` as the end of the bold match.
- Regex doesn't understand context. A `*` could be bold, italic, or literal depending on surrounding characters. I'd need lookahead/lookbehind assertions that became unreadable.
- Code blocks with triple backticks broke everything because regex couldn't distinguish between markdown syntax inside code blocks (which should be literal) vs. outside.

I gave up on this approach after spending hours trying to make nested patterns work.

### Strategy 2: Pre-splitting by blank lines

I thought I could simplify block parsing by splitting the input into blocks first:

```python
blocks = markdown.split("\n\n")
for block in blocks:
    if block.startswith("#"):
        # heading
    elif block.startswith("```"):
        # code block
    else:
        # paragraph
```

**Why it failed:**
- Code blocks can contain blank lines. When I split by `\n\n`, a code block like:
  ```
  ```
  def func():
      pass
  
  ```
  ```
  Would be split into multiple blocks, breaking the parser.
- Lists span multiple "blocks" when separated by blank lines, but they should still be part of the same list structure.
- I lost the ability to process line-by-line, which I needed for proper list nesting detection.

I realized I needed to process line-by-line and detect block types as I go, not pre-split.

### Strategy 3: Simple string replacement

Before understanding the complexity, I tried a naive approach:

```python
text = markdown.replace("**", "<strong>").replace("**", "</strong>")
```

**Why it failed:**
- This doesn't work at all. The second `replace("**", "</strong>")` replaces ALL `**`, including the opening ones I just converted.
- No handling of nested structures.
- No escaping of HTML entities.
- Links and other syntax completely broken.

This was clearly wrong from the start, but it helped me realize I needed a proper parsing approach.

### Strategy 4: Flat list parsing without nesting

I started with lists by just collecting all list items and wrapping them:

```python
items = []
for line in lines:
    if line.startswith("- "):
        items.append(f"<li>{line[2:]}</li>")
return f"<ul>{''.join(items)}</ul>"
```

**Why it failed:**
- No support for nested lists. When I encountered:
  ```
  - Item 1
    - Nested item
  ```
  The nested item was treated as a top-level item.
- No distinction between ordered and unordered lists at the same level.
- List items with multiple lines weren't handled.

I needed a stack-based approach to track nesting levels.

### Strategy 5: Inline parsing without recursion

I tried parsing inline elements in a single pass without recursion:

```python
# Parse bold first
text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
# Then italic
text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
```

**Why it failed:**

I realized I needed recursive parsing where each inline element can contain other inline elements.

## Correct Approach

After the failed attempts, I settled on a two-phase parsing approach: block-level parsing (line-by-line) followed by inline parsing (character-by-character with recursion).

### Phase 1: Block Parsing (Line-by-Line State Machine)

The key insight is to process the input line-by-line and classify each line as a specific block type (heading, code block, list, paragraph). This allows me to handle code blocks that span multiple lines and contain blank lines.

**Why this works:**
- Code blocks are detected by a starting ` ``` ` line, then I scan forward line-by-line until I find the closing ` ``` `. This naturally handles blank lines inside code blocks.
- Lists are detected by checking line prefixes (`- `, `* `, `+ `, or `number. `), and I can track indentation to determine nesting.
- Headings are single-line, so they're straightforward once I check for the correct pattern.
- Paragraphs are everything else that's not empty, and consecutive non-empty lines form a single paragraph.

**Implementation details:**

1. **Code blocks**: When I encounter a line starting with ` ``` `, I search forward through the lines array until I find another line starting with ` ``` `. If no closing is found, I treat it as literal text (unclosed delimiter). The content between is escaped but not parsed for inline markdown.

2. **Headings**: I count leading `#` characters (1-6), verify there's a space after them, then extract the text and strip trailing `#` characters. The heading text is then passed to inline parsing to handle any formatting within.

3. **Lists**: I detect list items by checking if a stripped line starts with list markers (`- `, `* `, `+ ` for unordered lists, or `number. ` for ordered lists). When I encounter a list, I delegate to a separate `parse_list()` function that handles the intricate logic of nesting, indentation, and list type transitions. For ordered lists, the actual numbers in the Markdown (e.g., `1.`, `5.`, `10.`) don't need to match the output numbering—the HTML `<ol>` tag handles sequential numbering automatically.

4. **Paragraphs**: Consecutive non-empty lines that aren't other block types are collected and joined with spaces, then wrapped in `<p>` tags. This ensures that multi-line paragraphs are treated as single units.

### Phase 2: Inline Parsing (Character-by-Character with Recursion)

For inline elements, I scan character-by-character, giving me precise control over parsing order and enabling recursive handling of nested structures.

**Why this works:**

Character-by-character scanning allows me to peek at the next character before making decisions. When I encounter `*`, I can check if the next character is also `*` to distinguish bold from italic. Recursive parsing handles nesting elegantly: when I encounter `**bold *italic* text**`, I parse the bold delimiter, then recursively call `parse_inline()` on the inner content, which naturally finds and parses the italic. The order of checks is critical: I check for inline code first (backticks), then bold (`**` or `__`), then italic (`*` or `_`), then links. This prevents conflicts and ensures correct parsing.

**Implementation details:**

1. **Inline code**: Checked first to prevent Markdown interpretation inside code. When I find a backtick, I search for the next backtick. The content is escaped but not parsed further, ensuring that Markdown syntax inside code blocks remains literal.

2. **Bold**: Checked before italic to prevent conflicts. I look for `**` or `__`, find the matching closing delimiter, then recursively parse the inner content with `parse_inline()`. This allows bold text to contain italic, links, or other inline elements. Bold formatting applies within a single line only—the delimiters must be on the same line for the formatting to be recognized.

3. **Italic**: After verifying it's not part of `**`, I look for a single `*` or `_`. The challenge is finding the closing delimiter while skipping over `**` sequences. I use a loop that finds the next `*` or `_` and checks if it's followed by another one (which would indicate bold, not italic).

4. **Links**: I look for `[`, find the matching `]`, verify the next character is `(`, then find the matching `)`. The URL is checked for `javascript:` to prevent XSS attacks, and the link text is recursively parsed for inline elements, allowing formatted links.

5. **Recursion**: Each inline element that contains text (bold, italic, links) calls `parse_inline()` recursively on its inner content. This naturally handles arbitrary nesting like `**[link *text*](url)**` without additional complexity.

### List Nesting: Stack-Based Approach

Lists were by far the most challenging aspect. The solution is a stack-based approach that tracks open list tags and their indentation levels.

**Why this works:**

The stack `[(list_type, indent_level), ...]` maintains the state of currently open lists. When I encounter a list item, I follow a precise sequence:
1. Close any lists on the stack that have greater indent (we're dedenting) or different type at the same indent level.
2. If no matching list is open, open a new one and push it to the stack.
3. Check if the next line is a nested list (greater indent). If so, recursively parse it and include it inside the current `<li>` before closing it.

**The key insight**: Nested lists belong *inside* the parent `<li>` tag, not as siblings. When I detect a nested list, I:
- Open the `<li>` tag with the item content
- Recursively call `parse_list()` for the nested content
- Close the `</li>` tag

This produces the correct HTML structure:
```html
<li>Item text
  <ul>
    <li>Nested</li>
  </ul>
</li>
```

### XSS Prevention

All user text is escaped using `html.escape()`. For link URLs, I use `escape(url, quote=True)` to properly escape characters in HTML attributes. I also explicitly reject `javascript:` URLs by checking `url.lower().startswith("javascript:")` and rendering the link text without a link tag if found.

### Edge Cases Handled

1. **Empty input**: Returns empty string
2. **Whitespace-only input**: Returns empty string
3. **Unclosed code blocks**: Treated as literal text (paragraph)
4. **Unclosed inline elements**: Treated as literal characters
5. **Mixed list types at same indent**: Separate lists (correctly closed when type changes)
6. **Deeply nested or very long inline content**: `MAX_INLINE_CHARS` limit prevents stack overflow
7. **Headings with trailing hashes**: Stripped correctly
8. **Links with whitespace in URL**: Stripped before processing

## Bugs Encountered and Fixed

### Bug 1: IndexError in italic parsing

I was checking `text[i+1]` without verifying `i+1 < len(text)`. This crashed on input ending with `*`.

**Fix**: Added bounds checking: `if i+1 < L and text[i + 1] == ch`

### Bug 2: Bold parsed as italic

When I checked for italic before bold, `**bold**` was parsed as italic starting at the first `*`.

**Fix**: Reordered checks to handle `**` before `*`

### Bug 3: Lists closing too early

I was only closing lists when indent decreased, but I also needed to close when list type changed at the same indent level.

**Fix**: Changed condition to `indent < stack[-1][1] or (indent == stack[-1][1] and ltype != stack[-1][0])`

### Bug 4: Nested lists not inside `<li>`

I was closing the `<li>` tag before parsing nested content, producing invalid HTML.

**Fix**: Restructured to detect nested lists first, then open `<li>`, parse nested content, then close `</li>`

### Bug 5: Paragraphs split incorrectly

Multiple consecutive lines were being treated as separate paragraphs instead of one paragraph.

**Fix**: Collect consecutive non-empty lines and join with spaces before wrapping in `<p>`

### Bug 6: Link URL not stripped

Whitespace in URLs like `[text]( url )` wasn't being handled.

**Fix**: Added `.strip()` when extracting URL: `url = text[close_bracket + 2:close_paren].strip()`

### Bug 7: Code block language not escaped

The language identifier in code blocks wasn't escaped, allowing XSS.

**Fix**: Escaped language when building class attribute: `class="language-{escape(lang)}"`

### Bug 8: Heading trailing hashes not stripped

Headings like `## Heading ##` kept the trailing hashes.

**Fix**: Added `.rstrip("# ").strip()` when extracting heading text


## Resources

- Python `html.escape` documentation for proper HTML entity escaping
- Markdown syntax reference for understanding the specification
- Recursive descent parsing pattern for handling nested structures
