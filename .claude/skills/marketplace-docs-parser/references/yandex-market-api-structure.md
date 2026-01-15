# Yandex Market API Structure & Documentation

> Reference guide for parsing Yandex Market Partner API documentation

## Official Documentation

**Main Hub:** https://yandex.ru/dev/market/partner-api/

**Key Resources:**
- API Reference: https://yandex.ru/dev/market/partner-api/doc/ru/
- Getting Started: https://yandex.ru/dev/market/partner-api/doc/ru/concepts/about
- Authentication: https://yandex.ru/dev/market/partner-api/doc/ru/concepts/authorization
- Rate Limits: https://yandex.ru/dev/market/partner-api/doc/ru/concepts/limits
- Release Notes: https://yandex.ru/dev/market/partner-api/doc/ru/release-notes/

---

## Known API Categories

### Core APIs

**Campaign Management** - Управление магазинами
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/campaigns
- Operations: Get campaigns info, settings
- Models: FBY, FBS, DBS

**Catalog API** - Управление каталогом
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/offers
- Operations: Manage offers, prices, stocks
- Key endpoints: `/campaigns/{campaignId}/offers`, `/campaigns/{campaignId}/offer-prices`

**Orders API** - Управление заказами
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders
- Models: FBY (Fulfillment by Yandex), FBS, DBS (Delivery by Seller)
- Key endpoints: `/campaigns/{campaignId}/orders`, `/campaigns/{campaignId}/orders/{orderId}`

**Stocks API** - Остатки на складах
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/stocks
- Operations: Update stocks, get warehouses
- Key endpoints: `/campaigns/{campaignId}/offers/stocks`, `/warehouses`

**Reports API** - Отчёты и аналитика
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/reports
- Operations: Generate reports, download reports
- Types: Sales, returns, stocks, finance
- Key endpoints: `/reports/generate`, `/reports/{reportId}`

**Pricing API** - Управление ценами
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/prices
- Operations: Update prices, get pricing info
- Features: Base prices, discounts, promo
- Key endpoints: `/campaigns/{campaignId}/offer-prices`, `/campaigns/{campaignId}/offer-mapping-entries`

**Returns API** - Возвраты
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/returns
- Operations: Get returns, process returns
- Key endpoints: `/campaigns/{campaignId}/returns`, `/campaigns/{campaignId}/returns/{returnId}`

**Stats API** - Статистика
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/stats
- Operations: Order stats, offer stats, main report
- Key endpoints: `/campaigns/{campaignId}/stats/orders`, `/campaigns/{campaignId}/stats/main-report`

**Ratings & Reviews** - Отзывы и рейтинги
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/ratings
- Operations: Get ratings, reviews, manage reviews
- Key endpoints: `/campaigns/{campaignId}/ratings`, `/models/{modelId}/opinions`

**Hidden Offers** - Скрытые товары
- URL: https://yandex.ru/dev/market/partner-api/doc/ru/reference/hidden-offers
- Operations: Hide/unhide offers, get hidden list
- Key endpoints: `/campaigns/{campaignId}/hidden-offers`, `/campaigns/{campaignId}/hidden-offers/{offerId}`

---

## Authentication

**Method:** OAuth 2.0

**Authorization header:**
```http
Authorization: Bearer {oauth_token}
```

**Token Types:**
- Partner tokens (for sellers)
- Application tokens (for services)

**Getting tokens:**
1. Register application: https://oauth.yandex.ru/client/new
2. Get OAuth token via OAuth flow
3. Use token in API requests

**Documentation:** https://yandex.ru/dev/market/partner-api/doc/ru/concepts/authorization

---

## Rate Limits

**Default Limits:**
- Varies by endpoint
- Documented per method
- Typically 100-1000 req/min

**Headers:**
```http
X-RateLimit-Resource-Limit: 1000
X-RateLimit-Resource-Remaining: 995
X-RateLimit-Resource-Until: 2024-01-01T00:00:00Z
```

**Throttling:**
- HTTP 429 when exceeded
- Retry-After header with wait time

---

## API Models (FBY/FBS/DBS)

### FBY (Fulfillment by Yandex)

**Description:** Яндекс.Маркет берёт товар на свой склад
- Storage by Yandex
- Packing by Yandex
- Delivery by Yandex

**API specifics:**
- Warehouse management endpoints
- Supply endpoints
- Stock management

### FBS (Fulfillment by Seller)

**Description:** Продавец хранит товар, Яндекс доставляет
- Storage by Seller
- Packing by Seller
- Delivery by Yandex

**API specifics:**
- Order confirmation endpoints
- Label generation
- Handover to courier

### DBS (Delivery by Seller)

**Description:** Продавец полностью управляет процессом
- Storage by Seller
- Packing by Seller
- Delivery by Seller

**API specifics:**
- Full order lifecycle control
- Delivery tracking
- Status updates

---

## Documentation Structure

**Organization:**
1. By resource type (Campaigns, Orders, Offers, etc.)
2. RESTful API design
3. Each endpoint documented with:
   - HTTP method and path
   - Path parameters
   - Query parameters
   - Request body schema
   - Response schema
   - Examples
   - Error codes

