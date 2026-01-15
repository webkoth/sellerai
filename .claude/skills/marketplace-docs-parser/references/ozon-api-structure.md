# Ozon API Structure & Documentation

> Reference guide for parsing Ozon Seller API documentation

## Official Documentation

**Main Hub:** https://docs.ozon.ru/api/seller/

**Key Resources:**
- API Reference: https://docs.ozon.ru/api/seller/
- Getting Started: https://docs.ozon.ru/api/seller/#section/Getting-started
- Authentication: https://docs.ozon.ru/api/seller/#section/Authentication
- Rate Limits: https://docs.ozon.ru/api/seller/#section/Rate-limiting
- Release Notes: https://docs.ozon.ru/changelog/

---

## Known API Categories

### Core APIs

**Products API** - Управление товарами
- URL: https://docs.ozon.ru/api/seller/#tag/ProductAPI
- Operations: Create, update, import, export products
- Key endpoints: `/v1/product/import`, `/v2/product/info`, `/v1/product/list`

**Prices & Stocks API** - Цены и остатки
- URL: https://docs.ozon.ru/api/seller/#tag/PricesAPI
- Operations: Update prices, manage stock levels
- Key endpoints: `/v1/product/import/prices`, `/v2/product/import/stocks`

**Orders API** - Управление заказами
- URL: https://docs.ozon.ru/api/seller/#tag/FBSOrdersAPI
- Models: FBO (Fulfillment by Ozon), FBS (Fulfillment by Seller), realFBS
- Key endpoints: `/v3/posting/fbs/list`, `/v2/posting/fbo/list`

**Analytics API** - Аналитика и отчёты
- URL: https://docs.ozon.ru/api/seller/#tag/AnalyticsAPI
- Operations: Sales reports, finance reports, stock analytics
- Key endpoints: `/v1/analytics/data`, `/v1/report/products/create`

**Returns API** - Возвраты
- URL: https://docs.ozon.ru/api/seller/#tag/ReturnsAPI
- Operations: Manage returns, get return info
- Key endpoints: `/v2/returns/company/fbs`, `/v3/returns/company/fbo`

**Finance API** - Финансы
- URL: https://docs.ozon.ru/api/seller/#tag/FinanceAPI
- Operations: Transactions, balance, payouts
- Key endpoints: `/v3/finance/transaction/list`, `/v1/finance/realization`

**Ratings & Reviews API** - Отзывы и рейтинги
- URL: https://docs.ozon.ru/api/seller/#tag/RatingsAPI
- Operations: Get reviews, ratings, questions
- Key endpoints: `/v1/rating/summary`, `/v1/customer-review/list`

---

## Authentication

**Method:** API Key

**Headers:**
```http
Client-Id: {client_id}
Api-Key: {api_key}
```

**Token Types:**
- Read-only tokens
- Full access tokens
- Separate tokens per seller account

**Getting tokens:** https://seller.ozon.ru/app/settings/api-keys

---

## Rate Limits

**Default Limits:**
- 1000 requests per minute per token
- Varies by endpoint
- Documented per method

**Headers:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1640000000
```

---

## API Versions

Ozon uses versioned APIs:
- `/v1/*` - Original version
- `/v2/*` - Improved version
- `/v3/*` - Latest version

**Recommendation:** Always use latest version when available.

---

## Documentation Structure

**Organization:**
1. By resource type (Products, Orders, etc.)
2. Each resource has multiple endpoints
3. Each endpoint documented with:
   - Request parameters
   - Request body schema
   - Response schema
   - Examples
   - Error codes

**Example endpoint structure:**
```
POST /v2/product/info
├── Description
├── Request Parameters
├── Request Body (JSON schema)
├── Response (JSON schema)
├── Examples
│   ├── Request example
│   └── Response example
└── Errors
```

---

## Parsing Strategy

### Discovery Phase

1. **Map main documentation hub**
   ```javascript
   firecrawl_map({
     url: "https://docs.ozon.ru/api/seller/"
   })
   ```

2. **Identify tag/category structure**
   - Ozon uses OpenAPI spec with tags
   - Each tag = category (ProductAPI, OrdersAPI, etc.)

3. **Verify category URLs**
   - Check each tag URL
   - Some may share pages

### Scraping Phase

**Per category:**
```javascript
firecrawl_scrape({
  url: "https://docs.ozon.ru/api/seller/#tag/ProductAPI",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000
})
```

**Expected output structure:**
- Category overview
- List of endpoints
- Endpoint details (request/response schemas)
- Code examples
- Error codes

### Structuring Phase

**Suggested file structure:**
```
docs/api-reference/ozon/
├── README.md              # Main index
├── products.md            # Products API
├── prices-stocks.md       # Prices & Stocks API
├── orders-fbs.md          # FBS Orders API
├── orders-fbo.md          # FBO Orders API
├── orders-realfbs.md      # realFBS Orders API
├── analytics.md           # Analytics API
├── returns.md             # Returns API
├── finance.md             # Finance API
├── ratings-reviews.md     # Ratings & Reviews API
├── promotions.md          # Promotions API
└── ...
```

---

## Special Considerations

### FBO vs FBS vs realFBS

**FBO (Fulfillment by Ozon):**
- Ozon handles storage, packing, delivery
- Different endpoints from FBS
- API: `/v2/posting/fbo/*`

**FBS (Fulfillment by Seller):**
- Seller handles storage and packing
- Ozon handles delivery
- API: `/v3/posting/fbs/*`

**realFBS:**
- Seller handles everything
- Hybrid model
- API: mix of FBS endpoints

**Documentation note:** These may be separate categories or combined.

### API Changes

Ozon frequently updates API:
- Check release notes regularly
- Versions deprecated with notice
- Migration guides provided

**Release notes:** https://docs.ozon.ru/changelog/

---

## Category Metadata Template

```yaml
categories:
  products:
    name: "Products API"
    doc_url: "https://docs.ozon.ru/api/seller/#tag/ProductAPI"
    base_url: "https://api-seller.ozon.ru"
    description: "Управление товарами: создание, обновление, импорт, экспорт"

  prices_stocks:
    name: "Prices & Stocks API"
    doc_url: "https://docs.ozon.ru/api/seller/#tag/PricesAPI"
    base_url: "https://api-seller.ozon.ru"
    description: "Управление ценами и остатками товаров"

  # ... other categories
```

---

## Expected Challenges

### 1. OpenAPI Spec Format

**Challenge:** Ozon uses OpenAPI/Swagger spec
- May need to parse spec differently
- Tags map to categories
- Schemas may be nested

**Solution:**
- Firecrawl handles OpenAPI pages well
- Markdown output preserves structure
- May need post-processing for schemas

### 2. Version Fragmentation

**Challenge:** Multiple API versions
- Same resource, different versions
- Need to document all or latest?

**Solution:**
- Focus on latest version (v3 > v2 > v1)
- Note deprecated versions
- Link to migration guides

### 3. Complex Schemas

**Challenge:** Deep JSON schemas
- Nested objects
- Arrays of objects
- Optional/required fields

**Solution:**
- Firecrawl preserves schema structure
- Use code blocks for examples
- Keep original format

---

## Success Criteria

**Quality checklist:**
- ✅ All major API categories documented
- ✅ Request/response schemas included
- ✅ Code examples preserved
- ✅ Authentication documented
- ✅ Rate limits specified
- ✅ Links to official docs
- ✅ Version information clear
- ✅ FBO/FBS/realFBS distinctions clear

**Estimated categories:** 10-15 major API groups
**Estimated size:** Similar to WB (~400-500KB total)
