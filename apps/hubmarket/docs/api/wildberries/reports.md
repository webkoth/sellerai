# Reports API

> **Base URL:** `https://statistics-api.wildberries.ru`
> **Rate Limits:** 60 req/60s, interval 1000ms, burst 5
> **Документация:** https://dev.wildberries.ru/openapi/reports
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Отчёты по продажам, остаткам, маркировке, хранению, регионам

---

## Документация API

Search

- Reports
- Main Reports
  - getSupplies{{ /api/v1/supplier/incomes }}
  - getWarehouse{{ /api/v1/supplier/stocks }}
  - getOrders{{ /api/v1/supplier/orders }}
  - getSales{{ /api/v1/supplier/sales }}
- Warehouses Remains Report
  - getCreate the Report{{ /api/v1/warehouse\_remains }}
  - getCheck the Status{{ /api/v1/warehouse\_remains/tasks/{task\_id}/status }}
  - getGet the Report{{ /api/v1/warehouse\_remains/tasks/{task\_id}/download }}
- Report on Products with Mandatory Labeling
  - postReport on Products with Mandatory Labeling{{ /api/v1/analytics/excise-report }}
- Retention Reports
  - getUnderreporting of Package Dimensions{{ /api/v1/analytics/warehouse-measurements }}
  - getSubstitutions and Incorrect Attachments{{ /api/analytics/v1/deductions }}
  - getSelf-purchases{{ /api/v1/analytics/antifraud-details }}
  - getSubstitutions{{ /api/v1/analytics/incorrect-attachments }}
  - getProduct Labeling{{ /api/v1/analytics/goods-labeling }}
  - getCharacteristics Change{{ /api/v1/analytics/characteristics-change }}
- Paid Reception
  - getCreate the Report{{ /api/v1/acceptance\_report }}
  - getCheck the Status{{ /api/v1/acceptance\_report/tasks/{task\_id}/status }}
  - getGet the Report{{ /api/v1/acceptance\_report/tasks/{task\_id}/download }}
- Paid Storage
  - getGenerate the Report{{ /api/v1/paid\_storage }}
  - getCheck the Status{{ /api/v1/paid\_storage/tasks/{task\_id}/status }}
  - getGet the Report{{ /api/v1/paid\_storage/tasks/{task\_id}/download }}
- Sales by Regions
  - getGet Report{{ /api/v1/analytics/region-sale }}
- Share of Brand in Sales
  - getSeller Brands{{ /api/v1/analytics/brand-share/brands }}
  - getParent Categories of the Brand{{ /api/v1/analytics/brand-share/parent-subjects }}
  - getGet Report{{ /api/v1/analytics/brand-share }}
- Hidden Products
  - getBlocked Product Cards{{ /api/v1/analytics/banned-products/blocked }}
  - getHidden from the Catalog{{ /api/v1/analytics/banned-products/shadowed }}
- Goods Return Report
  - getGet Report{{ /api/v1/analytics/goods-return }}

[![redocly logo](https://cdn.redoc.ly/redoc/logo-mini.svg)API docs by Redocly](https://redocly.com/redoc/)

# Reports(reports)

Reports on products, retentions, paid reception, and paid storage

# [tag/Reports](https://dev.wildberries.ru/en/openapi/reports\#tag/Reports) Reports

Reports on products, retentions, paid reception, and paid storage

# [tag/Main-Reports](https://dev.wildberries.ru/en/openapi/reports\#tag/Main-Reports) Main Reports

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Statistics** category

You can save reports in Excel format

## [tag/Main-Reports/paths/~1api~1v1~1supplier~1incomes/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Main-Reports/paths/~1api~1v1~1supplier~1incomes/get) Supplies{{ /api/v1/supplier/incomes }}

get/api/v1/supplier/incomes

https://statistics-api.wildberries.ru/api/v1/supplier/incomes

Описание метода

Supplies of goods for storage in Wildberries warehouses.

The data is updated every 30 minutes.

For a single response, a conditional limit of 100,000 rows is set. Therefore, more than one request may be necessary to retrieve all supplies. In the second and subsequent requests, use the full value of the `lastChangeDate` field of the last row from the response of the previous request in the `dateFrom` parameter.

If the response returns an empty array `[]`, all supplies have already been retrieved.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date-time><br>Date and time of last change on the supplie.<br>Date format: RFC3339. You may send date or date with time.<br>Time could be specified in seconds or milliseconds.<br>The time stands in Moscow time zone (UTC+3).<br>Examples:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"incomeId": 12345,\
\
"number": "",\
\
"date": "2022-05-08T00:00:54",\
\
"lastChangeDate": "2022-05-08T00:44:15.5",\
\
"supplierArticle": "ABCDEF",\
\
"techSize": "0",\
\
"barcode": "2000328074123",\
\
"quantity": 3,\
\
"totalPrice": 0,\
\
"dateClose": "2022-05-08T00:00:00",\
\
"warehouseName": "Подольск",\
\
"nmId": 1234567,\
\
"status": "Принято"\
\
}\
\
]`

## [tag/Main-Reports/paths/~1api~1v1~1supplier~1stocks/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Main-Reports/paths/~1api~1v1~1supplier~1stocks/get) Warehouse{{ /api/v1/supplier/stocks }}

get/api/v1/supplier/stocks

https://statistics-api.wildberries.ru/api/v1/supplier/stocks

Описание метода

WB product stock.

The data is updated every 30 minutes.

The statistics service does not keep a history of the product stock, so you can only retrieve data about them in real time mode.

For a single response, a conditional limit of 60,000 rows is set. Therefore, more than one request may be necessary to retrieve all leftovers. In the second and subsequent requests, use the full value of the `lastChangeDate` field of the last row from the response of the previous request in the `dateFrom` parameter.

If the response returns an empty array `[]`, all stocks have already been retrieved.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date-time><br>Date and time of last change on the product.<br>The earliest possible value should be entered to get the total leftover, e.g. `2019-06-20`.<br>Date format: RFC3339. You may send date or date with time.<br>Time could be specified in seconds or milliseconds.<br>The time stands in Moscow time zone (UTC+3).<br>Examples:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"lastChangeDate": "2023-07-05T11:13:35",\
\
"warehouseName": "Краснодар",\
\
"supplierArticle": "443284",\
\
"nmId": 1439871458,\
\
"barcode": "2037401340280",\
\
"quantity": 33,\
\
"inWayToClient": 1,\
\
"inWayFromClient": 0,\
\
"quantityFull": 34,\
\
"category": "Посуда и инвентарь",\
\
"subject": "Формы для запекания",\
\
"brand": "X",\
\
"techSize": "0",\
\
"Price": 185,\
\
"Discount": 0,\
\
"isSupply": true,\
\
"isRealization": false,\
\
"SCCode": "Tech"\
\
}\
\
]`

