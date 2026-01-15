# Analytics and Data API

> **Base URL:** `https://seller-analytics-api.wildberries.ru`
> **Rate Limits:** 60 req/60s, interval 1000ms, burst 5
> **Документация:** https://dev.wildberries.ru/openapi/analytics
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Аналитика продаж, воронка, поисковые запросы, остатки

⚠️ **ВАЖНО:** Требует подписку "Джем" в личном кабинете WB

---

## Документация API

- General

- Product Management

- FBS Orders

- DBW Orders

- DBS Orders

- In-Store Pickup Orders

- FBW Supplies

- Marketing and Promotions

- Customer Communication

- Tariffs

- Analytics and Data

  - Sales Funnel

  - Search Queries for Your Items

    - POST

      Main Page/api/v2/search-report/report

    - POST

      Pagination by Groups/api/v2/search-report/table/groups

    - POST

      Pagination by Products Within a Group/api/v2/search-report/table/details

    - POST

      Search Texts by Product/api/v2/search-report/product/search-texts

    - POST

      Orders and Positions by Product Search Texts/api/v2/search-report/product/orders
  - Stocks Report

  - Seller Analytics CSV
- Reports

- Documents and Accounting

- Wildberries Digital


- Analytics and Data
- Sales Funnel
  - postProduct Cards Statistics per Period/api/analytics/v3/sales-funnel/products
  - postProduct Cards Statistics per Days/api/analytics/v3/sales-funnel/products/history
  - postGrouped Product Cards Statistics per Days/api/analytics/v3/sales-funnel/grouped/history
- Search Queries for Your Items
  - postMain Page/api/v2/search-report/report
  - postPagination by Groups/api/v2/search-report/table/groups
  - postPagination by Products Within a Group/api/v2/search-report/table/details
  - postSearch Texts by Product/api/v2/search-report/product/search-texts
  - postOrders and Positions by Product Search Texts/api/v2/search-report/product/orders
- Stocks Report
  - postGroup Data/api/v2/stocks-report/products/groups
  - postProduct Data/api/v2/stocks-report/products/products
  - postSize Data/api/v2/stocks-report/products/sizes
  - postWarehouse Data/api/v2/stocks-report/offices
- Seller Analytics CSV
  - postCreate the Report/api/v2/nm-report/downloads
  - getGet the Reports List/api/v2/nm-report/downloads
  - postRegenerate the Report/api/v2/nm-report/downloads/retry
  - getGet the Report/api/v2/nm-report/downloads/file/{downloadId}

# Analytics and Data(analytics)

Data on seller analytics.

# [tag/Analytics-and-Data](https://dev.wildberries.ru/en/openapi/analytics\#tag/Analytics-and-Data) Analytics and Data

Data on seller analytics.

# [tag/Sales-Funnel](https://dev.wildberries.ru/en/openapi/analytics\#tag/Sales-Funnel) Sales Funnel

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

