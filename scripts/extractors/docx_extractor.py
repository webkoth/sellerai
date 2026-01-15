"""
DOCX Extractor for Course Materials

Extracts text content from Word documents (checklists, guides, instructions).
"""

from pathlib import Path


def extract_docx(file_path: Path) -> str:
    """
    Extract text content from a DOCX file.

    Args:
        file_path: Path to the DOCX file

    Returns:
        Extracted text content as markdown string
    """
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = Document(file_path)
    content_parts = []

    for element in doc.element.body:
        # Check if it's a paragraph
        if element.tag.endswith('p'):
            para = Paragraph(element, doc)
            text = para.text.strip()
            if text:
                # Detect headings by style
                style_name = para.style.name if para.style else ""
                if 'Heading' in style_name or 'heading' in style_name.lower():
                    level = 1
                    if '1' in style_name:
                        level = 1
                    elif '2' in style_name:
                        level = 2
                    elif '3' in style_name:
                        level = 3
                    content_parts.append(f"{'#' * level} {text}")
                else:
                    content_parts.append(text)

        # Check if it's a table
        elif element.tag.endswith('tbl'):
            table = Table(element, doc)
            table_md = format_table_as_markdown(table)
            if table_md:
                content_parts.append(f"\n{table_md}\n")

    return "\n\n".join(content_parts)


def format_table_as_markdown(table) -> str:
    """Convert Word table to markdown format."""
    rows = []

    for row in table.rows:
        cells = [cell.text.replace('\n', ' ').strip() for cell in row.cells]
        rows.append(cells)

    if not rows:
        return ""

    # Deduplicate merged cells (Word reports merged cells multiple times)
    cleaned_rows = []
    for row in rows:
        cleaned_row = []
        prev_cell = None
        for cell in row:
            if cell != prev_cell:
                cleaned_row.append(cell)
                prev_cell = cell
        cleaned_rows.append(cleaned_row)

    if not cleaned_rows or not cleaned_rows[0]:
        return ""

    # Build markdown table
    lines = []
    max_cols = max(len(row) for row in cleaned_rows)

    # Header
    header = cleaned_rows[0]
    while len(header) < max_cols:
        header.append("")
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")

    # Data rows
    for row in cleaned_rows[1:]:
        while len(row) < max_cols:
            row.append("")
        lines.append("| " + " | ".join(row[:max_cols]) + " |")

    return "\n".join(lines)
