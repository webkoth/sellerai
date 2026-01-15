# Firecrawl MCP Workflow for Documentation Parsing

> Best practices for using Firecrawl MCP to parse marketplace API documentation

## Table of Contents

1. [Firecrawl MCP Tools](#firecrawl-mcp-tools)
2. [Choosing the Right Tool](#choosing-the-right-tool)
3. [Scrape Configuration](#scrape-configuration)
4. [Handling Large Responses](#handling-large-responses)
5. [Performance Optimization](#performance-optimization)
6. [Error Handling](#error-handling)

---

## Firecrawl MCP Tools

### Available Tools

**1. `firecrawl_scrape`** - Extract content from single URL
```javascript
mcp__firecrawl__firecrawl_scrape(
  url: string,
  formats: array,
  onlyMainContent: boolean,
  maxAge: number
)
```

**2. `firecrawl_map`** - Discover URLs on a website
```javascript
mcp__firecrawl__firecrawl_map(
  url: string,
  includeSubdomains: boolean,
  limit: number
)
```

**3. `firecrawl_search`** - Search web and extract
```javascript
mcp__firecrawl__firecrawl_search(
  query: string,
  limit: number,
  scrapeOptions: object
)
```

**4. `firecrawl_crawl`** - Extract from multiple pages
```javascript
mcp__firecrawl__firecrawl_crawl(
  url: string,
  maxDiscoveryDepth: number,
  limit: number,
  scrapeOptions: object
)
```

---

## Choosing the Right Tool

### For Marketplace API Documentation

| Task | Tool | Why |
|------|------|-----|
| Parse single API category | `scrape` | Known URL, single page |
| Discover available categories | `map` | Find all documentation pages |
| Find documentation URL | `search` | Don't know exact URL |
| Parse entire documentation | `crawl` | Multiple related pages |

**Most common: `scrape`** - You know the exact documentation URL.

### Decision Tree

```
Do you know the exact documentation URL?
├─ Yes → Use scrape
└─ No
   ├─ Know the domain? → Use map to discover URLs
   └─ Don't know domain? → Use search to find it
```

---

## Scrape Configuration

### Recommended Settings for API Docs

**Basic configuration:**
```javascript
{
  url: "https://dev.marketplace.com/api/docs",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000  // 7 days
}
```

### Parameter Guide

#### `formats`

**For API documentation, use:**
```javascript
formats: ["markdown"]
```

**Why markdown:**
- ✅ LLM-optimized format
- ✅ Preserves structure (headings, lists, code blocks)
- ✅ Easy to search and reference
- ✅ Version control friendly

**Other formats available:**
- `"html"` - Full HTML (use if markdown loses important structure)
- `"rawHtml"` - Unprocessed HTML
- `"screenshot"` - For visual verification
- `"links"` - Extract all links

#### `onlyMainContent`

**Always use `true` for documentation:**
```javascript
onlyMainContent: true
```

**Why:**
- ✅ Strips navigation, footer, sidebar
- ✅ Reduces token usage 50-70%
- ✅ Focuses on actual content
- ✅ Cleaner markdown output

**When to use `false`:**
- Need navigation structure
- Documentation has important sidebar content
- Need all page context

#### `maxAge` (Cache TTL)

**For stable documentation:**
```javascript
maxAge: 604800000  // 7 days in milliseconds
```

**Benefits:**
- ✅ 500% faster on repeated requests
- ✅ Reduces API costs
- ✅ Consistent results during development

**Cache duration guidelines:**
- Stable docs: 7 days (`604800000`)
- Updated weekly: 1 day (`86400000`)
- Frequently changing: 1 hour (`3600000`)
- Disable cache: `0` or omit parameter

---

## Handling Large Responses

### The Challenge

API documentation scrapes often produce large results:
- WB Advert API: 131KB (6,468 lines)
- WB Analytics API: 84KB (3,501 lines)
- WB Marketplace API: 92KB (3,718 lines)

**Token limit:** Responses over ~50KB may exceed display limits.

### Solution: Temp Files + jq

**Firecrawl auto-saves large results:**
```
.claude/projects/{project-id}/tool-results/firecrawl_{timestamp}.json
```

**Extract markdown:**
```bash
# Method 1: Direct extraction
jq -r '.[0].text | fromjson | .markdown' result.json > content.md

# Method 2: Check structure first
jq '.[0].text | fromjson | keys' result.json  # See available fields
jq -r '.[0].text | fromjson | .markdown' result.json > content.md
```

**Complete workflow:**
```bash
# 1. Scrape (result auto-saved to temp file)
# Use firecrawl_scrape in Claude Code

# 2. Extract markdown from temp file
jq -r '.[0].text | fromjson | .markdown' \
  /tmp/tool-result.json > /tmp/content.md

# 3. Create final file with metadata
cat header.md /tmp/content.md footer.md > final.md

# 4. Clean up temp files
rm /tmp/tool-result.json /tmp/content.md
```

---

## Performance Optimization

### 1. Use Caching Effectively

**Strategy:**
```javascript
// First scrape: maxAge = 7 days
scrape({ url, formats: ["markdown"], maxAge: 604800000 })

// Subsequent scrapes: use cached result (500% faster)
scrape({ url, formats: ["markdown"], maxAge: 604800000 })
```

**When to invalidate cache:**
- API documentation updated (check release notes)
- Need fresh data for verification
- Cache corrupted or incomplete

### 2. Parallel Scraping

**For multiple categories:**
```javascript
// ✅ Do: Parallel scraping (fast)
Promise.all([
  scrape({ url: url1, ... }),
  scrape({ url: url2, ... }),
  scrape({ url: url3, ... })
])

// ❌ Don't: Sequential scraping (slow)
await scrape({ url: url1, ... })
await scrape({ url: url2, ... })
await scrape({ url: url3, ... })
```

**Note:** In Claude Code MCP, use multiple tool calls in single message for parallel execution.

### 3. Minimize Re-scraping

**Pattern:**
1. Scrape once with long cache
2. Save to permanent location
3. Reference saved files for updates
4. Re-scrape only when needed

---

## Error Handling

### Common Errors

#### 1. 404 Not Found

**Error:**
```
Failed to scrape URL: https://dev.marketplace.com/api/prices
Status: 404
```

**Solutions:**
1. Use `firecrawl_map` to discover correct URLs
2. Check official documentation index
3. Verify URL pattern (may be part of another category)

**Example:**
```javascript
// First: Map to find structure
firecrawl_map({ url: "https://dev.marketplace.com/api" })

// Then: Scrape discovered URLs
firecrawl_scrape({ url: discovered_url, ... })
```

#### 2. Rate Limit Exceeded

**Error:**
```
Rate limit exceeded. Please try again later.
```

**Solutions:**
1. Use caching (`maxAge`) to reduce requests
2. Add delays between requests
3. Check Firecrawl plan limits

**Recommended approach:**
```javascript
// Use long cache during development
maxAge: 604800000  // Hits cache instead of API

// Add delays if needed
await sleep(1000)  // 1 second between requests
```

#### 3. Timeout

**Error:**
```
Request timeout after 30 seconds
```

**Solutions:**
1. Page too large - use `onlyMainContent: true`
2. Website slow - increase timeout (if supported)
3. Try different time of day

#### 4. Malformed Response

**Error:**
```
JSON parse error / Invalid markdown
```

**Solutions:**
1. Verify URL is correct
2. Check if page is JavaScript-rendered
3. Try `formats: ["html"]` instead of markdown
4. Use `actions` parameter for JavaScript execution

---

## Best Practices Summary

### ✅ Do

1. **Use appropriate cache duration**
   - Stable docs: 7 days
   - Active development: 1 day

2. **Always set `onlyMainContent: true`**
   - Reduces tokens 50-70%
   - Cleaner output

3. **Verify URLs before scraping**
   - Use map/search to discover
   - Check official documentation index

4. **Handle large responses**
   - Expect temp files for big docs
   - Use jq to extract markdown

5. **Document your sources**
   - Save original URLs
   - Include timestamps
   - Reference official docs

### ❌ Don't

1. **Don't disable caching unnecessarily**
   - Wastes credits
   - Slower performance

2. **Don't scrape without verification**
   - Leads to 404 errors
   - Wasted requests

3. **Don't ignore response size**
   - Plan for large responses
   - Have extraction workflow ready

4. **Don't scrape entire site when one page needed**
   - Use scrape, not crawl
   - Be specific with URLs

---

## Example: Complete Scraping Session

```javascript
// 1. Discover structure
const structure = await firecrawl_map({
  url: "https://dev.marketplace.com/docs"
})

// 2. Scrape specific category
const result = await firecrawl_scrape({
  url: "https://dev.marketplace.com/docs/orders-api",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000
})

// 3. Handle response
// If small: use result.markdown directly
// If large: extract from temp file using jq

// 4. Structure and save
const finalDoc = `
# Orders API

> **Base URL:** \`https://api.marketplace.com\`
> **Documentation:** https://dev.marketplace.com/docs/orders-api
> **Generated:** ${new Date().toISOString()}

${result.markdown}

---

**Source:** https://dev.marketplace.com/docs/orders-api
**Parser:** Firecrawl MCP
`

// 5. Save to file
fs.writeFileSync('docs/orders-api.md', finalDoc)
```

---

## Tool-Specific Tips

### firecrawl_map

**Best for:** Finding all documentation pages before scraping

**Usage:**
```javascript
firecrawl_map({
  url: "https://dev.marketplace.com/docs",
  includeSubdomains: false,
  limit: 100
})
```

**Returns:** Array of URLs found on the site

**When to use:**
- Don't know all category URLs
- Want to verify structure
- Planning comprehensive scraping

### firecrawl_scrape

**Best for:** Extracting content from known URL

**Usage:**
```javascript
firecrawl_scrape({
  url: "https://dev.marketplace.com/docs/api",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000
})
```

**Returns:** Markdown content of the page

**When to use:**
- Know exact documentation URL
- Single page extraction
- Most common use case

### firecrawl_search

**Best for:** Finding documentation when you don't know the URL

**Usage:**
```javascript
firecrawl_search({
  query: "marketplace orders API documentation",
  limit: 5,
  scrapeOptions: {
    formats: ["markdown"],
    onlyMainContent: true
  }
})
```

**Returns:** Search results with optional scraped content

**When to use:**
- Don't know documentation URL
- Need to find specific topic
- Searching for multiple related pages