Methods for getting [statistics](https://seller.wildberries.ru/content-analytics/interactive-report) for:

1. [Product cards per period](https://dev.wildberries.ru/en/openapi/analytics#tag/Sales-Funnel/operation/postSalesFunnelProducts)
2. [Product cards per days](https://dev.wildberries.ru/en/openapi/analytics#tag/Sales-Funnel/operation/postSalesFunnelProductsHistory)
3. [Grouped product cards per days](https://dev.wildberries.ru/en/openapi/analytics#tag/Sales-Funnel/operation/postSalesFunnelGroupedHistory)

Timezones are presented in IANA format, the current list can be viewed [here](https://nodatime.org/TimeZones)

## [tag/Sales-Funnel/operation/postSalesFunnelProducts](https://dev.wildberries.ru/en/openapi/analytics\#tag/Sales-Funnel/operation/postSalesFunnelProducts) Product Cards Statistics per Period/api/analytics/v3/sales-funnel/products

posthttps://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products

https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products

Method description

The method generates a report on products by comparing key metrics — for example, cart additions, orders, and product card views — for the current period with a similar past one.

The `brandNames`, `subjectIds`, `tagIds`, and `nmIds` parameters can be empty `[]`, in which case the response will return all of the seller's product cards.

If you specify multiple parameters, the response will include cards that match all of these parameters simultaneously. If no cards match the request parameters, an empty response `[]` will be returned.

You can get a report for a maximum of the last 365 days.

In the previous period's data:

- The data in `pastPeriod` covers the same duration as in `selectedPeriod`
- If the `pastPeriod` start date is more than a year before the current date, it will be adjusted to: `pastPeriod.start = current date - 365 days`

Pagination can be used.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| selectedPeriod<br>required | object<br>Requested period |
| pastPeriod | object<br>Period for comparison |
| nmIds | Array of integers<uint64>\[ 0 .. 1000 \] items\[ items <uint64 > \]<br>WB articles to include in the report. Leave empty to get a report for all products |
| brandNames | Array of strings<br>List of brands for filtering |
| subjectIds | Array of integers<uint64>\[ items <uint64 > \]<br>List of subject IDs for filtering |
| tagIds | Array of integers<uint64>\[ items <uint64 > \]<br>List of label IDs for filtering |
| skipDeletedNm | boolean<br>Hide deleted product cards |
| orderBy | object (OrderBy) <br>Параметры сортировки |
| limit | integer<uint32><= 1000<br>Default:50<br>Number of product cards in the response |
| offset | integer<uint32><br>Default:0<br>How many results to skip. For example, with value `10`, the response will start with the 11 element |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"selectedPeriod": {"start": "2023-06-01",

"end": "2024-03-01"

},

"pastPeriod": {"start": "2023-06-01",

"end": "2024-03-01"

},

"nmIds": [1234567\
\
],

"brandNames": ["nike",\
\
"adidas"\
\
],

"subjectIds": [64,\
\
334\
\
],

"tagIds": [32,\
\
53\
\
],

"skipDeletedNm": false,

"orderBy": {"field": "openCard",

"mode": "asc"

},

"limit": 231,

"offset": 10

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"products": [{"product": {"nmId": 268913787,\
\
"title": "Кроссовки для бега",\
\
"vendorCode": "12345456",\
\
"brandName": "Demix",\
\
"subjectId": 105,\
\
"subjectName": "Кроссовки",\
\
"tags": [{"id": 1,\
\
"name": "Обувь"\
\
}\
\
],\
\
"productRating": 4.5,\
\
"feedbackRating": 4,\
\
"stocks": {"wb": 0,\
\
"mp": 0,\
\
"balanceSum": 0\
\
}\
\
},\
\
"statistic": {"selected": {"period": {"start": "2023-06-01",\
\
"end": "2024-03-01"\
\
},\
\
"openCount": 45,\
\
"cartCount": 34,\
\
"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutCount": 19,\
\
"buyoutSum": 1262,\
\
"cancelCount": 0,\
\
"cancelSum": 0,\
\
"avgPrice": 1262,\
\
"avgOrdersCountPerDay": 0.04,\
\
"shareOrderPercent": 3,\
\
"addToWishlist": 455,\
\
"timeToReady": {"days": 1,\
\
"hours": 8,\
\
"mins": 34\
\
},\
\
"localizationPercent": 46,\
\
"wbClub": {"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutSum": 1262,\
\
"buyoutCount": 19,\
\
"cancelSum": 0,\
\
"cancelCount": 0,\
\
"avgPrice": 1262,\
\
"buyoutPercent": 43,\
\
"avgOrderCountPerDay": 0.04\
\
},\
\
"conversions": {"addToCartPercent": 19,\
\
"cartToOrderPercent": 65,\
\
"buyoutPercent": 0\
\
}\
\
},\
\
"past": {"period": {"start": "2023-06-01",\
\
"end": "2024-03-01"\
\
},\
\
"openCount": 45,\
\
"cartCount": 34,\
\
"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutCount": 19,\
\
"buyoutSum": 1262,\
\
"cancelCount": 0,\
\
"cancelSum": 0,\
\
"avgPrice": 1262,\
\
"avgOrdersCountPerDay": 0.04,\
\
"shareOrderPercent": 3,\
\
"addToWishlist": 455,\
\
"timeToReady": {"days": 1,\
\
"hours": 8,\
\
"mins": 34\
\
},\
\
"localizationPercent": 46,\
\
"wbClub": {"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutSum": 1262,\
\
"buyoutCount": 19,\
\
"cancelSum": 0,\
\
"cancelCount": 0,\
\
"avgPrice": 1262,\
\
"buyoutPercent": 43,\
\
"avgOrderCountPerDay": 0.04\
\
},\
\
"conversions": {"addToCartPercent": 19,\
\
"cartToOrderPercent": 65,\
\
"buyoutPercent": 0\
\
}\
\
},\
\
"comparison": {"openCountDynamic": 10,\
\
"cartCountDynamic": 30,\
\
"orderCountDynamic": -100,\
\
"orderSumDynamic": -100,\
\
"buyoutCountDynamic": -100,\
\
"buyoutSumDynamic": -100,\
\
"cancelCountDynamic": 0,\
\
"cancelSumDynamic": 0,\
\
"avgOrdersCountPerDayDynamic": 0,\
\
"avgPriceDynamic": -100,\
\
"shareOrderPercentDynamic": -80,\
\
"addToWishlistDynamic": 60,\
\
"timeToReadyDynamic": {"days": 1,\
\
"hours": 8,\
\
"mins": 34\
\
},\
\
"localizationPercentDynamic": 46,\
\
"wbClubDynamic": {"orderCount": -100,\
\
"orderSum": -100,\
\
"buyoutSum": -100,\
\
"buyoutCount": -100,\
\
"cancelSum": 0,\
\
"cancelCount": 0,\
\
"avgPrice": -100,\
\
"buyoutPercent": 43,\
\
"avgOrderCountPerDay": 0.04\
\
},\
\
"conversions": {"addToCartPercent": 19,\
\
"cartToOrderPercent": 65,\
\
"buyoutPercent": 0\
\
}\
\
}\
\
}\
\
}\
\
]

}

}`

## [tag/Sales-Funnel/operation/postSalesFunnelProductsHistory](https://dev.wildberries.ru/en/openapi/analytics\#tag/Sales-Funnel/operation/postSalesFunnelProductsHistory) Product Cards Statistics per Days/api/analytics/v3/sales-funnel/products/history

posthttps://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history

https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history

Method description

The method returns statistics for product cards by day or by week. Data is available on cart additions, orders, product card views, and so on.

You can get data for a maximum of the last week.

To get reports for a period of up to a year, use the [Seller Analytics CSV](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV) methods. These methods are available only with a subscription to [Jam extended analytics](https://seller.wildberries.ru/monetization/jam).

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| selectedPeriod<br>required | object<br>Requested period |
| nmIds<br>required | Array of integers<uint64>\[ 1 .. 20 \] items\[ items <uint64 > \]<br>WB articles to include in the report |
| skipDeletedNm | boolean<br>Hide deleted product cards |
| aggregationLevel | string (Level) <br>Default:"day"<br>Enum:"day""week"<br>Aggregation Type. If not specified, the default is aggregation<br>by days. <br>Available aggregation levels: `day`, `week` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"selectedPeriod": {"start": "2023-06-01",

"end": "2024-03-01"

},

"nmIds": [0\
\
],

"skipDeletedNm": true,

"aggregationLevel": "day"

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`[{"product": {"nmId": 268913787,\
\
"title": "Кроссовки для бега",\
\
"vendorCode": "12345456",\
\
"brandName": "Demix",\
\
"subjectId": 105,\
\
"subjectName": "Кроссовки"\
\
},\
\
"history": [{"date": "2024-10-23",\
\
"openCount": 45,\
\
"cartCount": 34,\
\
"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutCount": 19,\
\
"buyoutSum": 1262,\
\
"buyoutPercent": 35,\
\
"addToCartConversion": 43,\
\
"cartToOrderConversion": 0,\
\
"addToWishlistCount": 0\
\
}\
\
]\
\
}\
\
]`

## [tag/Sales-Funnel/operation/postSalesFunnelGroupedHistory](https://dev.wildberries.ru/en/openapi/analytics\#tag/Sales-Funnel/operation/postSalesFunnelGroupedHistory) Grouped Product Cards Statistics per Days/api/analytics/v3/sales-funnel/grouped/history

posthttps://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/grouped/history

https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/grouped/history

Method description

The method returns statistics for product cards by day or by week. Product cards are grouped by subjects, brands and tags. Data is available on cart additions, orders, product card views, and so on.

The `brandNames`, `subjectIDs`, `tagIds`, and `nmIds` parameters can be empty `[]`, in which case the response will return all of the seller's product cards.

The product of the number of subjects, brands, and tags in the request cannot be more than 16. For example, 4 brands and 4 subjects or 2 subjects, 2 tags, and 4 brands.

You can get data for a maximum of the last week.

To get reports for a period of up to a year, use the [Seller Analytics CSV](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV) methods. These methods are available only with a subscription to [Jam extended analytics](https://seller.wildberries.ru/monetization/jam).

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| selectedPeriod<br>required | object<br>Requested period |
| brandNames | Array of strings<br>List of brands for filtering |
| subjectIds | Array of integers<uint64>\[ items <uint64 > \]<br>List of subject IDs for filtering |
| tagIds | Array of integers<uint64>\[ items <uint64 > \]<br>List of label IDs for filtering |
| skipDeletedNm | boolean<br>Hide deleted product cards |
| aggregationLevel | string (Level) <br>Default:"day"<br>Enum:"day""week"<br>Aggregation Type. If not specified, the default is aggregation<br>by days. <br>Available aggregation levels: `day`, `week` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"selectedPeriod": {"start": "2023-06-01",

"end": "2024-03-01"

},

"brandNames": ["nike",\
\
"adidas"\
\
],

"subjectIds": [64,\
\
334\
\
],

"tagIds": [32,\
\
53\
\
],

"skipDeletedNm": false,

"aggregationLevel": "day"

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": [{"product": {"nmId": 268913787,\
\
"title": "Кроссовки для бега",\
\
"vendorCode": "12345456",\
\
"brandName": "Demix",\
\
"subjectId": 105,\
\
"subjectName": "Кроссовки"\
\
},\
\
"history": [{"date": "2024-10-23",\
\
"openCount": 45,\
\
"cartCount": 34,\
\
"orderCount": 19,\
\
"orderSum": 1262,\
\
"buyoutCount": 19,\
\
"buyoutSum": 1262,\
\
"buyoutPercent": 35,\
\
"addToCartConversion": 43,\
\
"cartToOrderConversion": 0,\
\
"addToWishlistCount": 0\
\
}\
\
]\
\
}\
\
]

}`

# [tag/Search-Queries-for-Your-Items](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items) Search Queries for Your Items

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

These methods can be used to obtain a [report on search queries for your items](https://seller.wildberries.ru/search-analytics/my-search-queries).

You can use these methods only with [Jam](https://seller.wildberries.ru/monetization/jam) subscription

## [tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1report/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1report/post) Main Page/api/v2/search-report/report

posthttps://seller-analytics-api.wildberries.ru/api/v2/search-report/report

https://seller-analytics-api.wildberries.ru/api/v2/search-report/report

Method description

Forms a dataset for the main report page with:

- General information
- Product positions
- Data on visibility and transitions to the product card
- Data for the table by groups

To obtain additional data in the table, use a separate request for:

- Pagination by groups
- Retrieval of products within a group

Additional parameters for selecting the list of products in the table:

- `positionCluster` — average position in search

The parameters `includeSubstitutedSKUs` and `includeSearchTexts` cannot both be set to `false`

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| currentPeriod<br>required | object (Period) <br>Current period |
| pastPeriod | object (pastPeriod) <br>Previous period for comparison. Number of days — less than or equal to `currentPeriod` |
| nmIds | Array of integers<int32>\[ items <int32 > \]<br>List of WB article numbers for filtering |
| subjectIds | Array of integers<int32>\[ items <int32 > \]<br>List of subject IDs for filtering |
| brandNames | Array of strings<br>List of brands for filtering |
| tagIds | Array of integers<int64>\[ items <int64 > \]<br>List of label IDs for filtering |
| positionCluster<br>required | string (PositionCluster) <br>Enum:"all""firstHundred""secondHundred""below"<br>Which average search position of products to display in the report:<br>- `all` — all<br>- `firstHundred` — from 1 to 100<br>- `secondHundred` — from 101 to 200<br>- `below` — from 201 and below |
| orderBy<br>required | object (OrderBy) <br>Параметры сортировки |
| includeSubstitutedSKUs | boolean<br>Default:true<br>Show data for direct queries with [promo items](https://seller.wildberries.ru/help-center/article/A-524) |
| includeSearchTexts | boolean<br>Default:true<br>Show data for search queries without promo items |
| limit<br>required | integer<uint32><= 1000<br>Number of product groups in the response |
| offset<br>required | integer<uint32><br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"pastPeriod": {"start": "2024-02-08",

"end": "2024-02-08"

},

"nmIds": [162579635,\
\
166699779\
\
],

"subjectIds": [32,\
\
64\
\
],

"brandNames": ["Adidas",\
\
"Nike"\
\
],

"tagIds": [3,\
\
5,\
\
6\
\
],

"positionCluster": "all",

"orderBy": {"field": "openCard",

"mode": "asc"

},

"includeSubstitutedSKUs": true,

"includeSearchTexts": false,

"limit": 130,

"offset": 50

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"commonInfo": {"supplierRating": {"current": 5.3,

"dynamics": 5.4

},

"advertisedProducts": {"current": 5,

"dynamics": 50

},

"totalProducts": 150

},

"positionInfo": {"average": {"current": 5,

"dynamics": 50

},

"median": {"current": 5,

"dynamics": 50

},

"chartItems": [{"dt": "2024-10-19",\
\
"average": 1,\
\
"median": 1\
\
}\
\
],

"clusters": {"firstHundred": {"current": 5,

"dynamics": 50

},

"secondHundred": {"current": 5,

"dynamics": 50

},

"below": {"current": 5,

"dynamics": 50

}

}

},

"visibilityInfo": {"visibility": {"current": 5,

"dynamics": 50

},

"openCard": {"current": 5,

"dynamics": 50

},

"byDay": [{"dt": "2024-02-10",\
\
"visibility": 100,\
\
"open": 124\
\
}\
\
],

"byWeek": [{"dt": "2024-02-10",\
\
"visibility": 100,\
\
"open": 124\
\
}\
\
],

"byMonth": [{"dt": "2024-02-10",\
\
"visibility": 100,\
\
"open": 124\
\
}\
\
]

},

"groups": [{"subjectName": "Phones",\
\
"subjectId": 50,\
\
"brandName": "Apple",\
\
"tagName": "phones",\
\
"tagId": 65,\
\
"metrics": {"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
},\
\
"items": [{"nmId": 268913787,\
\
"name": "iPhone 13 256 ГБ Серебристый",\
\
"vendorCode": "wb3ha2668w",\
\
"subjectName": "Смартфоны",\
\
"brandName": "Apple",\
\
"mainPhoto": "https://basket-12.wbbasket.ru/vol1788/part178840/178840836/images/c246x328/1.webp",\
\
"isAdvertised": false,\
\
"isSubstitutedSKU": true,\
\
"isCardRated": true,\
\
"rating": 6,\
\
"feedbackRating": 1,\
\
"price": {"minPrice": 150,\
\
"maxPrice": 300\
\
},\
\
"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
}\
\
]\
\
}\
\
]

}

}`

## [tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1table~1groups/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1table~1groups/post) Pagination by Groups/api/v2/search-report/table/groups

posthttps://seller-analytics-api.wildberries.ru/api/v2/search-report/table/groups

https://seller-analytics-api.wildberries.ru/api/v2/search-report/table/groups

Method description

Pagination by groups in the report. It is possible only if there is a filter by brand, subject, or tag.

Additional parameters for selecting the list of products in the table:

- `positionCluster` — average position in search

The parameters `includeSubstitutedSKUs` and `includeSearchTexts` cannot both be set to `false`

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| currentPeriod<br>required | object (Period) <br>Current period |
| pastPeriod | object (pastPeriod) <br>Previous period for comparison. Number of days — less than or equal to `currentPeriod` |
| nmIds | Array of integers<int32>\[ items <int32 > \]<br>List of WB article numbers for filtering |
| subjectIds | Array of integers<int32>\[ items <int32 > \]<br>List of subject IDs for filtering |
| brandNames | Array of strings<br>List of brands for filtering |
| tagIds | Array of integers<int64>\[ items <int64 > \]<br>List of label IDs for filtering |
| orderBy<br>required | object (OrderByGrTe) <br>Sorting parameters |
| positionCluster<br>required | string (PositionCluster) <br>Enum:"all""firstHundred""secondHundred""below"<br>Which average search position of products to display in the report:<br>- `all` — all<br>- `firstHundred` — from 1 to 100<br>- `secondHundred` — from 101 to 200<br>- `below` — from 201 and below |
| includeSubstitutedSKUs | boolean<br>Default:true<br>Show data for direct queries with [promo items](https://seller.wildberries.ru/help-center/article/A-524) |
| includeSearchTexts | boolean<br>Default:true<br>Show data for search queries without promo items |
| limit<br>required | integer<uint32><= 1000<br>Number of product groups in the response |
| offset<br>required | integer<uint32><br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"pastPeriod": {"start": "2024-02-08",

"end": "2024-02-08"

},

"nmIds": [162579635,\
\
166699779\
\
],

"subjectIds": [64,\
\
334\
\
],

"brandNames": ["nille",\
\
"aikas"\
\
],

"tagIds": [32,\
\
53\
\
],

"orderBy": {"field": "avgPosition",

"mode": "asc"

},

"positionCluster": "all",

"includeSubstitutedSKUs": true,

"includeSearchTexts": false,

"limit": 130,

"offset": 50

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"groups": [{"subjectName": "Phones",\
\
"subjectId": 50,\
\
"brandName": "Apple",\
\
"tagName": "phones",\
\
"tagId": 65,\
\
"metrics": {"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
},\
\
"items": [{"nmId": 268913787,\
\
"name": "iPhone 13 256 ГБ Серебристый",\
\
"vendorCode": "wb3ha2668w",\
\
"subjectName": "Смартфоны",\
\
"brandName": "Apple",\
\
"mainPhoto": "https://basket-12.wbbasket.ru/vol1788/part178840/178840836/images/c246x328/1.webp",\
\
"isAdvertised": false,\
\
"isSubstitutedSKU": true,\
\
"isCardRated": true,\
\
"rating": 6,\
\
"feedbackRating": 1,\
\
"price": {"minPrice": 150,\
\
"maxPrice": 300\
\
},\
\
"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
}\
\
]\
\
}\
\
]

}

}`

## [tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1table~1details/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1table~1details/post) Pagination by Products Within a Group/api/v2/search-report/table/details

posthttps://seller-analytics-api.wildberries.ru/api/v2/search-report/table/details

https://seller-analytics-api.wildberries.ru/api/v2/search-report/table/details

Method description

Pagination by products within a group. It is possible regardless of the presence of filters.

Filters for pagination by products within a group or without filters:

- tuple `subjectId`, `brandName`, `tagId` — filter for the group
- `nmIds` — filter by nomenclature

Additional parameters for selecting the list of products in the table:

- `positionCluster` — average position in search

The parameters `includeSubstitutedSKUs` and `includeSearchTexts` cannot both be set to `false`

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| currentPeriod<br>required | object (Period) <br>Current period |
| pastPeriod | object (pastPeriod) <br>Previous period for comparison. Number of days — less than or equal to `currentPeriod` |
| subjectId | integer<int32><br>Subject ID |
| brandName | string<br>Product name |
| tagId | integer<int64><br>Label ID |
| nmIds | Array of integers<uint64><= 50 items\[ items <uint64 > \]<br>WB article numbers list |
| orderBy<br>required | object (OrderBy) <br>Параметры сортировки |
| positionCluster<br>required | string<br>Enum:"all""firstHundred""secondHundred""below"<br>Which average search position of products to display in the report:<br>- `all` — all<br>- `firstHundred` — from 1 to 100<br>- `secondHundred` — from 101 to 200<br>- `below` — from 201 and below |
| includeSubstitutedSKUs | boolean<br>Default:true<br>Show data for direct queries with [promo items](https://seller.wildberries.ru/help-center/article/A-524) |
| includeSearchTexts | boolean<br>Default:true<br>Show data for search queries without promo items |
| limit<br>required | integer<uint32><= 1000<br>Number of products in the response |
| offset<br>required | integer<uint32><br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"pastPeriod": {"start": "2024-02-08",

"end": "2024-02-08"

},

"subjectId": 123,

"brandName": "Apple",

"tagId": 45,

"nmIds": [162579635,\
\
166699779\
\
],

"orderBy": {"field": "openCard",

"mode": "asc"

},

"positionCluster": "all",

"includeSubstitutedSKUs": true,

"includeSearchTexts": false,

"limit": 150,

"offset": 100

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"products": [{"nmId": 268913787,\
\
"name": "iPhone 13 256 ГБ Серебристый",\
\
"vendorCode": "wb3ha2668w",\
\
"subjectName": "Смартфоны",\
\
"brandName": "Apple",\
\
"mainPhoto": "https://basket-12.wbbasket.ru/vol1788/part178840/178840836/images/c246x328/1.webp",\
\
"isAdvertised": false,\
\
"isSubstitutedSKU": true,\
\
"isCardRated": true,\
\
"rating": 6,\
\
"feedbackRating": 1,\
\
"price": {"minPrice": 150,\
\
"maxPrice": 300\
\
},\
\
"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
}\
\
]

}

}`

## [tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1product~1search-texts/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1product~1search-texts/post) Search Texts by Product/api/v2/search-report/product/search-texts

posthttps://seller-analytics-api.wildberries.ru/api/v2/search-report/product/search-texts

https://seller-analytics-api.wildberries.ru/api/v2/search-report/product/search-texts

Method description

Forms the top search texts by product.

Search text selection parameters:

- `limit` — number of queries, maximum 30 (for the [Advanced](https://seller.wildberries.ru/monetization/tariffs) tariff, the maximum is 100)
- `topOrderBy` — method for selecting the top queries

The parameters `includeSubstitutedSKUs` and `includeSearchTexts` cannot both be set to `false`

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| currentPeriod<br>required | object (Period) <br>Current period |
| pastPeriod | object (pastPeriod) <br>Previous period for comparison. Number of days — less than or equal to `currentPeriod` |
| nmIds<br>required | Array of integers<uint64><= 50 items\[ items <uint64 > \]<br>WB article numbers list |
| topOrderBy<br>required | string<br>Enum:"openCard""addToCart""openToCart""orders""cartToOrder"<br>Filtering by the search queries that brought the most:<br>- `openCard` — transitions to the product card<br>- `addToCart` — adding items to the cart<br>- `openToCart` — conversion to cart<br>- `orders` — ordered products<br>- `cartToOrder` — conversion to order |
| includeSubstitutedSKUs | boolean<br>Default:true<br>Show data for direct queries with [promo items](https://seller.wildberries.ru/help-center/article/A-524) |
| includeSearchTexts | boolean<br>Default:true<br>Show data for search queries without promo items |
| orderBy<br>required | object (OrderByGrTe) <br>Sorting parameters |
| limit<br>required | StandardTariff (integer) or AdvancedTariff (integer) (TextLimit) |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"pastPeriod": {"start": "2024-02-08",

"end": "2024-02-08"

},

"nmIds": [162579635,\
\
166699779\
\
],

"topOrderBy": "openToCart",

"includeSubstitutedSKUs": true,

"includeSearchTexts": false,

"orderBy": {"field": "avgPosition",

"mode": "asc"

},

"limit": 20

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"items": [{"text": "костюм",\
\
"nmId": 211131895,\
\
"subjectName": "Phones",\
\
"brandName": "Apple",\
\
"vendorCode": "wb3ha2668w",\
\
"name": "iPhone 13 256 ГБ Серебристый",\
\
"isCardRated": true,\
\
"rating": 6,\
\
"feedbackRating": 1,\
\
"price": {"minPrice": 150,\
\
"maxPrice": 300\
\
},\
\
"frequency": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"weekFrequency": 140,\
\
"medianPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"avgPosition": {"current": 5,\
\
"dynamics": 50\
\
},\
\
"openCard": {"current": 5,\
\
"dynamics": 50,\
\
"percentile": 50\
\
},\
\
"addToCart": {"current": 5,\
\
"dynamics": 50,\
\
"percentile": 50\
\
},\
\
"openToCart": {"current": 5,\
\
"dynamics": 50,\
\
"percentile": 50\
\
},\
\
"orders": {"current": 5,\
\
"dynamics": 50,\
\
"percentile": 50\
\
},\
\
"cartToOrder": {"current": 5,\
\
"dynamics": 50,\
\
"percentile": 50\
\
},\
\
"visibility": {"current": 5,\
\
"dynamics": 50\
\
}\
\
}\
\
]

}

}`

## [tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1product~1orders/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Search-Queries-for-Your-Items/paths/~1api~1v2~1search-report~1product~1orders/post) Orders and Positions by Product Search Texts/api/v2/search-report/product/orders

posthttps://seller-analytics-api.wildberries.ru/api/v2/search-report/product/orders

https://seller-analytics-api.wildberries.ru/api/v2/search-report/product/orders

Method description

Forms data for a table on the number of orders and positions by queries. The data is specified within a period for a specific product

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| period<br>required | object (PeriodOrdersRequest) <br>Current period. Maximum of 7 days |
| nmId<br>required | integer<uint64><br>WB article |
| searchTexts<br>required | Array of strings\[ 1 .. 30 \] items<br>Search texts. For the [Advanced](https://seller.wildberries.ru/monetization/tariffs) tariff, the maximum is 100 |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"period": {"start": "2024-02-10",

"end": "2024-02-10"

},

"nmId": 211131895,

"searchTexts": ["костюм",\
\
"пиджак"\
\
]

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"total": [{"dt": "2024-02-10",\
\
"avgPosition": 10,\
\
"orders": 20\
\
}\
\
],

"items": [{"text": "string",\
\
"frequency": 0,\
\
"dateItems": [{"dt": "2024-02-10",\
\
"avgPosition": 10,\
\
"orders": 20\
\
}\
\
]\
\
}\
\
]

}

}`

# [tag/Stocks-Report](https://dev.wildberries.ru/en/openapi/analytics\#tag/Stocks-Report) Stocks Report

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

These methods can be used to get a [report on inventory history](https://seller.wildberries.ru/content-analytics/history-remains).

This is information from the detailed product table and the region and warehouse detail widget.

The stocks in this version of the methods are for the current day.

## [tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1groups/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1groups/post) Group Data/api/v2/stocks-report/products/groups

posthttps://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/groups

https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/groups

Method description

Forms a dataset for inventory by product group.

The product group is described by a tuple of `subjectID, brandName, tagID`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| nmIDs | Array of integers<int64>\[ items <int64 > \]<br>List of WB article numbers for filtering |
| subjectIDs | Array of integers<int32>\[ items <int32 > \]<br>List of subject IDs for filtering |
| brandNames | Array of strings<br>List of brands for filtering |
| tagIDs | Array of integers<int64>\[ items <int64 > \]<br>List of label IDs for filtering |
| currentPeriod<br>required | object (PeriodSt) <br>Period |
| stockType<br>required | string (StockType) <br>Enum:"""wb""mp"<br>Type of products storage warehouse:<br>- `""` — all<br>- `wb` — WB warehouses<br>- `mp` — seller's warehouses |
| skipDeletedNm<br>required | boolean<br>To skip deleted product cards |
| availabilityFilters<br>required | Array of strings (availabilityFilters) <br>ItemsEnum:"deficient""actual""balanced""nonActual""nonLiquid""invalidData"<br>Доступность товара:<br>- `deficient` — Low stock<br>- `actual` — Selling well<br>- `balanced` — Selling steadily<br>- `nonActual` — Selling poorly<br>- `nonLiquid` — Struggling<br>- `invalidData` — Not calculated |
| orderBy<br>required | object (TableOrderBy) <br>Sorting parameters |
| limit | integer<uint32><= 1000<br>Default:100<br>Number of groups in the response |
| offset<br>required | integer<uint32><br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"nmIDs": [111222333,\
\
444555666\
\
],

"subjectIDs": [123,\
\
456\
\
],

"brandNames": ["Эрк",\
\
"Дент"\
\
],

"tagIDs": [3,\
\
4,\
\
5\
\
],

"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"stockType": "mp",

"skipDeletedNm": true,

"availabilityFilters": ["deficient",\
\
"balanced"\
\
],

"orderBy": {"field": "avgOrders",

"mode": "asc"

},

"limit": 150,

"offset": 100

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"groups": [{"subjectID": 123456789,\
\
"subjectName": "Кружка",\
\
"brandName": "Крутая посуда",\
\
"tagID": 12345,\
\
"tagName": "Человек-Паук",\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15\
\
},\
\
"items": [{"nmID": 123456789,\
\
"isDeleted": false,\
\
"subjectName": "Принтеры",\
\
"name": "Печатник 3000",\
\
"vendorCode": "pechatnik3000",\
\
"brandName": "Компик",\
\
"mainPhoto": "https://basket-12.wbbasket.ru/vol1788/part178840/178840836/images/c246x328/1.webp",\
\
"hasSizes": true,\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15,\
\
"currentPrice": {"minPrice": 50,\
\
"maxPrice": 100\
\
},\
\
"availability": "deficient"\
\
}\
\
}\
\
]\
\
}\
\
]

}

}`

## [tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1products/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1products/post) Product Data/api/v2/stocks-report/products/products

posthttps://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products

https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products

Method description

Forms a dataset for inventory by products.

You can get data for individual products as well as for the entire report if there are no filters in the query: `nmIDs`, `subjectID`, `brandName`, `tagID`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| nmIDs | Array of integers<int64>\[ items <int64 > \]<br>List of WB article numbers for filtering |
| subjectID | integer<int32><br>Subject ID |
| brandName | string<br>Brand |
| tagID | integer<int64><br>Tag ID |
| currentPeriod<br>required | object (PeriodSt) <br>Period |
| stockType<br>required | string (StockType) <br>Enum:"""wb""mp"<br>Type of products storage warehouse:<br>- `""` — all<br>- `wb` — WB warehouses<br>- `mp` — seller's warehouses |
| skipDeletedNm<br>required | boolean<br>To skip deleted product cards |
| orderBy<br>required | object (TableOrderBy) <br>Sorting parameters |
| availabilityFilters<br>required | Array of strings (availabilityFilters) <br>ItemsEnum:"deficient""actual""balanced""nonActual""nonLiquid""invalidData"<br>Доступность товара:<br>- `deficient` — Low stock<br>- `actual` — Selling well<br>- `balanced` — Selling steadily<br>- `nonActual` — Selling poorly<br>- `nonLiquid` — Struggling<br>- `invalidData` — Not calculated |
| limit | integer<uint32><= 1000<br>Default:100<br>Number of groups in the response |
| offset<br>required | integer<uint32><br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"nmIDs": [111222333,\
\
444555666\
\
],

"subjectID": 123456,

"brandName": "Спортик",

"tagID": 25345,

"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"stockType": "mp",

"skipDeletedNm": true,

"orderBy": {"field": "avgOrders",

"mode": "asc"

},

"availabilityFilters": ["deficient",\
\
"balanced"\
\
],

"limit": 150,

"offset": 100

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"items": [{"nmID": 123456789,\
\
"isDeleted": false,\
\
"subjectName": "Принтеры",\
\
"name": "Печатник 3000",\
\
"vendorCode": "pechatnik3000",\
\
"brandName": "Компик",\
\
"mainPhoto": "https://basket-12.wbbasket.ru/vol1788/part178840/178840836/images/c246x328/1.webp",\
\
"hasSizes": true,\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15,\
\
"currentPrice": {"minPrice": 50,\
\
"maxPrice": 100\
\
},\
\
"availability": "deficient"\
\
}\
\
}\
\
]

}

}`

## [tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1sizes/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1sizes/post) Size Data/api/v2/stocks-report/products/sizes

posthttps://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/sizes

https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/sizes

Method description

Forms a dataset for inventory by the size of the product.

Possible cases:

1. The product has dimensions and `"includeOffice":true`, then the response body will contain data on the inventory for each of the sizes with nested details by warehouse.
2. The product has dimensions and `"includeOffice":false`, then the response body will contain data on the inventory for each of the sizes without nested details by warehouse.
3. The product has no size and `"include Office":true`, then the response body will contain details by warehouse without data on the inventory for each of the sizes.
4. The product has no size and `"include Office":false`, then the response body will be empty.



`The product has no size` means the size of the product is the same and has `"techSize":"0"`. In responses of the method for obtaining data on [products](https://dev.wildberries.ru/en/openapi/analytics#tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1products~1products/post), such products have `hasSizes':false`.





The data on the seller's warehouses are in an aggregated form — for all of them together without detailing specific warehouses — and responses contain `"regionName":"Маркетплейс"` and `"officeName":""` in such cases.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| nmID<br>required | integer<int64><br>WB article |
| currentPeriod<br>required | object (PeriodSt) <br>Period |
| stockType<br>required | string (StockType) <br>Enum:"""wb""mp"<br>Type of products storage warehouse:<br>- `""` — all<br>- `wb` — WB warehouses<br>- `mp` — seller's warehouses |
| orderBy<br>required | object (TableOrderBy) <br>Sorting parameters |
| includeOffice<br>required | boolean<br>Include warehouse details |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"nmID": 123456789,

"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"stockType": "mp",

"orderBy": {"field": "avgOrders",

"mode": "asc"

},

"includeOffice": true

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"offices": [{"regionName": "Центральный",\
\
"officeID": 123456,\
\
"officeName": "Коледино",\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15\
\
}\
\
}\
\
],

