#!/usr/bin/env python3
"""
Course Parser for SellerAI

Extracts knowledge from marketplace courses (PDF, DOCX, XLSX)
and outputs structured markdown for creating Skills.

Usage:
    python scripts/parse_courses.py --course "X11club" --topic "unit-economics"
    python scripts/parse_courses.py --file "path/to/file.pdf"
    python scripts/parse_courses.py --scan  # List all parseable files
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.extractors.pdf_extractor import extract_pdf
from scripts.extractors.docx_extractor import extract_docx
from scripts.extractors.xlsx_extractor import extract_xlsx


# Курсы перенесены в отдельную директорию (~/sellerai-courses)
# для уменьшения размера git репозитория
COURSES_DIR = Path.home() / "sellerai-courses"
OUTPUT_DIR = PROJECT_ROOT / "scripts" / "output" / "extracted"


def get_extractor(file_path: Path):
    """Get appropriate extractor based on file extension."""
    suffix = file_path.suffix.lower()
    extractors = {
        '.pdf': extract_pdf,
        '.docx': extract_docx,
        '.xlsx': extract_xlsx,
    }
    return extractors.get(suffix)


def scan_courses() -> dict:
    """Scan courses directory and return file statistics."""
    stats = {
        'courses': {},
        'totals': {'pdf': 0, 'docx': 0, 'xlsx': 0, 'total': 0}
    }

    for course_dir in COURSES_DIR.iterdir():
        if not course_dir.is_dir():
            continue

        course_name = course_dir.name
        stats['courses'][course_name] = {'pdf': 0, 'docx': 0, 'xlsx': 0, 'files': []}

        for file_path in course_dir.rglob('*'):
            if file_path.is_file():
                suffix = file_path.suffix.lower()
                if suffix == '.pdf':
                    stats['courses'][course_name]['pdf'] += 1
                    stats['totals']['pdf'] += 1
                elif suffix == '.docx':
                    stats['courses'][course_name]['docx'] += 1
                    stats['totals']['docx'] += 1
                elif suffix == '.xlsx':
                    stats['courses'][course_name]['xlsx'] += 1
                    stats['totals']['xlsx'] += 1

                if suffix in ['.pdf', '.docx', '.xlsx']:
                    stats['courses'][course_name]['files'].append(str(file_path.relative_to(COURSES_DIR)))
                    stats['totals']['total'] += 1

    return stats


def find_files_by_topic(topic: str, course_filter: Optional[str] = None) -> list:
    """Find files related to a specific topic."""
    topic_keywords = {
        'unit-economics': ['юнит', 'unit', 'экономик', 'маржа', 'margin', 'себестоим'],
        'sales-funnel': ['воронк', 'funnel', 'конверс', 'conversion'],
        'seo': ['seo', 'сео', 'семантик', 'ключев', 'keyword'],
        'advertising': ['реклам', 'advert', 'продвиж', 'promo', 'ctr', 'ставк'],
        'reviews': ['отзыв', 'review', 'вопрос', 'обратн'],
        'competitors': ['конкурент', 'competitor', 'анализ'],
    }

    keywords = topic_keywords.get(topic, [topic])
    found_files = []

    search_dir = COURSES_DIR
    if course_filter:
        # Find matching course directory
        for course_dir in COURSES_DIR.iterdir():
            if course_filter.lower() in course_dir.name.lower():
                search_dir = course_dir
                break

    for file_path in search_dir.rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in ['.pdf', '.docx', '.xlsx']:
            file_name_lower = file_path.name.lower()
            parent_path_lower = str(file_path.parent).lower()

            for keyword in keywords:
                if keyword.lower() in file_name_lower or keyword.lower() in parent_path_lower:
                    found_files.append(file_path)
                    break

    return found_files


def extract_file(file_path: Path) -> dict:
    """Extract content from a single file."""
    extractor = get_extractor(file_path)
    if not extractor:
        return {'error': f'No extractor for {file_path.suffix}'}

    try:
        content = extractor(file_path)
        return {
            'file': str(file_path),
            'type': file_path.suffix[1:].upper(),
            'content': content,
            'success': True
        }
    except Exception as e:
        return {
            'file': str(file_path),
            'error': str(e),
            'success': False
        }


def format_as_skill_knowledge(extracted_data: list, topic: str) -> str:
    """Format extracted data as skill knowledge markdown."""
    output = []
    output.append(f"# Extracted Knowledge: {topic}\n")
    output.append(f"> Auto-generated from {len(extracted_data)} source files\n")
    output.append("---\n")

    for item in extracted_data:
        if not item.get('success'):
            continue

        file_path = Path(item['file'])
        relative_path = file_path.relative_to(PROJECT_ROOT) if PROJECT_ROOT in file_path.parents else file_path

        output.append(f"\n## Source: {file_path.name}\n")
        output.append(f"**Path:** `{relative_path}`\n")
        output.append(f"**Type:** {item['type']}\n\n")

        content = item['content']

        if isinstance(content, dict):
            # XLSX with sheets
            if 'sheets' in content:
                for sheet_name, sheet_data in content['sheets'].items():
                    output.append(f"### Sheet: {sheet_name}\n")
                    if isinstance(sheet_data, list) and sheet_data:
                        # Format as table
                        if isinstance(sheet_data[0], dict):
                            headers = list(sheet_data[0].keys())
                            output.append("| " + " | ".join(str(h) for h in headers) + " |")
                            output.append("| " + " | ".join("---" for _ in headers) + " |")
                            for row in sheet_data[:20]:  # Limit rows
                                output.append("| " + " | ".join(str(row.get(h, '')) for h in headers) + " |")
                        output.append("")
            else:
                # Generic dict
                for key, value in content.items():
                    output.append(f"### {key}\n")
                    output.append(f"{value}\n")
        elif isinstance(content, str):
            # Text content (PDF, DOCX)
            # Truncate if too long
            if len(content) > 10000:
                output.append(content[:10000])
                output.append("\n\n*[Content truncated...]*\n")
            else:
                output.append(content)
        elif isinstance(content, list):
            for item_content in content:
                output.append(f"- {item_content}\n")

        output.append("\n---\n")

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(description='Parse marketplace courses for knowledge extraction')
    parser.add_argument('--scan', action='store_true', help='Scan and list all parseable files')
    parser.add_argument('--file', type=str, help='Parse a specific file')
    parser.add_argument('--topic', type=str, help='Topic to search for (unit-economics, seo, advertising, etc.)')
    parser.add_argument('--course', type=str, help='Filter by course name')
    parser.add_argument('--output', type=str, help='Output file path')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown', help='Output format')

    args = parser.parse_args()

    if args.scan:
        stats = scan_courses()
        print("\n=== Course Files Statistics ===\n")
        for course_name, course_stats in stats['courses'].items():
            print(f"{course_name[:60]}...")
            print(f"  PDF: {course_stats['pdf']}, DOCX: {course_stats['docx']}, XLSX: {course_stats['xlsx']}")
        print(f"\n=== Totals ===")
        print(f"PDF: {stats['totals']['pdf']}, DOCX: {stats['totals']['docx']}, XLSX: {stats['totals']['xlsx']}")
        print(f"Total parseable files: {stats['totals']['total']}")
        return

    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found: {args.file}")
            sys.exit(1)

        result = extract_file(file_path)

        if args.format == 'json':
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            if result.get('success'):
                print(f"# Extracted from: {file_path.name}\n")
                content = result['content']
                if isinstance(content, str):
                    print(content)
                else:
                    print(json.dumps(content, indent=2, ensure_ascii=False))
            else:
                print(f"Error: {result.get('error')}")
        return

    if args.topic:
        files = find_files_by_topic(args.topic, args.course)

        if not files:
            print(f"No files found for topic: {args.topic}")
            sys.exit(1)

        print(f"Found {len(files)} files for topic '{args.topic}':\n")
        for f in files:
            print(f"  - {f.name}")
        print()

        # Extract all files
        extracted = []
        for file_path in files:
            print(f"Extracting: {file_path.name}...", end=" ")
            result = extract_file(file_path)
            if result.get('success'):
                print("OK")
                extracted.append(result)
            else:
                print(f"FAILED: {result.get('error')}")

        # Format output
        if args.format == 'json':
            output = json.dumps(extracted, indent=2, ensure_ascii=False)
        else:
            output = format_as_skill_knowledge(extracted, args.topic)

        # Save or print
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(output, encoding='utf-8')
            print(f"\nOutput saved to: {output_path}")
        else:
            print("\n" + "=" * 60 + "\n")
            print(output)

        return

    # Default: show help
    parser.print_help()


if __name__ == '__main__':
    main()
