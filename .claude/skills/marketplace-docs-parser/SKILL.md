---
name: marketplace-docs-parser
description: Parse and structure marketplace API documentation (Wildberries, Ozon, Yandex Market) into LLM-friendly markdown format using Firecrawl MCP. Use when (1) parsing marketplace API documentation, (2) creating LLM-optimized API reference, (3) structuring API docs from official sources, (4) updating marketplace documentation, (5) generating markdown docs from OpenAPI/web pages. Triggers include "parse ozon docs", "scrape yandex market api", "create marketplace documentation", "llm-friendly docs", "structure api reference", "parse API documentation".
context: fork
---

# Marketplace Documentation Parser

Parse official API documentation from Russian marketplaces (Wildberries, Ozon, Yandex Market) into structured, LLM-friendly markdown format using Firecrawl MCP.

## Core Workflow

### Step 1: Identify Target Marketplace

**Supported marketplaces:**
- ✅ **Wildberries** - Fully documented workflow (see `references/wb-parsing-experience.md`)
- ✅ **Ozon** - Structure documented (see `references/ozon-api-structure.md`)
- ✅ **Yandex Market** - Structure documented (see `references/yandex-market-api-structure.md`)

**Determine:**
- Official documentation URL
- Authentication method
- Rate limits
- API structure (categories/tags)

### Step 2: Discovery Phase

**Goal:** Find all API categories and their URLs

**Use Firecrawl Map:**
```javascript
mcp__firecrawl__firecrawl_map({
  url: "{marketplace_docs_base_url}"
})
```

**Actions:**
1. Map main documentation hub to find structure
2. Identify all API categories (Products, Orders, Analytics, etc.)
3. Verify category URLs (check for 404s)
4. Note any categories that share pages

**Reference:** See `references/firecrawl-workflow.md` for detailed Firecrawl usage

### Step 3: Scraping Phase

**Goal:** Extract markdown content for each category

**Use Firecrawl Scrape:**
```javascript
mcp__firecrawl__firecrawl_scrape({
  url: "{category_doc_url}",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000  // 7 days cache
})
```

**For each category:**
1. Scrape using Firecrawl with caching enabled
2. Handle large responses (may auto-save to temp files)
3. Extract markdown using jq if needed: `jq -r '.[0].text | fromjson | .markdown'`
4. Verify content quality (check for completeness)

**Important notes:**
- Use `onlyMainContent: true` to strip navigation/footer (reduces tokens 50-70%)
- Enable caching (`maxAge: 604800000`) for 500% speed improvement
- Large responses (>50KB) will auto-save to `.claude/projects/.../tool-results/`

### Step 4: Structuring Phase

**Goal:** Create organized markdown documentation

**File structure (flat is recommended):**
```
docs/api-reference/{marketplace}/
├── README.md          # Main index
├── category1.md       # Category 1 API
├── category2.md       # Category 2 API
└── ...
```

**For each category file:**
1. Use template from `assets/category-template.md`
2. Fill in metadata:
   - `{CATEGORY_NAME}` - e.g., "Orders API"
   - `{BASE_URL}` - e.g., "https://api.marketplace.com"
   - `{RATE_LIMITS}` - e.g., "300 req/60s"
   - `{DOC_URL}` - Original documentation URL
   - `{TIMESTAMP}` - Generation timestamp
   - `{DESCRIPTION}` - Brief category description
   - `{SCRAPED_CONTENT}` - Markdown from Firecrawl
3. Save to `docs/api-reference/{marketplace}/{category}.md`

**For main README:**
1. Use template from `assets/readme-template.md`
2. Fill in marketplace-specific info
3. List all categories with links
4. Add authentication/rate limits sections
5. Save to `docs/api-reference/{marketplace}/README.md`

### Step 5: Verification & Cleanup

**Verify:**
- ✅ All categories documented
- ✅ Markdown is well-formatted
- ✅ Code examples preserved
- ✅ Links work
- ✅ Metadata complete
- ✅ No empty subdirectories

**Clean up:**
1. Remove temp files used during extraction
2. Delete any empty directories
3. Verify flat file structure (no nested folders except root)

---

## Marketplace-Specific Guidance

### Wildberries

**Proven workflow documented in:** `references/wb-parsing-experience.md`

**Key insights:**
- 13 available API categories
- Some categories share pages (Prices → Content, Chat → Feedbacks)
- Expected 404s: `/openapi/statistics`, `/openapi/prices`, etc.
- Large documentation (84KB - 131KB per category)
- Analytics API requires "Джем" subscription

**Reference metadata:** `mcp/wb-mcp/src/utils/auth.ts` for URLs and rate limits

### Ozon

**Structure documented in:** `references/ozon-api-structure.md`

**Key characteristics:**
- OpenAPI/Swagger spec format
- Tag-based organization
- Multiple API versions (v1, v2, v3)
- FBO/FBS/realFBS model distinction
- 10-15 estimated categories