"sizes": [{"name": "50",\
\
"chrtID": 123321,\
\
"offices": [{"regionName": "Центральный",\
\
"officeID": 123456,\
\
"officeName": "Коледино",\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15\
\
}\
\
}\
\
],\
\
"metrics": {"ordersCount": 100,\
\
"ordersSum": 100000,\
\
"avgOrders": 200,\
\
"avgOrdersByMonth": [{"start": "2025-01-01",\
\
"end": "2025-01-31",\
\
"value": 25.55\
\
}\
\
],\
\
"buyoutCount": 150,\
\
"buyoutSum": 150000,\
\
"buyoutPercent": 5,\
\
"stockCount": 50,\
\
"stockSum": 50000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"avgStockTurnover": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 20,\
\
"fromClientCount": 30,\
\
"officeMissingTime": {"days": 5,\
\
"hours": 15\
\
},\
\
"lostOrdersCount": 1550.52,\
\
"lostOrdersSum": 155000.25,\
\
"lostBuyoutsCount": 123.55,\
\
"lostBuyoutsSum": 225555.15,\
\
"currentPrice": {"minPrice": 50,\
\
"maxPrice": 100\
\
}\
\
}\
\
}\
\
]

}

}`

## [tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1offices/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Stocks-Report/paths/~1api~1v2~1stocks-report~1offices/post) Warehouse Data/api/v2/stocks-report/offices

posthttps://seller-analytics-api.wildberries.ru/api/v2/stocks-report/offices

https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/offices

Method description

Forms a dataset for inventory by warehouses.

The data on the seller's warehouses are in an aggregated form — for all of them together without detailing specific warehouses — and responses contain `"regionName":"Маркетплейс"` and `"offices":[]`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| nmIDs | Array of integers<int64>\[ items <int64 > \]<br>List of WB article numbers for filtering |
| subjectIDs | Array of integers<int32>\[ items <int32 > \]<br>List of subject IDs for filtering |
| brandNames | Array of strings<br>List of brands for filtering |
| tagIDs | Array of integers<int64>\[ items <int64 > \]<br>List of label IDs for filtering |
| currentPeriod<br>required | object (PeriodSt) <br>Period |
| stockType<br>required | string (StockType) <br>Enum:"""wb""mp"<br>Type of products storage warehouse:<br>- `""` — all<br>- `wb` — WB warehouses<br>- `mp` — seller's warehouses |
| skipDeletedNm<br>required | boolean<br>To skip deleted product cards |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"nmIDs": [111222333,\
\
444555666\
\
],

"subjectIDs": [123,\
\
456\
\
],

"brandNames": ["Эшк",\
\
"ЗлатА",\
\
"ОТК",\
\
"арк"\
\
],

"tagIDs": [123,\
\
456,\
\
789\
\
],

"currentPeriod": {"start": "2024-02-10",

"end": "2024-02-10"

},

"stockType": "mp",

"skipDeletedNm": false

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"regions": [{"regionName": "Центральный",\
\
"metrics": {"stockCount": 20,\
\
"stockSum": 20000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 30,\
\
"fromClientCount": 40\
\
},\
\
"offices": [{"officeID": 123456,\
\
"officeName": "Коледино",\
\
"metrics": {"stockCount": 20,\
\
"stockSum": 20000,\
\
"saleRate": {"days": 5,\
\
"hours": 15\
\
},\
\
"toClientCount": 30,\
\
"fromClientCount": 40\
\
}\
\
}\
\
]\
\
}\
\
]

}

}`

