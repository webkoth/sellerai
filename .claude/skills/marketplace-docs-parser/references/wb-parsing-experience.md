# Wildberries API Parsing Experience & Methodology

> Lessons learned and proven methodology from parsing WB OpenAPI documentation

## Table of Contents

1. [Documentation Discovery](#documentation-discovery)
2. [URL Patterns & Structure](#url-patterns--structure)
3. [Scraping Workflow](#scraping-workflow)
4. [Content Structuring](#content-structuring)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Best Practices](#best-practices)

---

## Documentation Discovery

### Finding Official Documentation

**WB Pattern:**
- Main hub: `https://dev.wildberries.ru`
- OpenAPI docs: `https://dev.wildberries.ru/openapi/{category}`
- Release notes: `https://dev.wildberries.ru/release-notes`

**Discovery Strategy:**

1. **Start with main API information page**
   ```
   https://dev.wildberries.ru/openapi/api-information
   ```
   - Use `firecrawl_scrape` to get overview
   - Extract list of all available categories
   - Identify correct URL patterns

2. **Use Map for structure discovery**
   ```python
   firecrawl_map(url="https://dev.wildberries.ru/openapi/work-with-products")
   ```
   - Reveals page structure
   - Shows available sections
   - Helps identify content organization

3. **Verify URLs before scraping**
   - Don't assume URL patterns
   - Some categories share base URLs
   - Some categories don't exist as separate pages

---

## URL Patterns & Structure

### WB API Categories (13 total)

| Category | URL Pattern | Base API URL |
|----------|-------------|--------------|
| Content | `/openapi/work-with-products` | `content-api.wildberries.ru` |
| Common | `/openapi/api-information` | `common-api.wildberries.ru` |
| Marketplace (FBS) | `/openapi/orders-fbs` | `marketplace-api.wildberries.ru` |
| Orders DBS | `/openapi/orders-dbs` | `marketplace-api.wildberries.ru` |
| Orders DBW | `/openapi/orders-dbw` | `marketplace-api.wildberries.ru` |
| In-Store Pickup | `/openapi/in-store-pickup` | `marketplace-api.wildberries.ru` |
| Supplies (FBW) | `/openapi/orders-fbw` | `supplies-api.wildberries.ru` |
| Advert | `/openapi/promotion` | `advert-api.wildberries.ru` |
| Feedbacks | `/openapi/user-communication` | `feedbacks-api.wildberries.ru` |
| Analytics | `/openapi/analytics` | `seller-analytics-api.wildberries.ru` |
| Reports | `/openapi/reports` | `statistics-api.wildberries.ru` |
| Documents | `/openapi/financial-reports-and-accounting` | `documents-api.wildberries.ru` |
| Tariffs | `/openapi/wb-tariffs` | `common-api.wildberries.ru` |

### Key Observations

**Categories that DON'T have separate pages:**
- Prices/Discounts → part of Content API
- Buyers Chat/Returns → part of Feedbacks API
- Statistics → part of Reports API
- Finance → part of Documents API

**404 Errors Encountered:**
- `/openapi/statistics` ❌
- `/openapi/prices` ❌
- `/openapi/returns` ❌
- `/openapi/buyer-chat` ❌
- `/openapi/wildberries-digital` ❌ (not published yet)

---

## Scraping Workflow

### Firecrawl MCP Configuration

**Recommended parameters for API documentation:**

```javascript
{
  url: doc_url,
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000  // 7 days cache for speed
}
```

**Why these settings:**
- `onlyMainContent: true` - strips navigation, footer, etc.
- `maxAge: 7 days` - enables caching for repeated requests (500% faster)
- `markdown` format - LLM-optimized, preserves structure

### Scraping Process

**Step 1: Initial scrape**
```bash
mcp__firecrawl__firecrawl_scrape(
  url="https://dev.wildberries.ru/openapi/promotion",
  formats=["markdown"],
  onlyMainContent=true,
  maxAge=604800000
)
```

**Step 2: Handle large responses**
- Results often exceed token limits (84KB - 131KB)
- Firecrawl auto-saves to temp files: `.claude/projects/.../tool-results/`
- Extract markdown: `jq -r '.[0].text | fromjson | .markdown' <file> > /tmp/content.md`

**Step 3: Verify content quality**
- Check if markdown is well-structured
- Verify all sections are present
- Ensure code examples are included

---

## Content Structuring

### File Organization

**Flat file structure (recommended for LLM):**
```
docs/api-reference/wildberries/
├── README.md          # Main index
├── content.md         # Content API
├── marketplace.md     # Marketplace API
├── advert.md          # Advert API
└── ...                # Other categories
```

**Why flat over nested:**
- Easier to find: `category.md` vs `category/README.md`
- Simpler references: `./category.md` vs `./category/README.md`
- Better for LLM: less directory navigation
- Cleaner git diffs

### Category File Template

```markdown
# {Category Name} API

> **Base URL:** `{base_url}`
> **Rate Limits:** {rate_limits}
> **Документация:** {doc_url}
> **Сгенерировано:** {timestamp}

## Описание

{description}

---

## Документация API

{scraped_content}

---

## Примечания

- Авторизация: токен в заголовке `Authorization`
- Создание токена: https://seller.wildberries.ru/api-integrations
- Официальная документация: {doc_url}
- Release Notes: https://dev.wildberries.ru/release-notes

---

**Источник:** {doc_url}
**Генератор:** Firecrawl MCP + Claude Code
```

### Main README Template

**Structure:**
1. Header with metadata (total categories, last update)
2. Category list with descriptions
3. Authorization section
4. Rate limits explanation
5. HTTP status codes reference
6. Additional resources

**Example:**
```markdown
# Wildberries API Reference

> **Официальная документация:** https://dev.wildberries.ru
> **Последнее обновление:** 2024-12-28
> **Всего категорий:** 13

## Категории API

### 1. Content

**Файл:** [`content.md`](./content.md)
**Base URL:** `https://content-api.wildberries.ru`
...
```

---

## Common Issues & Solutions

### Issue 1: 404 Errors on Assumed URLs

**Problem:** Many API documentation URLs don't match expected patterns

**Solution:**
1. Scrape main API information page first
2. Use `firecrawl_map` to discover actual structure
3. Don't assume `/openapi/{api-name}` pattern exists

**Example:**
```
Assumed: /openapi/prices ❌
Actual: Part of /openapi/work-with-products ✅
```

### Issue 2: Large Response Files

**Problem:** Scrape results exceed token limits (84KB+)

**Solution:**
```bash
# Firecrawl auto-saves to temp files
jq -r '.[0].text | fromjson | .markdown' result.json > content.md

# Create final file with header + content + footer
cat header.md content.md footer.md > category.md
```

### Issue 3: Template Variables Instead of Content

**Problem:** Bash template variables not expanded (`$(date)`, `$(cat)`)

**Solution:**
- Don't use template variables in heredocs
- Generate content programmatically or manually
- Use proper heredoc quoting: `cat << 'EOF'` (single quotes)

### Issue 4: Inconsistent Metadata

**Problem:** Rate limits, base URLs vary by source

**Solution:**
- Create canonical source file (e.g., `auth.ts` in MCP server)
- Reference official documentation
- Document where metadata comes from

**WB Example:**
```typescript
// mcp/wb-mcp/src/utils/auth.ts - lines 89-145
export const WB_API_URLS = {...}
export const WB_RATE_LIMITS = {...}
```

---

## Best Practices

### 1. Cache Strategy

✅ **Do:**
- Use `maxAge: 604800000` (7 days) for stable documentation
- Cache main pages differently than detail pages
- Document cache settings in README

❌ **Don't:**
- Disable caching for large documentation
- Use very short cache times (wastes credits)

### 2. Content Quality

✅ **Do:**
- Verify scraped content is complete
- Check for code examples and request/response schemas
- Ensure proper markdown formatting
- Include metadata headers

❌ **Don't:**
- Skip verification step
- Accept malformed markdown
- Lose original structure

### 3. Organization

✅ **Do:**
- Use flat file structure for ≤20 categories
- Create descriptive category names
- Include comprehensive main README
- Add timestamps to track freshness

❌ **Don't:**
- Create deep nested directories
- Use unclear naming conventions
- Skip index/README files

### 4. Automation

✅ **Do:**
- Create reusable parser scripts
- Document scraping process
- Include category metadata in code
- Support partial updates (single category)

❌ **Don't:**
- Hardcode URLs everywhere
- Repeat manual scraping
- Skip error handling

### 5. Documentation

✅ **Do:**
- Document source URLs clearly
- Include generation timestamps
- Link back to official documentation
- Note special requirements (e.g., "Джем" subscription)

❌ **Don't:**
- Leave metadata out
- Skip attribution
- Forget rate limit info

---

## Workflow Summary

**Complete parsing workflow:**

1. **Discovery**
   - Map main documentation hub
   - Identify all categories and URLs
   - Verify URLs return 200 (not 404)

2. **Scraping**
   - Use Firecrawl with caching
   - Handle large responses (temp files + jq)
   - Verify content quality

3. **Structuring**
   - Create category files with templates
   - Add metadata headers
   - Generate main README index

4. **Verification**
   - Check all files created
   - Verify markdown quality
   - Test links in README

5. **Maintenance**
   - Create parser script for updates
   - Document scraping process
   - Set up refresh schedule

---

## Success Metrics

**Quality indicators:**
- ✅ All available categories documented
- ✅ Consistent file structure
- ✅ Complete metadata (URLs, rate limits)
- ✅ Timestamps for tracking freshness
- ✅ Links to official documentation
- ✅ LLM-optimized format (markdown)
- ✅ Reusable update process

**WB Results:**
- 13 categories documented
- ~20,000 lines of API docs
- 488KB total size
- Flat file structure
- Reusable parser script created