**Example endpoint structure:**
```
GET /campaigns/{campaignId}/orders
├── Description
├── Path Parameters
│   └── campaignId (required)
├── Query Parameters
│   ├── status
│   ├── fromDate
│   └── page
├── Response
│   ├── JSON schema
│   └── Example
└── Errors
    ├── 400 Bad Request
    ├── 401 Unauthorized
    └── 404 Not Found
```

---

## Parsing Strategy

### Discovery Phase

1. **Map main documentation hub**
   ```javascript
   firecrawl_map({
     url: "https://yandex.ru/dev/market/partner-api/doc/ru/"
   })
   ```

2. **Identify category structure**
   - Categories organized by resource
   - Each resource has section in docs
   - Some resources grouped (e.g., all order operations)

3. **Verify category URLs**
   - Check reference section
   - May use anchor links (#orders, #offers, etc.)
   - Some may be separate pages

### Scraping Phase

**Per category:**
```javascript
firecrawl_scrape({
  url: "https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders",
  formats: ["markdown"],
  onlyMainContent: true,
  maxAge: 604800000
})
```

**Expected output structure:**
- Category overview
- List of endpoints
- Endpoint details (parameters, schemas)
- Code examples (often in multiple languages)
- Error codes

### Structuring Phase

**Suggested file structure:**
```
docs/api-reference/yandex-market/
├── README.md              # Main index
├── campaigns.md           # Campaigns API
├── offers.md              # Catalog/Offers API
├── orders.md              # Orders API
├── prices.md              # Pricing API
├── stocks.md              # Stocks/Warehouses API
├── reports.md             # Reports API
├── returns.md             # Returns API
├── stats.md               # Statistics API
├── ratings.md             # Ratings & Reviews API
├── hidden-offers.md       # Hidden Offers API
└── ...
```

---

## Special Considerations

### Campaign-Centric API

**Key concept:** Most endpoints require `campaignId`

**Structure:**
```
/campaigns/{campaignId}/orders
/campaigns/{campaignId}/offers
/campaigns/{campaignId}/stats
```

**Documentation note:**
- Campaign = магазин/кабинет
- One seller can have multiple campaigns
- Need campaign ID for most operations

### Paging

**Pagination pattern:**
```json
{
  "paging": {
    "nextPageToken": "token123",
    "prevPageToken": "token456"
  },
  "result": [...]
}
```

**Documentation:**
- Token-based pagination (not offset)
- Page size limits
- Total count may not be provided

### Complex Schemas

**Yandex uses detailed schemas:**
- Many nested objects
- Extensive field documentation
- Multiple optional fields

**Example:**
```json
{
  "order": {
    "id": 12345,
    "status": "PROCESSING",
    "substatus": "STARTED",
    "creationDate": "2024-01-01T10:00:00Z",
    "items": [...],
    "delivery": {...},
    "buyer": {...}
  }
}
```

---

## Expected Challenges

### 1. Russian Documentation

**Challenge:** Primary documentation in Russian
- API paths in English
- Descriptions in Russian
- Examples in Russian

**Solution:**
- Keep original Russian for accuracy
- Optionally add English translations
- Preserve code examples as-is

### 2. Campaign Complexity

**Challenge:** Campaign-centric structure
- Need to explain campaign concept
- Most endpoints require campaignId
- Different campaigns = different models (FBY/FBS/DBS)

**Solution:**
- Create campaigns overview section
- Note campaignId requirement
- Document model differences per campaign

### 3. Token-Based Pagination

**Challenge:** Non-standard pagination
- Token instead of page number
- Stateful (tokens expire)
- Hard to document navigation

**Solution:**
- Explain token concept clearly
- Include pagination examples
- Note token expiration

### 4. Multi-Language Examples

**Challenge:** Examples in multiple languages
- Python, PHP, Java, etc.
- May be verbose
- Not all endpoints have all languages

**Solution:**
- Keep most relevant examples (Python preferred)
- Note language in code blocks
- Preserve curl examples (universal)

---

## Category Metadata Template

```yaml
categories:
  campaigns:
    name: "Campaigns API"
    doc_url: "https://yandex.ru/dev/market/partner-api/doc/ru/reference/campaigns"
    base_url: "https://api.partner.market.yandex.ru"
    description: "Управление магазинами (кампаниями) на Яндекс.Маркете"

  offers:
    name: "Offers API"
    doc_url: "https://yandex.ru/dev/market/partner-api/doc/ru/reference/offers"
    base_url: "https://api.partner.market.yandex.ru"
    description: "Управление каталогом товаров (офферами)"

  orders:
    name: "Orders API"
    doc_url: "https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders"
    base_url: "https://api.partner.market.yandex.ru"
    description: "Управление заказами (FBY, FBS, DBS)"

  # ... other categories
```

---

## Success Criteria

**Quality checklist:**
- ✅ All major API categories documented
- ✅ Campaign concept explained
- ✅ FBY/FBS/DBS models distinguished
- ✅ Request/response schemas included
- ✅ Code examples preserved (especially curl/Python)
- ✅ Pagination explained
- ✅ Authentication documented
- ✅ Rate limits specified
- ✅ Links to official docs
- ✅ Russian text preserved (primary language)

**Estimated categories:** 10-12 major API groups
**Estimated size:** ~300-400KB total
**Language:** Primary Russian, code examples multilingual
