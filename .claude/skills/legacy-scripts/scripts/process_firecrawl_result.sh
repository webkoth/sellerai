#!/bin/bash
# Helper script to process Firecrawl results and create README.md files

if [ "$#" -lt 5 ]; then
    echo "Usage: $0 <firecrawl_result_file> <category_key> <category_name> <base_url> <rate_limits>"
    exit 1
fi

RESULT_FILE="$1"
CATEGORY_KEY="$2"
CATEGORY_NAME="$3"
BASE_URL="$4"
RATE_LIMITS="$5"
DOC_URL="${6:-https://dev.wildberries.ru/openapi/$CATEGORY_KEY}"

OUTPUT_DIR="docs/api-reference/wildberries/$CATEGORY_KEY"
OUTPUT_FILE="$OUTPUT_DIR/README.md"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Extract markdown from Firecrawl JSON result
echo "📄 Extracting markdown from $RESULT_FILE..."
MARKDOWN=$(jq -r '.[0].text | fromjson | .markdown' "$RESULT_FILE")

if [ -z "$MARKDOWN" ] || [ "$MARKDOWN" = "null" ]; then
    echo "❌ Failed to extract markdown"
    exit 1
fi

# Get current timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Create final README.md with metadata
cat > "$OUTPUT_FILE" << EOF
# $CATEGORY_NAME

> **Base URL:** \`$BASE_URL\`
> **Rate Limits:** $RATE_LIMITS
> **Документация:** $DOC_URL
> **Сгенерировано:** $TIMESTAMP

## Описание

Wildberries $CATEGORY_NAME documentation

---

## Документация API

$MARKDOWN

---

## Примечания

- Все запросы требуют токен авторизации в заголовке \`Authorization\`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: $DOC_URL
EOF

echo "✅ Created: $OUTPUT_FILE"