## [tag/Main-Reports/paths/~1api~1v1~1supplier~1orders/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Main-Reports/paths/~1api~1v1~1supplier~1orders/get) Orders{{ /api/v1/supplier/orders }}

get/api/v1/supplier/orders

https://statistics-api.wildberries.ru/api/v1/supplier/orders

Описание метода

Orders.

Data storage is guaranteed for no more than 90 days from the date of sale.

The data updated every 30 minutes.

The `srid` field should be used to identify the order.

1 line means 1 order and means 1 item.

For a single response to a request with `flag=0` or without `flag`, a conditional limit of 80,000 rows is set. Therefore, more than one request may be necessary to retrieve all orders. In the second and subsequent requests, use the full value of the `lastChangeDate` field of the last row from the response of the previous request in the `dateFrom` parameter.

If the response returns an empty array `[]`, all orders have already been retrieved.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date-time><br>Date and time of last change on the order.<br>Date format: RFC3339. You may send date or date with time.<br>Time could be specified in seconds or milliseconds.<br>The time stands in Moscow time zone (UTC+3).<br>Examples:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |
| flag | integer<br>Default:0<br>If parameter `flag=0` (or it doesn't exist in requests string), then call of API methods returns data,<br>which value of field `lastChangeDate` (date and time of refreshing info of service) is greater or equal to the given<br>parameter value `dateFrom`.<br>In this case the number of returned rows of data varies from 0 to approximately 100,000.<br>If parameter `flag=1`, then information about all orders or sales with the date will be uploaded,<br>that equals to the passed parameter `dateFrom` (in this case the time in the date doesn't matter).<br>Also the number of returned rows of data will be equal to the number of all orders or sales<br>that were made on the specified date, passed in the `dateFrom` parameter. |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"date": "2022-03-04T18:08:31",\
\
"lastChangeDate": "2022-03-06T10:11:07",\
\
"warehouseName": "Подольск",\
\
"warehouseType": "Склад продавца",\
\
"countryName": "Россия",\
\
"oblastOkrugName": "Центральный федеральный округ",\
\
"regionName": "Московская",\
\
"supplierArticle": "12345",\
\
"nmId": 1234567,\
\
"barcode": "123453559000",\
\
"category": "Бытовая техника",\
\
"subject": "Мультистайлеры",\
\
"brand": "Тест",\
\
"techSize": "0",\
\
"incomeID": 56735459,\
\
"isSupply": false,\
\
"isRealization": true,\
\
"totalPrice": 1887,\
\
"discountPercent": 18,\
\
"spp": 26,\
\
"finishedPrice": 1145,\
\
"priceWithDisc": 1547,\
\
"isCancel": true,\
\
"cancelDate": "2022-03-09T00:00:00",\
\
"sticker": "926912515",\
\
"gNumber": "34343462218572569531",\
\
"srid": "11.rf9ef11fce1684117b0nhj96222982382.3.0"\
\
}\
\
]`

## [tag/Main-Reports/paths/~1api~1v1~1supplier~1sales/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Main-Reports/paths/~1api~1v1~1supplier~1sales/get) Sales{{ /api/v1/supplier/sales }}

get/api/v1/supplier/sales

https://statistics-api.wildberries.ru/api/v1/supplier/sales

Описание метода

Sales and returns.

Data storage is guaranteed for no more than 90 days from the date of sale.

The data updated every 30 minutes.

The `srid` field should be used to identify the order.

1 line means 1 sale/return and means 1 item.

For a single response to a request with `flag=0` or without `flag`, a conditional limit of 80,000 rows is set. Therefore, more than one request may be necessary to retrieve all sales and returns. In the second and subsequent requests, use the full value of the `lastChangeDate` field of the last row from the response of the previous request in the `dateFrom` parameter.

If the response returns an empty array `[]`, all sales and returns have already been retrieved.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date-time><br>Date and time of last change on the sale/return.<br>Date format: RFC3339. You may send date or date with time.<br>Time could be specified in seconds or milliseconds.<br>The time stands in Moscow time zone (UTC+3).<br>Examples:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |
| flag | integer<br>Default:0<br>If parameter `flag=0` (or it doesn't exist in requests string), then call of API methods returns data,<br>which value of field `lastChangeDate` (date and time of refreshing info of service) is greater or equal to the given<br>parameter value `dateFrom`.<br>In this case the number of returned rows of data varies from 0 to approximately 100,000.<br>If parameter `flag=1`, then information about all orders or sales with the date will be uploaded,<br>that equals to the passed parameter `dateFrom` (in this case the time in the date doesn't matter).<br>Also the number of returned rows of data will be equal to the number of all orders or sales<br>that were made on the specified date, passed in the `dateFrom` parameter. |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"date": "2022-03-04T18:08:31",\
\
"lastChangeDate": "2022-03-06T10:11:07",\
\
"warehouseName": "Подольск",\
\
"warehouseType": "Склад продавца",\
\
"countryName": "Россия",\
\
"oblastOkrugName": "Центральный федеральный округ",\
\
"regionName": "Московская",\
\
"supplierArticle": "12345",\
\
"nmId": 1234567,\
\
"barcode": "123453559000",\
\
"category": "Бытовая техника",\
\
"subject": "Мультистайлеры",\
\
"brand": "Тест",\
\
"techSize": "0",\
\
"incomeID": 56735459,\
\
"isSupply": false,\
\
"isRealization": true,\
\
"totalPrice": 1887,\
\
"discountPercent": 18,\
\
"spp": 20,\
\
"paymentSaleAmount": 93,\
\
"forPay": 1284.01,\
\
"finishedPrice": 1145,\
\
"priceWithDisc": 1547,\
\
"saleID": "S9993700024",\
\
"sticker": "926912515",\
\
"gNumber": "34343462218572569531",\
\
"srid": "11.rf9ef11fce1684117b0nhj96222982382.3.0"\
\
}\
\
]`

