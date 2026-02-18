import os
import sys
import pytest
import importlib.util

parser_dir = os.environ.get("PARSER_PATH")
if not parser_dir:
    raise RuntimeError("PARSER_PATH environment variable not set")
parser_path = os.path.join(parser_dir, "parser.py")
if not os.path.isfile(parser_path):
    raise FileNotFoundError(f"PARSER_PATH does not exist: {parser_path}")

spec = importlib.util.spec_from_file_location("parse_markdown", parser_path)
parse_module = importlib.util.module_from_spec(spec)
sys.modules["parse_markdown"] = parse_module
spec.loader.exec_module(parse_module)
parse_markdown = parse_module.parse_markdown

def test_empty_input():
    assert parse_markdown("") == ""
    assert parse_markdown("   \n  ") == ""


def test_headings():
    md = "# H1\n## H2 ##\n### H3 ###\n#### H4\n##### H5\n###### H6"
    html = parse_markdown(md)
    assert "<h1>H1</h1>" in html
    assert "<h2>H2</h2>" in html
    assert "<h3>H3</h3>" in html
    assert "<h4>H4</h4>" in html
    assert "<h5>H5</h5>" in html
    assert "<h6>H6</h6>" in html


def test_paragraph_merging():
    md = "Line one\nLine two\n\nLine three"
    html = parse_markdown(md)
    assert "<p>Line one Line two</p>" in html
    assert "<p>Line three</p>" in html


def test_bold_and_italic():
    md = "**bold** *italic* __bold2__ _italic2_"
    html = parse_markdown(md)
    assert "<strong>bold</strong>" in html
    assert "<em>italic</em>" in html
    assert "<strong>bold2</strong>" in html
    assert "<em>italic2</em>" in html


def test_unclosed_formatting_literal():
    md = "**bold *italic"
    html = parse_markdown(md)
    assert "**bold *italic" in html


def test_inline_code():
    md = "`<script>`"
    html = parse_markdown(md)
    assert "<code>&lt;script&gt;</code>" in html


def test_code_block_no_parsing():
    md = """```python
**not bold**
<script>
```"""
    html = parse_markdown(md)
    assert "<strong>" not in html
    assert "&lt;script&gt;" in html


def test_unclosed_code_block_literal():
    """Unclosed ``` renders as literal text, not code block."""
    md = """```python
**not bold**"""
    html = parse_markdown(md)
    assert "<pre><code" not in html
    assert "```" in html and "<p>" in html


def test_safe_link():
    md = "[ok](https://example.com)"
    html = parse_markdown(md)
    assert '<a href="https://example.com">ok</a>' in html


def test_block_javascript_link():
    md = "[bad](javascript:alert(1))"
    html = parse_markdown(md)
    assert "<a" not in html
    assert "bad" in html


def test_unordered_list_with_nested():
    """Nested lists must be inside parent <li> tag, not as siblings."""
    md = "- a\n- b\n- c \n  - nested1\n  - nested2"
    html = parse_markdown(md)
    assert "<ul>" in html
    assert html.count("<li>") == 5
    # Nested list must be inside parent <li> for valid HTML
    # Verify nested list is INSIDE parent <li>, not after </li>
    assert "<li>c <ul><li>nested1</li><li>nested2</li></ul></li>" in html
    # Ensure we don't have invalid nesting like </li><ul> (nested list as sibling)
    assert "</li><ul>" not in html.replace(" ", "").replace("\n", "")
    assert "<li>nested1</li>" in html


def test_ordered_list_with_nested():
    """Nested lists must be inside parent <li> tag, not as siblings."""
    md = "1. a\n2. b\n3. c \n   1. nested1\n   2. nested2"
    html = parse_markdown(md)
    assert "<ol>" in html
    assert html.count("<li>") == 5
    # Nested list must be inside parent <li> for valid HTML
    assert "<li>c <ol><li>nested1</li><li>nested2</li></ol></li>" in html
    # Ensure we don't have invalid nesting like </li><ol> (nested list as sibling)
    assert "</li><ol>" not in html.replace(" ", "").replace("\n", "")
    assert "<li>nested1</li>" in html

def test_list_type_change_at_same_indent():
    """Switching from ul to ol at same indent closes previous list before opening new one."""
    md = "- a\n1. b"
    html = parse_markdown(md)
    # Previous list must be closed
    assert "</ul>" in html
    # New list must be opened
    assert "<ol>" in html
    # Verify proper structure: </ul> comes before <ol>
    ul_pos = html.find("</ul>")
    ol_pos = html.find("<ol>")
    assert ul_pos < ol_pos, "Previous list must be closed before opening new list"
    assert "<li>a</li>" in html
    assert "<li>b</li>" in html


def test_ordered_unordered_list():
    """Nested lists must be inside parent <li> tag, not as siblings."""
    md = "1. a\n2. b\n3. c \n   - nested1\n   - nested2"
    html = parse_markdown(md)
    assert "<ol>" in html
    assert "<ul>" in html
    assert html.count("<li>") == 5
    # Nested list must be inside parent <li> for valid HTML
    assert "<li>c <ul><li>nested1</li><li>nested2</li></ul></li>" in html
    # Ensure we don't have invalid nesting like </li><ul> (nested list as sibling)
    assert "</li><ul>" not in html.replace(" ", "").replace("\n", "")
    assert "<li>nested1</li>" in html


def test_horizontal_rule_not_implemented():
    """Horizontal rules are out of scope. ---, ***, ___ are rendered as paragraph text, never as <hr>."""
    # Test ---
    md1 = "before\n\n---\n\nafter"
    html1 = parse_markdown(md1)
    assert "<hr>" not in html1
    assert "<p>---</p>" in html1
    
    # Test ***
    md2 = "before\n\n***\n\nafter"
    html2 = parse_markdown(md2)
    assert "<hr>" not in html2
    assert "<p>***</p>" in html2
    
    # Test ___
    md3 = "before\n\n___\n\nafter"
    html3 = parse_markdown(md3)
    assert "<hr>" not in html3
    assert "<p>___</p>" in html3


def test_html_escaping():
    md = "<b>x</b>"
    html = parse_markdown(md)
    assert "&lt;b&gt;x&lt;/b&gt;" in html


def test_large_input_no_crash():
    md = "word " * 50000
    html = parse_markdown(md)
    assert "<p>" in html

def test_inline_formatting():
    md = "*italic **bold inside italic** more italic* and **bold *italic inside bold* more bold**"
    html = parse_markdown(md)
    print("inline formatting html:", html)
    assert "<em>italic <strong>bold inside italic</strong> more italic</em>" in html
    assert "<strong>bold <em>italic inside bold</em> more bold</strong>" in html

def test_inline_format_in_paragraph():
    md = "This is a paragraph with **bold** and *italic* text."
    html = parse_markdown(md)
    assert "<p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>" in html   