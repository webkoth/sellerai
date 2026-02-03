---
name: legacy-scripts
description: Collection of legacy automation scripts for Ozon and WB import/export operations. Use these when no modern MCP tool is available.
---

# Legacy Scripts

This skill contains legacy scripts moved from the root directory during restructuring.
They are located in `.claude/skills/legacy-scripts/scripts/`.

## Contents

- **Ozon Import/Export**:
    - `execute-ozon-import.ts`
    - `prepare-ozon-import.ts`
    - `wb-to-ozon-prepare.ts`
    - `update-ozon-stocks.ts`
    - `get-ozon-*.ts` (attributes, content-rating, dict-values, warehouses)

- **Parsers**:
    - `parse_courses.py`
    - `parse_wb_openapi.py`

- **Utilities**:
    - `find-best-values.ts`
    - `manual_update_card.ts`
    - `update-cards.ts`

## Usage

Run these scripts from the repository root using `npx ts-node` or `python3`.
Example:
```bash
npx ts-node .claude/skills/legacy-scripts/scripts/execute-ozon-import.ts
```

> [!WARNING]
> These are legacy scripts. Prefer using `wb-mcp` or `ozon-mcp` commands if available.