# [tag/Warehouses-Remains-Report](https://dev.wildberries.ru/en/openapi/reports\#tag/Warehouses-Remains-Report) Warehouses Remains Report

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

To get the report on [WB warehouses remains](https://seller.wildberries.ru/analytics-reports/warehouse-remains):

1. [Create the report](https://dev.wildberries.ru/en/openapi/reports#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains/get).
2. Wait for the report to be ready. You can [check the status](https://dev.wildberries.ru/en/openapi/reports#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1%7Btask_id%7D~1status/get) of the report readiness. The ready report is stored for 2 hours.
3. [Get the report](https://dev.wildberries.ru/en/openapi/reports#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1%7Btask_id%7D~1download/get).

## [tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains/get) Create the Report{{ /api/v1/warehouse\_remains }}

get/api/v1/warehouse\_remains

https://seller-analytics-api.wildberries.ru/api/v1/warehouse\_remains

Описание метода

Creates a task for report generation. The parameters `groupBy` and `filter` can be set in any combination — similar to the [version](https://seller.wildberries.ru/analytics-reports/warehouse-remains) in the personal account.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| locale | string<br>Default:"ru"<br>Example:locale=ru<br>Language of the `subjectName` and `warehouseName` response fields:<br>- `ru` — Russian<br>- `en` — English<br>- `zh` — Chinese. Values of the `warehouseName` are in English |
| groupByBrand | boolean<br>Default:false<br>Example:groupByBrand=true<br>Group by brand |
| groupBySubject | boolean<br>Default:false<br>Example:groupBySubject=true<br>Group by subject |
| groupBySa | boolean<br>Default:false<br>Example:groupBySa=true<br>Group by seller's article |
| groupByNm | boolean<br>Default:false<br>Example:groupByNm=true<br>Group by WB article. If `groupByNm=true`, there will be `volume` field in the response |
| groupByBarcode | boolean<br>Default:false<br>Example:groupByBarcode=true<br>Group by barcode |
| groupBySize | boolean<br>Default:false<br>Example:groupBySize=true<br>Group by size |
| filterPics | integer<br>Default:0<br>Example:filterPics=1<br>Photo filter:<br>- `-1` — without photo<br>- `0` — do not apply filter<br>- `1` — with photo |
| filterVolume | integer<br>Default:0<br>Example:filterVolume=3<br>Volume filter:<br>- `-1` — without dimensions<br>- `0` — do not apply filter<br>- `3` — over three liters |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"taskId": "219eaecf-e532-4bd8-9f15-8036ec1b042d"

}

}`

## [tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1{task_id}~1status/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1{task_id}~1status/get) Check the Status{{ /api/v1/warehouse\_remains/tasks/{task\_id}/status }}

get/api/v1/warehouse\_remains/tasks/{task\_id}/status

https://seller-analytics-api.wildberries.ru/api/v1/warehouse\_remains/tasks/{task\_id}/status

Описание метода

Returns the status of the generation task

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 seconds | 1 request | 5 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Generation task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"id": "cad56ec5-91ec-43a2-b5e8-efcf244cf309",

"status": "done"

}

}`

## [tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1{task_id}~1download/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Warehouses-Remains-Report/paths/~1api~1v1~1warehouse_remains~1tasks~1{task_id}~1download/get) Get the Report{{ /api/v1/warehouse\_remains/tasks/{task\_id}/download }}

get/api/v1/warehouse\_remains/tasks/{task\_id}/download

https://seller-analytics-api.wildberries.ru/api/v1/warehouse\_remains/tasks/{task\_id}/download

Описание метода

Returns the report by task ID

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Generation task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"brand": "Wonderful",\
\
"subjectName": "Фотоальбомы",\
\
"vendorCode": "41058/прозрачный",\
\
"nmId": 183804172,\
\
"barcode": "2037031652319",\
\
"techSize": "0",\
\
"volume": 1.33,\
\
"warehouses": [{"warehouseName": "В пути до получателей",\
\
"quantity": 14\
\
},\
\
{"warehouseName": "В пути возвраты на склад WB",\
\
"quantity": 4\
\
},\
\
{"warehouseName": "Всего находится на складах",\
\
"quantity": 267\
\
},\
\
{"warehouseName": "Невинномысск",\
\
"quantity": 134\
\
},\
\
{"warehouseName": "Коледино",\
\
"quantity": 133\
\
}\
\
]\
\
}\
\
]`

# [tag/Report-on-Products-with-Mandatory-Labeling](https://dev.wildberries.ru/en/openapi/reports\#tag/Report-on-Products-with-Mandatory-Labeling) Report on Products with Mandatory Labeling

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

## [tag/Report-on-Products-with-Mandatory-Labeling/paths/~1api~1v1~1analytics~1excise-report/post](https://dev.wildberries.ru/en/openapi/reports\#tag/Report-on-Products-with-Mandatory-Labeling/paths/~1api~1v1~1analytics~1excise-report/post) Report on Products with Mandatory Labeling{{ /api/v1/analytics/excise-report }}

post/api/v1/analytics/excise-report

https://seller-analytics-api.wildberries.ru/api/v1/analytics/excise-report

Описание метода

Returns operations with labeled products

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 hours | 10 requests | 30 minutes | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

##### Request Body schema: application/json  optional

|     |     |
| --- | --- |
| countries | Array of strings<br>ItemsEnum:"AM""BY""KG""KZ""RU""UZ"<br>Country code in according with ISO 3166-2. Set the empty parameter to get data without filters by country |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{"countries": ["AM",\
\
"RU"\
\
]

}`

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"response": {"data": [{"name": "Россия",\
\
"price": 100,\
\
"currency_name_short": "AMD",\
\
"excise_short": "0102900254680370215_Re/=lSbNiGD",\
\
"barcode": 2038893425820,\
\
"nm_id": 169085355,\
\
"operation_type_id": 1,\
\
"fiscal_doc_number": 12345678,\
\
"fiscal_dt": "2024-01-01",\
\
"fiscal_drive_number": "string",\
\
"rid": 606217433440,\
\
"srid": "7513432034713632943.1.0"\
\
}\
\
]

}

}`

# [tag/Retention-Reports](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports) Retention Reports

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

## [tag/Retention-Reports/paths/~1api~1v1~1analytics~1warehouse-measurements/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/paths/~1api~1v1~1analytics~1warehouse-measurements/get) Underreporting of Package Dimensions{{ /api/v1/analytics/warehouse-measurements }}

get/api/v1/analytics/warehouse-measurements

https://seller-analytics-api.wildberries.ru/api/v1/analytics/warehouse-measurements

Описание метода

The method returns reports with [logistics and storage costs multiplier](https://seller.wildberries.ru/analytics-reports/dimensions-penalties), and [warehouse measurements](https://seller.wildberries.ru/analytics-reports/dimensions-penalties/warehouse-measurements)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 5 requests | 12 seconds | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom | string<date-time><br>Example:dateFrom=2025-02-01T15:00:00Z<br>Report period start. By default the date when data for the report was first received is used |
| dateTo<br>required | string<date-time><br>Example:dateTo=2025-10-11T18:00:00Z<br>Report period end |
| tab<br>required | string<br>Enum:"penalty""measurement"<br>Example:tab=measurement<br>Report type:<br>- `penalty` — Logistics and storage costs multiplier<br>- `measurement` — Warehouse measurements |
| limit<br>required | integer<= 1000<br>Example:limit=330<br>Number of retentions or measurements in the response |
| offset | integer<br>Default:0<br>Example:offset=220<br>How many results to skip. For example, with value `10`, the response will start with the 11 element |

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

Example

PenaltyMeasurementPenalty

Logistics and storage costs multiplier

Copy
Expand all  Collapse all

`{"data": {"reports": [{"nmId": 9234567890,\
\
"subject": "Костюмы спортивные",\
\
"dimId": 98151405,\
\
"prcOver": 130.71,\
\
"volume": 6.47,\
\
"width": 7,\
\
"length": 28,\
\
"height": 33,\
\
"volumeSup": 4.95,\
\
"widthSup": 30,\
\
"lengthSup": 33,\
\
"heightSup": 5,\
\
"photoUrls": ["https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/measurement_on_table/wbs35154094220_em907759_n1_b2eaa5ed-bf21-4c58-b419-b5b5ec6f29ee.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/measurement_on_table/wbs35159094420_em907759_n2_040407b0-7752-4ae7-a4a4-7ec016e86511.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/measurement_on_table/wbs35189094220_em904757_n3_9f502e24-3b3e-4efd-9hac-802813046ac3.webp"\
\
],\
\
"dtBonus": "2025-06-02T00:00:00Z",\
\
"isValid": true,\
\
"isValidDt": "2025-05-29T13:35:57Z",\
\
"reversalAmount": 0,\
\
"penaltyAmount": 449.83\
\
},\
\
{"nmId": 9123456789,\
\
"subject": "Масло топленое",\
\
"dimId": 97079587,\
\
"prcOver": 136.09,\
\
"volume": 4.37,\
\
"width": 14,\
\
"length": 24,\
\
"height": 13,\
\
"volumeSup": 3.21,\
\
"widthSup": 13,\
\
"lengthSup": 13,\
\
"heightSup": 19,\
\
"photoUrls": ["https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35619967012_em1178949_nphotoA_d037721f-62c2-4bdd-a5a8-4ad0905e3f8e.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35619967012_em1178949_nphotoB_fb161a65-e4b0-08d7-bb01-1bdba1b4d741.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35619967012_em1178949_nphotoC_9a8b10f7-26c4-4fc0-b2c5-a7e29a545aa4.webp"\
\
],\
\
"dtBonus": "2025-06-02T00:00:00Z",\
\
"isValid": true,\
\
"isValidDt": "2025-05-23T01:24:19Z",\
\
"reversalAmount": 0,\
\
"penaltyAmount": 350.08\
\
},\
\
{"nmId": 9234567809,\
\
"subject": "Фонарики бытовые",\
\
"dimId": 96989876,\
\
"prcOver": 246.75,\
\
"volume": 2.28,\
\
"width": 12,\
\
"length": 19,\
\
"height": 10,\
\
"volumeSup": 0.92,\
\
"widthSup": 11,\
\
"lengthSup": 14,\
\
"heightSup": 6,\
\
"photoUrls": ["https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35776508795_em644504_nphotoA_1bdac868-a6c0-435a-950f-489f74acdb2e.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35776508795_em644504_nphotoB_8f1802b8-5552-4aae-b930-19e8efbee597.webp",\
\
"https://static-basket-09.wbbasket.ru/vol184/obmer-tovarov/handheld-goods-measurements-photo/gId35776508795_em644504_nphotoC_5d8f1832-e219-46cd-931b-d6d238d6784b.webp"\
\
],\
\
"dtBonus": "2025-06-02T00:00:00Z",\
\
"isValid": true,\
\
"isValidDt": "2025-05-23T01:24:19Z",\
\
"reversalAmount": 0,\
\
"penaltyAmount": 501.6\
\
}\
\
],

"totalCount": 3

}

}`

## [tag/Retention-Reports/operation/getDeductions](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/operation/getDeductions) Substitutions and Incorrect Attachments{{ /api/analytics/v1/deductions }}

get/api/analytics/v1/deductions

https://seller-analytics-api.wildberries.ru/api/analytics/v1/deductions

Описание метода

The method returns a report with [substitutions and incorrect attachments](https://seller.wildberries.ru/analytics-reports/dimensions-penalties/retentions) retentions

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom | string<date-time><br>Example:dateFrom=2025-02-01T15:00:00Z<br>Report period start. By default the date and time when data for the report was first received is used |
| dateTo<br>required | string<date-time><br>Example:dateTo=2025-10-11T18:00:00Z<br>Report period end |
| sort | string<br>Default:"dtBonus"<br>Enum:"nmId""dtBonus""bonusSumm"<br>Example:sort=nmId<br>Sorting:<br>- `nmId` — by Wildberries article<br>- `dtBonus` — by fine date and time<br>- `bonusSumm` — by fine amount |
| order | string<br>Default:"desc"<br>Enum:"desc""asc"<br>Example:order=asc<br>Data order:<br>- `desc` — descending<br>- `asc` — ascending |
| limit<br>required | integer<= 1000<br>Example:limit=330<br>Number of retentions in the response |
| offset | integer<br>Default:0<br>Example:offset=220<br>How many results to skip. For example, with value `10`, the response will start with the 11 element |

### Responses

**200**

Успешно

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
Expand all  Collapse all

`{"data": {"reports": [{"dtBonus": "2025-06-02T00:00:00Z",\
\
"nmId": 544454,\
\
"oldShkId": 26624352356,\
\
"oldColor": "темно-синий,голубой",\
\
"oldSize": "A",\
\
"oldSku": "54532562",\
\
"oldVendorCode": "23535 Стемпинг 500",\
\
"newShkId": 123333223,\
\
"newColor": "темно-синий,голубой",\
\
"newSize": "A",\
\
"newSku": "12323332223",\
\
"newVendorCode": "wh-service-podmena",\
\
"bonusSumm": 247.5,\
\
"bonusType": "Подмена FBW",\
\
"photoUrls": ["https://static-basket-03.wb.ru/vol49/change_characteristics/19189882946-2023-12-15T10:18:21.125Z-1.webp",\
\
"https://static-basket-03.wb.ru/vol49/change_characteristics/19189052946-2023-12-15T10:18:35.249Z-2.webp"\
\
]\
\
}\
\
],

"total": 11

}

}`

## [tag/Retention-Reports/paths/~1api~1v1~1analytics~1antifraud-details/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/paths/~1api~1v1~1analytics~1antifraud-details/get) Self-purchases{{ /api/v1/analytics/antifraud-details }}

get/api/v1/analytics/antifraud-details

https://seller-analytics-api.wildberries.ru/api/v1/analytics/antifraud-details

Описание метода

Returns report with self-purchase deductions. The report is generated on Wednesdays at 7:00 UTC+4 and contains weekly data. Also you can get all data starting from August 2023.

Self-purchase deduction is 30% of product price. Minimum deduction is 100,000 ₽, if the total product cost delivered to the pick-up point is more than 100,000 ₽ per one week.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 minutes | 1 request | 10 minutes | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| date | string<br>Example:date=2023-12-01<br>Date from report period, `YYYY-MM-DD`, for example `2023-12-01`. To get all data from August 2023 do not use this parameter |

### Responses

**200**

Self-purchase deductions

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"details": [{"nmID": 123456789,\
\
"sum": 3540,\
\
"currency": "RUB",\
\
"dateFrom": "2023-08-23",\
\
"dateTo": "2023-08-29"\
\
}\
\
]

}`