**Documentation:** https://docs.ozon.ru/api/seller/

### Yandex Market

**Structure documented in:** `references/yandex-market-api-structure.md`

**Key characteristics:**
- Campaign-centric API (most endpoints need `campaignId`)
- OAuth 2.0 authentication
- FBY/FBS/DBS model distinction
- Token-based pagination
- Primary language: Russian
- 10-12 estimated categories

**Documentation:** https://yandex.ru/dev/market/partner-api/

---

## Common Issues & Solutions

### Issue: 404 on Documentation URLs

**Symptoms:** URL returns 404 error

**Solutions:**
1. Use `firecrawl_map` to discover correct structure
2. Check if category is part of another page
3. Verify URL in official documentation index
4. Some categories may not exist as separate pages

**Example (WB):**
```
Assumed: /openapi/prices ❌
Actual: Part of /openapi/work-with-products ✅
```

### Issue: Response Too Large (Token Limit)

**Symptoms:** Firecrawl result exceeds display limit

**Solutions:**
1. Firecrawl auto-saves to temp file
2. Extract markdown with jq:
   ```bash
   jq -r '.[0].text | fromjson | .markdown' result.json > content.md
   ```
3. Combine with template to create final file

### Issue: Inconsistent Content Quality

**Symptoms:** Missing sections, broken formatting

**Solutions:**
1. Verify `onlyMainContent: true` is set
2. Check if page is JavaScript-rendered (may need actions)
3. Try different URL or scraping approach
4. Manually verify critical sections

### Issue: Rate Limiting

**Symptoms:** HTTP 429 errors from Firecrawl

**Solutions:**
1. Enable caching: `maxAge: 604800000`
2. Add delays between requests
3. Use cached results during development

---

## Best Practices

### ✅ Do

1. **Always verify URLs first**
   - Use map/search before bulk scraping
   - Check for 404s
   - Validate URL patterns

2. **Enable caching**
   - Use `maxAge: 604800000` (7 days)
   - Faster scraping (500% speed boost)
   - Reduces API costs

3. **Use flat file structure**
   - Better for LLM navigation
   - Easier references: `./category.md`
   - Cleaner git diffs

4. **Include comprehensive metadata**
   - Base URLs, rate limits
   - Generation timestamps
   - Links to official docs

5. **Reference marketplace-specific guides**
   - `wb-parsing-experience.md` for WB
   - `ozon-api-structure.md` for Ozon
   - `yandex-market-api-structure.md` for Yandex

### ❌ Don't

1. **Don't skip discovery phase**
   - Leads to 404 errors
   - Misses categories

2. **Don't disable caching**
   - Wastes credits
   - Much slower

3. **Don't use nested directories**
   - Harder to navigate
   - Complex references

4. **Don't ignore response size**
   - Plan for large responses
   - Have jq extraction ready

---

## Resources

### References (load as needed)

**Wildberries Experience:**
- `references/wb-parsing-experience.md` - Complete WB parsing methodology, proven workflow, common issues, best practices

**Firecrawl Workflow:**
- `references/firecrawl-workflow.md` - Detailed Firecrawl MCP usage, tool selection, configuration, error handling

**Marketplace Structures:**
- `references/ozon-api-structure.md` - Ozon API structure, categories, authentication, special considerations
- `references/yandex-market-api-structure.md` - Yandex Market API structure, models (FBY/FBS/DBS), pagination

### Assets (templates for output)

**Markdown Templates:**
- `assets/category-template.md` - Template for individual category documentation files
- `assets/readme-template.md` - Template for main README index file

**Usage:**
```bash
# Category file
cp assets/category-template.md docs/api-reference/{marketplace}/{category}.md
# Fill in: {CATEGORY_NAME}, {BASE_URL}, {RATE_LIMITS}, {DOC_URL}, etc.

# Main README
cp assets/readme-template.md docs/api-reference/{marketplace}/README.md
# Fill in: {MARKETPLACE_NAME}, {TOTAL_CATEGORIES}, {CATEGORIES_LIST}, etc.
```

---

## Example: Complete Workflow

**Scenario:** Parse Ozon API documentation

```
1. Discovery
   → firecrawl_map({ url: "https://docs.ozon.ru/api/seller/" })
   → Identify categories: Products, Orders, Prices, etc.

2. Scraping
   → For each category:
      firecrawl_scrape({
        url: "https://docs.ozon.ru/api/seller/#tag/ProductAPI",
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 604800000
      })

3. Structuring
   → Create docs/api-reference/ozon/products.md
   → Use assets/category-template.md
   → Fill metadata + scraped content

4. Index
   → Create docs/api-reference/ozon/README.md
   → Use assets/readme-template.md
   → List all categories

5. Verification
   → Check all files created
   → Verify markdown quality
   → Remove temp files
```

**Result:** Complete LLM-friendly Ozon API documentation
