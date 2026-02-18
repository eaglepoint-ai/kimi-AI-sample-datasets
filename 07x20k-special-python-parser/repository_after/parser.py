"""
Markdown to HTML parser.

Implements a character-by-character and line-by-line state machine approach
to convert Markdown to valid HTML. Supports headings, paragraphs, bold,
italic, inline code, code blocks, links, ordered/unordered lists, and
nested lists. HTML entities are escaped for XSS prevention. javascript:
URLs in links are rejected.
"""

from html import escape

MAX_INLINE_CHARS = 100_000


def parse_markdown(markdown: str) -> str:
    """Convert a Markdown string to HTML. Empty or whitespace-only input returns empty string."""
    if not markdown or markdown.strip() == "":
        return ""

    lines = markdown.splitlines()
    output = []
    i = 0
    n = len(lines)

    def parse_inline(text: str) -> str:
        if len(text) > MAX_INLINE_CHARS:
            return escape(text)

        result = []
        i = 0
        L = len(text)

        while i < L:
            ch = text[i]

            # Inline code: single backticks, content escaped
            if ch == "`":
                end = text.find("`", i + 1)
                if end != -1:
                    result.append("<code>" + escape(text[i + 1:end]) + "</code>")
                    i = end + 1
                else:
                    result.append(escape(ch))
                    i += 1

            # Bold (** or __)
            elif text.startswith("**", i) or text.startswith("__", i):
                delim = text[i:i + 2]
                end = text.find(delim, i + 2)
                if end != -1:
                    inner = text[i + 2:end]
                    result.append("<strong>" + parse_inline(inner) + "</strong>")
                    i = end + 2
                else:
                    result.append(escape(delim))
                    i += 2

            # Italic (* or _)
            elif ch in ("*", "_"):
                if i+1 < L and text[i + 1] == ch:
                    result.append(escape(ch * 2))
                    i += 2
                    continue

                end = i + 1
                while True:
                    end = text.find(ch, end)
                    if end == -1:
                        break
                    if not (end + 1 < L and text[end + 1] == ch):
                        break
                    end += 2

                if end != -1:
                    inner = text[i + 1:end]
                    result.append("<em>" + parse_inline(inner) + "</em>")
                    i = end + 1
                else:
                    result.append(escape(ch))
                    i += 1

            # Link [text](url); javascript: URLs rejected for XSS
            elif ch == "[":
                close_bracket = text.find("]", i + 1)
                if (
                    close_bracket != -1
                    and close_bracket + 1 < L
                    and text[close_bracket + 1] == "("
                ):
                    close_paren = text.find(")", close_bracket + 2)
                    if close_paren != -1:
                        label_text = text[i + 1:close_bracket]
                        url = text[close_bracket + 2:close_paren].strip()
                        if not url.lower().startswith("javascript:"):
                            result.append(
                                f'<a href="{escape(url, quote=True)}">{parse_inline(label_text)}</a>'
                            )
                        else:
                            result.append(parse_inline(label_text))
                        i = close_paren + 1
                        continue
                result.append(escape(ch))
                i += 1

            else:
                result.append(escape(ch))
                i += 1

        return "".join(result)

    def is_list_line(s: str) -> bool:
        """Check if stripped line is a list item (-, *, +, or number. )."""
        if not s:
            return False
        if s.startswith(("- ", "* ", "+ ")):
            return True
        j = 0
        while j < len(s) and s[j].isdigit():
            j += 1
        return j > 0 and j < len(s) and s[j] == "." and s[j + 1:j + 2] == " "

    # List parsing: nested lists inside parent <li>, stack-based, avoids stack overflow
    def parse_list(start: int, base_indent: int):
        html = []
        i = start
        n = len(lines)
        stack = []

        while i < n:
            line = lines[i]
            if not line.strip():
                break

            indent = len(line) - len(line.lstrip(" "))
            stripped = line.lstrip(" ")

            if stripped.startswith(("- ", "* ", "+ ")):
                ltype = "ul"
                content = stripped[2:]
            else:
                j = 0
                while j < len(stripped) and stripped[j].isdigit():
                    j += 1
                if j > 0 and j < len(stripped) and stripped[j] == "." and stripped[j + 1:j + 2] == " ":
                    ltype = "ol"
                    content = stripped[j + 2:]
                else:
                    break

            # Close lists when dedenting or when list type changes at same indent
            while stack and (indent < stack[-1][1] or (indent == stack[-1][1] and ltype != stack[-1][0])):
                html.append(f"</{stack.pop()[0]}>")

            if not stack or ltype != stack[-1][0] or indent > stack[-1][1]:
                html.append(f"<{ltype}>")
                stack.append((ltype, indent))

            # Check if next line is nested (indent > current) - nest inside this <li>
            next_i = i + 1
            has_nested = False
            if next_i < n and line.strip():
                next_line = lines[next_i]
                next_indent = len(next_line) - len(next_line.lstrip(" "))
                next_stripped = next_line.lstrip(" ")
                if next_indent > indent and is_list_line(next_stripped):
                    has_nested = True

            if has_nested:
                html.append(f"<li>{parse_inline(content)}")
                nested_html, new_i = parse_list(next_i, next_indent)
                html.append(nested_html)
                html.append("</li>")
                i = new_i
            else:
                html.append(f"<li>{parse_inline(content)}</li>")
                i += 1

        while stack:
            html.append(f"</{stack.pop()[0]}>")

        return "".join(html), i

    # Main block parser
    while i < n:
        line = lines[i]

        # Code block: triple backticks; unclosed delimiters render as literal text
        if line.startswith("```"):
            close_idx = -1
            for j in range(i + 1, n):
                if lines[j].startswith("```"):
                    close_idx = j
                    break
            if close_idx == -1:
                # No closing ``` - render as literal text (unclosed delimiter)
                output.append(f"<p>{escape(line)}</p>")
                i += 1
                continue
            lang = line[3:].strip()
            i += 1
            code = []
            while i < close_idx:
                code.append(escape(lines[i]))
                i += 1
            i = close_idx + 1
            class_attr = f' class="language-{escape(lang)}"' if lang else ""
            output.append(
                "<pre><code" + class_attr + ">\n" +
                "\n".join(code) +
                "\n</code></pre>"
            )
            continue

        # Headings h1-h6: 1-6 hashes, space, text, optional trailing hashes stripped
        stripped = line.lstrip()
        hashes = 0
        while hashes < len(stripped) and stripped[hashes] == "#":
            hashes += 1
        if 1 <= hashes <= 6 and stripped[hashes:hashes + 1] == " ":
            text = stripped[hashes + 1:].rstrip("# ").strip()
            output.append(f"<h{hashes}>{parse_inline(text)}</h{hashes}>")
            i += 1
            continue

        # Lists: unordered (-, *, +) or ordered (number. ), with nested support via indent
        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)
        if stripped.startswith(("- ", "* ", "+ ")) or (
            stripped and stripped[0].isdigit() and "." in stripped
        ):
            html, i = parse_list(i, indent)
            output.append(html)
            continue

        # Paragraph: consecutive non-blank lines joined with space
        if line.strip():
            para = [line.strip()]
            i += 1
            while i < n and lines[i].strip():
                para.append(lines[i].strip())
                i += 1
            output.append(f"<p>{parse_inline(' '.join(para))}</p>")
            continue

        i += 1

    return "\n".join(output)