## [tag/Retention-Reports/paths/~1api~1v1~1analytics~1incorrect-attachments/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/paths/~1api~1v1~1analytics~1incorrect-attachments/get) Substitutions{{ /api/v1/analytics/incorrect-attachments }} Deprecated

get/api/v1/analytics/incorrect-attachments

https://seller-analytics-api.wildberries.ru/api/v1/analytics/incorrect-attachments

Описание метода

The method will be disabled on January 20. Use [the current method](https://dev.wildberries.ru/en/openapi/reports#tag/Retention-Reports/operation/getDeductions)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"amount": 24514.5,\
\
"date": "2023-12-15",\
\
"lostReason": "Подмена. Вместо большой железной дороги поступила маленькая коробка.",\
\
"nmID": 123456789,\
\
"photoUrl": "https://mstatic.wbstatic.net/writeoff_to_the_seller/12345678911-2023-06-21T12:13:37.768Z-1.png",\
\
"shkID": 14555724540\
\
}\
\
]

}`

## [tag/Retention-Reports/paths/~1api~1v1~1analytics~1goods-labeling/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/paths/~1api~1v1~1analytics~1goods-labeling/get) Product Labeling{{ /api/v1/analytics/goods-labeling }}

get/api/v1/analytics/goods-labeling

https://seller-analytics-api.wildberries.ru/api/v1/analytics/goods-labeling

Описание метода

Returns a report on deductions for the absence of mandatory product labeling.

The report contains photos of products where the labeling is absent or cannot be read.

Data can be obtained for up to 31 days, starting from March 2024

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date><br>Example:dateFrom=2024-04-01<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<date><br>Example:dateTo=2024-04-30<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"amount": 1500,\
\
"date": "2024-03-26T01:00:00Z",\
\
"incomeId": 18484008,\
\
"nmID": 49434732,\
\
"photoUrls": ["https://static-basket-03.wildberries.ru/vol54/photo-fixation-violation-shk-excise/12345678900-1811460999-1.jpg",\
\
"https://static-basket-03.wildberries.ru/vol54/photo-fixation-violation-shk-excise/12345678900-1811461000-2.jpg",\
\
"https://static-basket-03.wildberries.ru/vol54/photo-fixation-violation-shk-excise/12345678900-1811461001-3.jpg"\
\
],\
\
"shkID": 17346434621,\
\
"sku": "4630153500834"\
\
}\
\
]

}`