# [tag/Seller-Analytics-CSV](https://dev.wildberries.ru/en/openapi/analytics\#tag/Seller-Analytics-CSV) Seller Analytics CSV

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

You can use these methods — except for stocks report — only with [Jam](https://seller.wildberries.ru/monetization/jam) subscription.

To get a report:

1. Generate it using the method [Create the report](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post).
2. Wait until the report is ready. You can check the status with the method [Get the reports list](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/get). The report is stored for 48 hours after it is ready, and it cannot be retrieved after.


    If you receive a status of FAILED, [regenerate the report](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1retry/post).
3. [Download the report](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1file~1%7BdownloadId%7D/get).

You can obtain a report for a maximum of one year.

The maximum number of reports that can be generated per day is 20

## [tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post) Create the Report/api/v2/nm-report/downloads

posthttps://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads

https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads

Method description

The method creates a task for generating a report with advanced seller analytics.

You can create a CSV-version of [sales funnel](https://dev.wildberries.ru/en/openapi/analytics#tag/Sales-Funnel) or [search parameters](https://dev.wildberries.ru/en/openapi/analytics#tag/Search-Queries) report with grouping:

- by WB articles
- by categories, brands, and labels

In each of reports on sales funnel, you can group data by days, weeks, or months.

Also you can create a CSV-version of [search texts](https://dev.wildberries.ru/en/openapi/analytics#tag/Search-Queries/paths/~1api~1v2~1search-report~1product~1search-texts/post) or [stocks](https://dev.wildberries.ru/en/openapi/analytics#tag/Stocks-Report) report.

The set of parameters in the `params` object depends on the report type. To get a description of the parameters, select the report type from the dropdown list in the description of the `reportType` parameter.

The parameters `includeSubstitutedSKUs` and `includeSearchTexts` cannot both be set to `false`

If it was not possible to [obtain report](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1file~1%7BdownloadId%7D/get), you can create a [repeat generation task](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1retry/post). You can also [get a list and check the statuses](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/get) of reports.

[Stocks report](https://seller.wildberries.ru/content-analytics/history-remains) — the `STOCK_HISTORY_REPORT_CSV` type — can be created without [Jam](https://seller.wildberries.ru/monetization/jam) subscription

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| id<br>required | string<uuid><br>Report ID in UUID format. Generated by the seller independently |
| reportType<br>required | string<br>Report type `DETAIL_HISTORY_REPORT` — Sales funnel report. By WB articles<br>DETAIL\_HISTORY\_REPORTGROUPED\_HISTORY\_REPORTSEARCH\_QUERIES\_PREMIUM\_REPORT\_GROUPSEARCH\_QUERIES\_PREMIUM\_REPORT\_PRODUCTSEARCH\_QUERIES\_PREMIUM\_REPORT\_TEXTSTOCK\_HISTORY\_REPORT\_CSVDETAIL\_HISTORY\_REPORT |
| userReportName | string<br>Report name. If not specified, it will be generated automatically |
| params<br>required | object<br>Report parameters |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Example

SalesFunnelProductReqSalesFunnelGroupReqSearchReportGroupReqSearchReportProductReqSearchReportTextReqStocksReportReqSalesFunnelProductReq

Sales funnel report. By WB articles

Copy
ExpandCollapse

`{"id": "06eae887-9d9f-491f-b16a-bb1766fcb8d2",

"reportType": "DETAIL_HISTORY_REPORT",

"userReportName": "Card report",

"params": {"nmIDs": [1234567\
\
],

"subjectIds": [1234567\
\
],

"brandNames": ["Name"\
\
],

"tagIds": [1234567\
\
],

"startDate": "2024-06-21",

"endDate": "2024-06-23",

"timezone": "Europe/Moscow",

"aggregationLevel": "day",

"skipDeletedNm": false

}

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"data": "Created"

}`

## [tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/get](https://dev.wildberries.ru/en/openapi/analytics\#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/get) Get the Reports List/api/v2/nm-report/downloads

gethttps://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads

https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads

Method description

The method provides a list of reports with advanced seller analytics. The response contains [report IDs](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post) and generation statuses.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| filter\[downloadIds\] | Array of strings<uuid>\[ items <uuid > \]<br>Report ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": [{"id": "06eae887-9d9f-491f-b16a-bb1766fcb8d2",\
\
"createdAt": "2024-06-26 20:05:32",\
\
"status": "SUCCESS",\
\
"name": "Card report",\
\
"size": 123,\
\
"startDate": "2024-06-21",\
\
"endDate": "2023-04-23"\
\
}\
\
]

}`

## [tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1retry/post](https://dev.wildberries.ru/en/openapi/analytics\#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1retry/post) Regenerate the Report/api/v2/nm-report/downloads/retry

posthttps://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/retry

https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/retry

Method description

The method creates a [repeated generation task](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post) of report with advanced seller analytics. This is necessary if you [received the status](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/get)`FAILED` when generating the report.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| downloadId | string<uuid><br>Report ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"downloadId": "06eea887-9d9f-491f-b16a-bb1766fcb8d2"

}`

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"data": "Retry"

}`

## [tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1file~1{downloadId}/get](https://dev.wildberries.ru/en/openapi/analytics\#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads~1file~1{downloadId}/get) Get the Report/api/v2/nm-report/downloads/file/{downloadId}

gethttps://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/file/{downloadId}

https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/file/{downloadId}

Method description

The method provides a report with advanced seller analytics by [generation task](https://dev.wildberries.ru/en/openapi/analytics#tag/Seller-Analytics-CSV/paths/~1api~1v2~1nm-report~1downloads/post) ID.

You can get a report that was generated within the last 48 hours.

The report will be downloaded inside a ZIP archive in CSV format.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 3 requests |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| downloadId<br>required | string<uuid><br>Report ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 429

Content type

application/zip

Example

SalesFunnelProductResSalesFunnelGroupResSearchReportGroupResSearchReportProductResSearchReportTextResStocksReportResSalesFunnelProductRes

Copy

```
nmID, dt, openCardCount, addToCartCount, ordersCount, ordersSumRub, buyoutsCount, buyoutsSumRub, cancelCount, cancelSumRub, addToCartConversion, cartToOrderConversion, buyoutPercent, addToWishlist
70027655,2024-11-21,1,0,0,0,0,0,0,0,0,0,0,0
...
...
150317666,2024-11-21,2,0,0,0,0,0,0,0,0,0,0,0
```

We use [cookies](https://dev.wildberries.ru/privacy) to collect statistics and improve our service

Accept

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Analytics
- **⚠️ Требует подписку "Джем"** для доступа к методам
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/analytics

