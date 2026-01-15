"""
PDF Extractor for Course Materials

Extracts text content from PDF files (presentations, guides, documents).
"""

from pathlib import Path


def extract_pdf(file_path: Path) -> str:
    """
    Extract text content from a PDF file.

    Args:
        file_path: Path to the PDF file

    Returns:
        Extracted text content as string
    """
    import pdfplumber

    text_parts = []

    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            # Extract text
            text = page.extract_text()
            if text:
                text_parts.append(f"### Page {i}\n\n{text}")

            # Extract tables
            tables = page.extract_tables()
            for j, table in enumerate(tables, 1):
                if table:
                    table_md = format_table_as_markdown(table)
                    if table_md:
                        text_parts.append(f"\n**Table {j} (Page {i}):**\n\n{table_md}")

    return "\n\n".join(text_parts)


def format_table_as_markdown(table: list) -> str:
    """Convert extracted table to markdown format."""
    if not table or not table[0]:
        return ""

    # Clean cells
    cleaned = []
    for row in table:
        cleaned_row = [str(cell).replace('\n', ' ').strip() if cell else '' for cell in row]
        cleaned.append(cleaned_row)

    if not cleaned:
        return ""

    # Build markdown table
    lines = []

    # Header
    header = cleaned[0]
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")

    # Data rows
    for row in cleaned[1:]:
        # Pad row if needed
        while len(row) < len(header):
            row.append("")
        lines.append("| " + " | ".join(row[:len(header)]) + " |")

    return "\n".join(lines)