## [tag/Retention-Reports/paths/~1api~1v1~1analytics~1characteristics-change/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Retention-Reports/paths/~1api~1v1~1analytics~1characteristics-change/get) Characteristics Change{{ /api/v1/analytics/characteristics-change }} Deprecated

get/api/v1/analytics/characteristics-change

https://seller-analytics-api.wildberries.ru/api/v1/analytics/characteristics-change

Описание метода

The method will be disabled on January 20. Use [the current method](https://dev.wildberries.ru/en/openapi/reports#tag/Retention-Reports/operation/getDeductions)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date><br>Example:dateFrom=2024-04-01<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<date><br>Example:dateTo=2024-04-30<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"amount": 135890,\
\
"date": "2024-03-01T01:00:00Z",\
\
"newBarcode": "22222222222222",\
\
"newColor": "темно-синий,голубой",\
\
"newSa": "hjt13/темно-синий,голубой",\
\
"newShkID": 44444444444,\
\
"newSize": "80",\
\
"nmID": 123654789,\
\
"oldBarcode": "111111111111111",\
\
"oldColor": "темно-синий,голубой",\
\
"oldSa": "hjt13/темно-синий,голубой",\
\
"oldShkID": 333333333,\
\
"oldSize": "43"\
\
}\
\
]

}`

# [tag/Paid-Reception](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Reception) Paid Reception

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

To get the report on [Paid Reception](https://seller.wildberries.ru/analytics-reports/acceptance-report):

1. [Create the report](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report/get).
2. Wait for the report to be ready. You can [check the status](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1%7Btask_id%7D~1status/get) of the report readiness. The ready report is stored for 2 hours.
3. [Get the report](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1%7Btask_id%7D~1download/get).

## [tag/Paid-Reception/paths/~1api~1v1~1acceptance_report/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report/get) Create the Report{{ /api/v1/acceptance\_report }}

get/api/v1/acceptance\_report

https://seller-analytics-api.wildberries.ru/api/v1/acceptance\_report

Описание метода

Creates a task for report generation.

Maximum of report period is 31 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"taskId": "219eaecf-e532-4bd8-9f15-8036ec1b042d"

}

}`

## [tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1{task_id}~1status/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1{task_id}~1status/get) Check the Status{{ /api/v1/acceptance\_report/tasks/{task\_id}/status }}

get/api/v1/acceptance\_report/tasks/{task\_id}/status

https://seller-analytics-api.wildberries.ru/api/v1/acceptance\_report/tasks/{task\_id}/status

Описание метода

Returns the status of the generation task

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 seconds | 1 request | 5 seconds | 1 request |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Generation task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"id": "cad56ec5-91ec-43a2-b5e8-efcf244cf309",

"status": "done"

}

}`

## [tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1{task_id}~1download/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Reception/paths/~1api~1v1~1acceptance_report~1tasks~1{task_id}~1download/get) Get the Report{{ /api/v1/acceptance\_report/tasks/{task\_id}/download }}

get/api/v1/acceptance\_report/tasks/{task\_id}/download

https://seller-analytics-api.wildberries.ru/api/v1/acceptance\_report/tasks/{task\_id}/download

Описание метода

Returns the report by task ID

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Generation task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"count": 40,\
\
"giCreateDate": "2025-03-04",\
\
"incomeId": 11834106,\
\
"nmID": 123456789,\
\
"shkCreateDate": "2025-03-14",\
\
"subjectName": "Добавки пищевые",\
\
"total": 873.04\
\
}\
\
]`

# [tag/Paid-Storage](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Storage) Paid Storage

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

To get the report:

1. [Generate the report](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Storage/paths/~1api~1v1~1paid_storage/get)
2. Check if the report is generated with [Check the status](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1%7Btask_id%7D~1status/get) method. Generated report is available during 2 hours.
3. [Get the report](https://dev.wildberries.ru/en/openapi/reports#tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1%7Btask_id%7D~1download/get)

## [tag/Paid-Storage/paths/~1api~1v1~1paid_storage/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Storage/paths/~1api~1v1~1paid_storage/get) Generate the Report{{ /api/v1/paid\_storage }}

get/api/v1/paid\_storage

https://seller-analytics-api.wildberries.ru/api/v1/paid\_storage

Описание метода

Create a task to generate a report. Maximum of report period — 8 days

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<br>Example:dateFrom=2022-01-01<br>Start of the report period, RFC3339 format. Date or date and time, for example:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |
| dateTo<br>required | string<br>Example:dateTo=2022-01-09<br>End of the report period, RFC3339 format. Date or date and time, for example:<br>- `2019-06-20`<br>- `2019-06-20T23:59:59`<br>- `2019-06-20T00:00:00.12345`<br>- `2017-03-25T00:00:00` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"taskId": "219eaecf-e532-4bd8-9f15-8036ec1b042d"

}

}`

## [tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1{task_id}~1status/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1{task_id}~1status/get) Check the Status{{ /api/v1/paid\_storage/tasks/{task\_id}/status }}

get/api/v1/paid\_storage/tasks/{task\_id}/status

https://seller-analytics-api.wildberries.ru/api/v1/paid\_storage/tasks/{task\_id}/status

Описание метода

Returns the status of task

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 seconds | 1 request | 5 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": {"id": "cad56ec5-91ec-43a2-b5e8-efcf244cf309",

"status": "done"

}

}`

## [tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1{task_id}~1download/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Paid-Storage/paths/~1api~1v1~1paid_storage~1tasks~1{task_id}~1download/get) Get the Report{{ /api/v1/paid\_storage/tasks/{task\_id}/download }}

get/api/v1/paid\_storage/tasks/{task\_id}/download

https://seller-analytics-api.wildberries.ru/api/v1/paid\_storage/tasks/{task\_id}/download

Описание метода

Returns the report by task ID

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 1 request |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| task\_id<br>required | string<br>Example:06e06887-9d9f-491f-b16a-bb1766fcb8d2<br>Task ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 404
- 429

Content type

application/json

Copy
Expand all  Collapse all

`[{"date": "2023-10-01",\
\
"logWarehouseCoef": 1,\
\
"officeId": 507,\
\
"warehouse": "Коледино",\
\
"warehouseCoef": 1.7,\
\
"giId": 123456,\
\
"chrtId": 1234567,\
\
"size": "0",\
\
"barcode": "",\
\
"subject": "Маски одноразовые",\
\
"brand": "1000 Каталог",\
\
"vendorCode": "567383",\
\
"nmId": 1234567,\
\
"volume": 12,\
\
"calcType": "короба: без габаритов",\
\
"warehousePrice": 7.65,\
\
"barcodesCount": 1,\
\
"palletPlaceCode": 0,\
\
"palletCount": 0,\
\
"originalDate": "2023-03-01",\
\
"loyaltyDiscount": 10,\
\
"tariffFixDate": "2023-10-01",\
\
"tariffLowerDate": "2023-11-01"\
\
}\
\
]`

# [tag/Sales-by-Regions](https://dev.wildberries.ru/en/openapi/reports\#tag/Sales-by-Regions) Sales by Regions

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

## [tag/Sales-by-Regions/paths/~1api~1v1~1analytics~1region-sale/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Sales-by-Regions/paths/~1api~1v1~1analytics~1region-sale/get) Get Report{{ /api/v1/analytics/region-sale }}

get/api/v1/analytics/region-sale

https://seller-analytics-api.wildberries.ru/api/v1/analytics/region-sale

Описание метода

Returns sales data grouped by regions of the countries. You can obtain a report for a maximum of 31 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 1 request | 10 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"cityName": "деревня Суханово",\
\
"countryName": "Россия",\
\
"foName": "Центральный федеральный округ",\
\
"nmID": 177974431,\
\
"regionName": "Московская область",\
\
"sa": "112233445566778899",\
\
"saleInvoiceCostPrice": 592.11,\
\
"saleInvoiceCostPricePerc": 43.0547333297454,\
\
"saleItemInvoiceQty": 4\
\
}\
\
]

}`

# [tag/Share-of-Brand-in-Sales](https://dev.wildberries.ru/en/openapi/reports\#tag/Share-of-Brand-in-Sales) Share of Brand in Sales

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

[Reports](https://seller.wildberries.ru/analytics-reports/brand-share) on the seller's brand share in sales.

To [obtain a report](https://dev.wildberries.ru/en/openapi/reports#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share/get), you will need:

1. [Brand names](https://dev.wildberries.ru/en/openapi/reports#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1brands/get).
2. [ID and names of categories](https://dev.wildberries.ru/en/openapi/reports#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1parent-subjects/get).

You can get a report for a maximum of one year

## [tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1brands/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1brands/get) Seller Brands{{ /api/v1/analytics/brand-share/brands }}

get/api/v1/analytics/brand-share/brands

https://seller-analytics-api.wildberries.ru/api/v1/analytics/brand-share/brands

Описание метода

Returns the list of the seller brands.

You can only get brands that:

- were sold in the last 90 days
- are in WB

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 10 requests |

##### Authorizations:

_HeaderApiKey_

### Responses

**200**

Success

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": ["1000 | Каталог",\
\
"1000 Каталог",\
\
"AndBerries",\
\
"H&M",\
\
"Mirtex",\
\
"PlayToday",\
\
"Test1",\
\
"WOW",\
\
"[\"Colambetta\"]",\
\
"dubs",\
\
"test",\
\
"Бест Трикотаж",\
\
"Тест"\
\
]

}`

## [tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1parent-subjects/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share~1parent-subjects/get) Parent Categories of the Brand{{ /api/v1/analytics/brand-share/parent-subjects }}

get/api/v1/analytics/brand-share/parent-subjects

https://seller-analytics-api.wildberries.ru/api/v1/analytics/brand-share/parent-subjects

Описание метода

Returns parent categories of the brand.

Data can be obtained starting from 1 November 2022, for up to 365 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 seconds | 1 request | 5 seconds | 20 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| locale | string<br>Default:"ru"<br>Example:locale=ru<br>Language of the response field `parentName`:<br>- `ru` — Russian<br>- `en` — English<br>- `zh` — Chinese |
| brand<br>required | string<br>Example:brand=H%26M<br>Brand |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"data": [{"parentId": 3,\
\
"parentName": "Аксессуары"\
\
},\
\
{"parentId": 7,\
\
"parentName": "Игрушки"\
\
},\
\
{"parentId": 1,\
\
"parentName": "Одежда"\
\
},\
\
{"parentId": 239,\
\
"parentName": "Спортивный товар"\
\
}\
\
]

}`

## [tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Share-of-Brand-in-Sales/paths/~1api~1v1~1analytics~1brand-share/get) Get Report{{ /api/v1/analytics/brand-share }}

get/api/v1/analytics/brand-share

https://seller-analytics-api.wildberries.ru/api/v1/analytics/brand-share

Описание метода

Returns a report on the brand's share in sales.

Data can be obtained starting from 1 November 2022, for up to 365 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 5 seconds | 1 request | 5 seconds | 20 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| parentId<br>required | integer<br>Example:parentId=1<br>Parent category ID |
| brand<br>required | string<br>Example:brand=H%26M<br>Brand |
| dateFrom<br>required | string<br>Example:dateFrom=2025-02-28<br>Report period start, `YYYY-MM-DD` |
| dateTo<br>required | string<br>Example:dateTo=2025-03-21<br>Report period end, `YYYY-MM-DD` |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"applyDate": "2023-10-31",\
\
"brandRating": 5,\
\
"pricePercent": 0.68,\
\
"qtyPercent": 1\
\
},\
\
{"applyDate": "2023-11-01",\
\
"brandRating": 5,\
\
"pricePercent": 0.65,\
\
"qtyPercent": 0.99\
\
},\
\
{"applyDate": "2023-11-02",\
\
"brandRating": 4,\
\
"pricePercent": 0.74,\
\
"qtyPercent": 1.23\
\
},\
\
{"applyDate": "2023-11-03",\
\
"brandRating": 2,\
\
"pricePercent": 0.76,\
\
"qtyPercent": 1.39\
\
}\
\
]

}`

# [tag/Hidden-Products](https://dev.wildberries.ru/en/openapi/reports\#tag/Hidden-Products) Hidden Products

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

## [tag/Hidden-Products/paths/~1api~1v1~1analytics~1banned-products~1blocked/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Hidden-Products/paths/~1api~1v1~1analytics~1banned-products~1blocked/get) Blocked Product Cards{{ /api/v1/analytics/banned-products/blocked }}

get/api/v1/analytics/banned-products/blocked

https://seller-analytics-api.wildberries.ru/api/v1/analytics/banned-products/blocked

Описание метода

Returns the list of [blocked product cards](https://seller.wildberries.ru/analytics-reports/banned-products)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 1 request | 10 seconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| sort<br>required | string<br>Enum:"brand""nmId""title""vendorCode""reason"<br>Example:sort=nmId<br>Sorting<br>- `brand` — by brand<br>- `nmId` — by WB article<br>- `title` — by product title<br>- `vendorCode` — by seller's article<br>- `reason` — by reason for blocking |
| order<br>required | string<br>Enum:"desc""asc"<br>Example:order=asc<br>Data order<br>- `desc` — from the largest numeric value to the smallest, from the last alphabetical value to the first<br>- `asc` — from the smallest numeric value to the largest, from the first alphabetical value to the last |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"brand": "Тест22",\
\
"nmId": 82722944,\
\
"title": "Гуминовые кислоты - биоактивный противовирусный комплекс на",\
\
"vendorCode": "пкdeир76",\
\
"reason": "Контактные данные Продавца и ссылки на иные сайты/группы/сообщества на фотографиях Товара"\
\
}\
\
]

}`

## [tag/Hidden-Products/paths/~1api~1v1~1analytics~1banned-products~1shadowed/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Hidden-Products/paths/~1api~1v1~1analytics~1banned-products~1shadowed/get) Hidden from the Catalog{{ /api/v1/analytics/banned-products/shadowed }}

get/api/v1/analytics/banned-products/shadowed

https://seller-analytics-api.wildberries.ru/api/v1/analytics/banned-products/shadowed

Описание метода

Returns the list of products [hidden from the catalog](https://seller.wildberries.ru/analytics-reports/banned-products/shadowed)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 1 request | 10 seconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| sort<br>required | string<br>Enum:"brand""nmId""title""vendorCode""nmRating"<br>Example:sort=title<br>Sorting<br>- `brand` — by brand<br>- `nmId` — by WB article<br>- `title` — by product title<br>- `vendorCode` — by seller's article<br>- `nmRating` — by card rating |
| order<br>required | string<br>Enum:"desc""asc"<br>Example:order=desc<br>Data order<br>- `desc` — from the largest numeric value to the smallest, from the last alphabetical value to the first<br>- `asc` — from the smallest numeric value to the largest, from the first alphabetical value to the last |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"brand": "Трикотаж",\
\
"nmId": 166658151,\
\
"title": "ВАЗ",\
\
"vendorCode": "DP02/черный",\
\
"nmRating": 3.1\
\
}\
\
]

}`

# [tag/Goods-Return-Report](https://dev.wildberries.ru/en/openapi/reports\#tag/Goods-Return-Report) Goods Return Report

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Analytics** category

## [tag/Goods-Return-Report/paths/~1api~1v1~1analytics~1goods-return/get](https://dev.wildberries.ru/en/openapi/reports\#tag/Goods-Return-Report/paths/~1api~1v1~1analytics~1goods-return/get) Get Report{{ /api/v1/analytics/goods-return }}

get/api/v1/analytics/goods-return

https://seller-analytics-api.wildberries.ru/api/v1/analytics/goods-return

Описание метода

Returns a list of [goods returns to the seller](https://seller.wildberries.ru/analytics-reports/goods-return). With one request, you can obtain a report for a maximum of 31 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom<br>required | string<date><br>Example:dateFrom=2024-08-13<br>Beginning date of the reporting period |
| dateTo<br>required | string<date><br>Example:dateTo=2024-08-27<br>End date of the reporting period |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
Expand all  Collapse all

`{"report": [{"barcode": "1680063403480",\
\
"brand": "dub",\
\
"completedDt": "2025-03-31T11:33:53",\
\
"dstOfficeAddress": "Жуковский Улица Маяковского 19",\
\
"dstOfficeId": 310105,\
\
"expiredDt": "2025-03-31T11:33:53",\
\
"isStatusActive": 0,\
\
"nmId": 12862181,\
\
"orderDt": "2024-08-26",\
\
"orderId": 2034240826,\
\
"readyToReturnDt": "2025-01-31T08:33:50",\
\
"reason": "Цвет",\
\
"returnType": "Возврат заблокированного товара",\
\
"shkId": 23411783472,\
\
"srid": "ad3817664d3046c5a8d55054d8be96d6",\
\
"status": "В пути в пвз",\
\
"stickerId": "33811984302",\
\
"subjectName": "Багажные бирки",\
\
"techSize": "0"\
\
}\
\
]

}`

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Statistics
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/reports

