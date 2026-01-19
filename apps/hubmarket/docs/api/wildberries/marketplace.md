# FBS Orders (Marketplace) API

> **Base URL:** `https://marketplace-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 20
> **Документация:** https://dev.wildberries.ru/openapi/orders-fbs
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Управление заказами FBS (Fulfillment by Seller) - доставка со склада продавца

---

## Документация API

Search

- General

- Product Management

- FBS Orders

  - FBS Assembly Orders

    - GET

      Get New Assembly Orders/api/v3/orders/new

    - GET

      Get Assembly Orders/api/v3/orders

    - POST

      Get Assembly Orders Statuses/api/v3/orders/status

    - GET

      Get All Assembly Orders for Re-shipment/api/v3/supplies/orders/reshipment

    - PATCH

      Cancel the Assembly Order/api/v3/orders/{orderId}/cancel

    - POST

      Get Assembly Orders Stickers/api/v3/orders/stickers

    - POST

      Get Stickers for Cross-Border Assembly Orders/api/v3/orders/stickers/cross-border

    - POST

      Status History for Cross-Border Orders/api/v3/orders/status/history

    - POST

      Orders with Client Information/api/v3/orders/client
  - FBS Metadata

  - FBS Supplies

  - FBS Passes
- DBW Orders

- DBS Orders

- In-Store Pickup Orders

- FBW Supplies

- Marketing and Promotions

- Customer Communication

- Tariffs

- Analytics and Data

- Reports

- Documents and Accounting

- Wildberries Digital


- FBS Orders
- FBS Assembly Orders
  - getGet New Assembly Orders/api/v3/orders/new
  - getGet Assembly Orders/api/v3/orders
  - postGet Assembly Orders Statuses/api/v3/orders/status
  - getGet All Assembly Orders for Re-shipment/api/v3/supplies/orders/reshipment
  - patchCancel the Assembly Order/api/v3/orders/{orderId}/cancel
  - postGet Assembly Orders Stickers/api/v3/orders/stickers
  - postGet Stickers for Cross-Border Assembly Orders/api/v3/orders/stickers/cross-border
  - postStatus History for Cross-Border Orders/api/v3/orders/status/history
  - postOrders with Client Information/api/v3/orders/client
- FBS Metadata
  - postGet Assembly Orders Metadata/api/marketplace/v3/orders/meta
  - getGet Assembly Order Metadata/api/v3/orders/{orderId}/meta
  - delDelete Assembly Order Metadata/api/v3/orders/{orderId}/meta
  - putAdd Data Matrix Code to the Assembly Order/api/v3/orders/{orderId}/meta/sgtin
  - putAdd UIN (Unique Identification Number) to the Assembly Order/api/v3/orders/{orderId}/meta/uin
  - putAdd IMEI to the Assembly Order/api/v3/orders/{orderId}/meta/imei
  - putAdd GTIN to the Assembly Order/api/v3/orders/{orderId}/meta/gtin
  - putAdd Expiration Date to the Assembly Order/api/v3/orders/{orderId}/meta/expiration
- FBS Supplies
  - postCreate a New Supply/api/v3/supplies
  - getGet a Supplies List/api/v3/supplies
  - patchAdd Assembly Orders to the Supply/api/marketplace/v3/supplies/{supplyId}/orders
  - patchAdd the Assembly Order to the Supply/api/v3/supplies/{supplyId}/orders/{orderId}
  - getGet Supply Details/api/v3/supplies/{supplyId}
  - delDelete the Supply/api/v3/supplies/{supplyId}
  - getGet Supply Assembly Order IDs/api/marketplace/v3/supplies/{supplyId}/order-ids
  - getGet the Supply Orders/api/v3/supplies/{supplyId}/orders
  - patchMove the Supply to the Delivery/api/v3/supplies/{supplyId}/deliver
  - getGet the Supply QR Code/api/v3/supplies/{supplyId}/barcode
  - getGet Supply Boxes List/api/v3/supplies/{supplyId}/trbx
  - postAdd Boxes to the Supply/api/v3/supplies/{supplyId}/trbx
  - delDelete Boxes from the Supply/api/v3/supplies/{supplyId}/trbx
  - postGet the Supply Box QR Code Stickers/api/v3/supplies/{supplyId}/trbx/stickers
- FBS Passes
  - getGet Offices for Pass/api/v3/passes/offices
  - getGet Passes/api/v3/passes
  - postCreate Pass/api/v3/passes
  - putUpdate Pass/api/v3/passes/{passId}
  - delDelete the Pass/api/v3/passes/{passId}

# FBS Orders(order)

Management of Orders, deliveries, warehouses, and passes

**Methods for working with assembly orders of the DBW model (Delivery by Wildberries) are now in a [separate environment](https://dev.wildberries.ru/en/release-notes?id=312).**

# [tag/FBS-Orders](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Orders) FBS Orders

Management of Orders, deliveries, warehouses, and passes

**Methods for working with assembly orders of the DBW model (Delivery by Wildberries) are now in a [separate environment](https://dev.wildberries.ru/en/release-notes?id=312).**

# [tag/FBS-Assembly-Orders](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders) FBS Assembly Orders

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Marketplace** category

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1new/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1new/get) Get New Assembly Orders/api/v3/orders/new

gethttps://marketplace-api.wildberries.ru/api/v3/orders/new

https://marketplace-api.wildberries.ru/api/v3/orders/new

Method description

Returns a list of all new [assembly orders](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders/get).

Metadata specified in the `requiredMeta` and `optionalMeta` fields in assembly orders only affects the ability to transfer a supply to delivery. If your product requires mandatory marking with identification means, you must specify all needed metadata whether it was received in `requiredMeta` or `optionalMeta` field (see 4.6 of the [Offer](https://seller.wildberries.ru/confirm-offer-condition/product/view)).

We recommend adding all metadata received in the `requiredMeta` and `optionalMeta` fields to the assembly orders

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

##### Authorizations:

_HeaderApiKey_

### Responses

**200**

Success

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Response samples

- 200
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orders": [{"address": {"fullAddress": "Chelyabinsk Region, Chelyabinsk, 51st Arabkir Street, Building 10A, Apartment 42",\
\
"longitude": 44.519068,\
\
"latitude": 40.20192\
\
},\
\
"ddate": "17.05.2024",\
\
"sellerDate": "02.06.2025",\
\
"salePrice": 504600,\
\
"requiredMeta": ["uin"\
\
],\
\
"optionalMeta": ["sgtin"\
\
],\
\
"deliveryType": "fbs",\
\
"comment": "Упакуйте в плёнку, пожалуйста",\
\
"scanPrice": null,\
\
"orderUid": "165918930_629fbc924b984618a44354475ca58675",\
\
"article": "one-ring-7548",\
\
"colorCode": "RAL 3017",\
\
"rid": "f884001e44e511edb8780242ac120002",\
\
"createdAt": "2022-05-04T07:56:29Z",\
\
"offices": ["Калуга"\
\
],\
\
"skus": ["6665956397512"\
\
],\
\
"id": 13833711,\
\
"warehouseId": 658434,\
\
"officeId": 123,\
\
"nmId": 123456789,\
\
"chrtId": 987654321,\
\
"price": 1014,\
\
"finalPrice": 1014,\
\
"convertedPrice": 28322,\
\
"convertedFinalPrice": 1014,\
\
"currencyCode": 933,\
\
"convertedCurrencyCode": 643,\
\
"cargoType": 1,\
\
"isZeroOrder": false,\
\
"options": {"isB2b": true\
\
}\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders/get) Get Assembly Orders/api/v3/orders

gethttps://marketplace-api.wildberries.ru/api/v3/orders

https://marketplace-api.wildberries.ru/api/v3/orders

Method description

Returns assembly orders information without current status.

You can get data for a specified period, maximum of 30 calendar days per request.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| limit<br>required | integer\[ 1 .. 1000 \]<br>Pagination parameter. Sets the limit for the amount of data returned. |
| next<br>required | integer<int64><br>Pagination parameter. Sets the value from which to retrieve the next batch. It should start at 0 to get the full list of data. For the subsequent requests, you must take the value from the `next` field in the response. |
| dateFrom | integer<br>Period start date in Unix timestamp format. By default date is 30 days before the request |
| dateTo | integer<br>Period end date in Unix timestamp format |

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

`{"next": 13833711,

"orders": [{"address": {"fullAddress": "Chelyabinsk Region, Chelyabinsk, 51st Arabkir Street, Building 10A, Apartment 42",\
\
"longitude": 44.519068,\
\
"latitude": 40.20192\
\
},\
\
"scanPrice": 1500,\
\
"deliveryType": "fbs",\
\
"supplyId": "WB-GI-92937123",\
\
"orderUid": "165918930_629fbc924b984618a44354475ca58675",\
\
"article": "one-ring-7548",\
\
"colorCode": "RAL 3017",\
\
"rid": "f884001e44e511edb8780242ac120002",\
\
"createdAt": "2022-05-04T07:56:29Z",\
\
"offices": ["Kaluga"\
\
],\
\
"skus": ["6665956397512"\
\
],\
\
"id": 13833711,\
\
"warehouseId": 658434,\
\
"officeId": 123,\
\
"nmId": 12345678,\
\
"chrtId": 987654321,\
\
"price": 1014,\
\
"convertedPrice": 28322,\
\
"currencyCode": 933,\
\
"convertedCurrencyCode": 643,\
\
"cargoType": 1,\
\
"comment": "Упакуйте в плёнку, пожалуйста",\
\
"isZeroOrder": false,\
\
"options": {"isB2b": true\
\
}\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status/post) Get Assembly Orders Statuses/api/v3/orders/status

posthttps://marketplace-api.wildberries.ru/api/v3/orders/status

https://marketplace-api.wildberries.ru/api/v3/orders/status

Method description

Returns the statuses of assembly orders from the request.

`supplierStatus` is a status of an assembly order. Its change is always triggered only by the supplier.

Possible values of `supplierStatus`:

| Status | Description | How to move the assembly orders to this status |
| --- | --- | --- |
| `new` | **New order** |  |
| `confirm` | **In assembly**<br>For delivery by Wildberries `fbs` | [Add assembly orders to the supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/Supplies-FBS/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1orders~1%7BorderId%7D/patch) |
| `complete` | **In delivery**<br> For delivery by Wildberries `fbs` and by WB courier `wbgo` | For `fbs` — [transfer the supply to delivery](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/Supplies-FBS/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1deliver/patch)<br> For `wbgo` — [transfer the assembly orders to delivery](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/WB-Courier-Delivery-(DBW)/paths/~1api~1v3~1orders~1%7BorderId%7D~1assemble/patch) |
| `cancel` | **Canceled by seller** | [Cancel the order](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/Assembly-Orders/paths/~1api~1v3~1orders~1%7BorderId%7D~1cancel/patch) |
| `receive` | **Received by the buyer**<br> For WB courier `wbgo` | The status changes automatically |
| `reject` | **Buyer rejection upon receipt**<br> For WB courier `wbgo` | The status changes automatically |

`wbStatus` — is a status of an order on the Wildberries side.

Possible values for this field are:

- `waiting` — the supplier confirmed the order, and the Wildberries has not received it yet
- `sorted` — the Wildberries warehouse sorted the order
- `sold` — the order is sold
- `canceled` — the supplier canceled the order
- `canceled_by_client` — the buyer canceled the order upon receipt
- `declined_by_client` — the buyer canceled the order in the first hour

Cancellation is available to the buyer in the first hour from the moment of order, if the order is not transferred to confirm status.
- `defect` — cancellation of the order due to a defect
- `ready_for_pickup` — the assembly orders came at pickup point and waiting for the client
- `postponed_delivery` — courier delivery is postponed
- `accepted_by_carrier` — accepted by carrier. The order is handed over to delivery service in the seller country
- `sent_to_carrier` — dispatched to carrier. The order is on the way to delivery service's warehouse in the seller

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| orders<br>required | Array of integers<int64>\[ 1 .. 1000 \] items\[ items <int64 > \]<br>List of assembly order IDs |

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

`{"orders": [5632423\
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

`{"orders": [{"id": 5632423,\
\
"supplierStatus": "new",\
\
"wbStatus": "waiting"\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1supplies~1orders~1reshipment/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1supplies~1orders~1reshipment/get) Get All Assembly Orders for Re-shipment/api/v3/supplies/orders/reshipment

gethttps://marketplace-api.wildberries.ru/api/v3/supplies/orders/reshipment

https://marketplace-api.wildberries.ru/api/v3/supplies/orders/reshipment

Method description

Returns all assembly orders that require re-shipment

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

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

`{"orders": [{"supplyID": "WB-GI-1234567",\
\
"orderID": 5632423\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1{orderId}~1cancel/patch](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1{orderId}~1cancel/patch) Cancel the Assembly Order/api/v3/orders/{orderId}/cancel

patchhttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/cancel

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/cancel

Method description

Moves the assembly orders to `cancel` ("Canceled by the supplier") status.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 100 requests | 600 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

### Responses

**204**

Canceled

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error updating a status

**429**

Too many requests

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1stickers/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1stickers/post) Get Assembly Orders Stickers/api/v3/orders/stickers

posthttps://marketplace-api.wildberries.ru/api/v3/orders/stickers

https://marketplace-api.wildberries.ru/api/v3/orders/stickers

Method description

Returns a list of stickers according to the requested assembly orders.
You can request a sticker in `svg`, `zplv` (vertical), `zplh` (horizontal) and `png` formats.

**Method limitations**:

- You cannot request more than 100 stickers at a time (no more than 100 assembly orders IDs in a request).
- The method returns stickers only for assembly orders in the `confirm` — in assembly and `complete` — in delivery [statuses](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status/post).
- Available dimensions:
  - 580x400 px, with parameters `width` = 58, `height` = 40
  - 400x300 px, with parameters `width` = 40, `height` = 30

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| type<br>required | string<br>Enum:"svg""zplv""zplh""png"<br>Sticker format |
| width<br>required | integer<br>Enum:5840<br>Sticker width |
| height<br>required | integer<br>Enum:4030<br>Sticker height |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| orders | Array of integers<int64>\[ 1 .. 100 \] items\[ items <int64 > \]<br>List of assembly order IDs |

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

`{"orders": [5346346\
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

`{"stickers": [{"orderId": 5346346,\
\
"partA": "231648",\
\
"partB": "9753",\
\
"barcode": "!uKEtQZVx",\
\
"file": "iVBORw0KGgoAAAANSUhEUgAAASIAAAEiAQAAAAB1xeIbAAABiElEQVR4nO2YUW6DMAyGbUDaI0g9wI4Sjg5H2Q3IeyZPthNKV03tNiVdtf9/cFvXAvRhkh+z0G2t3R1FRKgqAokikCgCiSKQeDQJzho8yXMsmfmh1/UvqoKoNrsLdgN6S8hzXP2TV8Xc47KMyTPnx+DvX/1zVg1Xmch1z9ih6gv2HLZTuqIPXjX7ftSlPRLJ+prXnONLF9hXZL96q/fE4W1Q+O8XvQ/29djL/lvWiTg/Bt89Voeqn/j7OQ4eTLJY7tz8oEoVSFC28aN9JqKwqbX3kP+VBewrsg/KedE3qmXUn3IMYF/d3zONm38TiqckFKeyEaDv6/W96Nus9b2tPrbw2LOAvq/Pfpfn/Fb4HoA1p9UcU3SHJTLHExk+p8VeK3JwN0Q2UNPmR9+3m2OyDzPjoOFFML9vOMcUin0iHahR2CaGz/mkmo6P5zHtQdD3TeeY5NY++/sKZ+xQdUliNZszqePRkFd+tfvHqhtC1S/nmOQh7eH+Y3WoygKJIpAoAokikChqT+IDIkbb8/8OLskAAAAASUVORK5CYII="\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1stickers~1cross-border/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1stickers~1cross-border/post) Get Stickers for Cross-Border Assembly Orders/api/v3/orders/stickers/cross-border

posthttps://marketplace-api.wildberries.ru/api/v3/orders/stickers/cross-border

https://marketplace-api.wildberries.ru/api/v3/orders/stickers/cross-border

Method description

Returns a list of stickers for cross-border assembly orders in PDF.

Method limitations:

- You cannot request more than 100 stickers at a time (no more than 100 assembly order IDs in a request).
- The method returns stickers only for assembly orders that are on assembly or in delivery [status](https://dev.wildberries.ru/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status/post): `confirm`, `complete`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| orders | Array of integers<int64>\[ 1 .. 100 \] items\[ items <int64 > \]<br>List of assembly order IDs |

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

`{"orders": [3869227998\
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

`{"stickers": [{"file": "JVBERi0xLjQKJSBjcmVhdGVkIGJ5IFBpbGxvdyBQREYgZHJpdmVyCjQgMCBvYmo8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgNSAwIFIKPj5lbmRvYmoKNSAwIG9iajw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDIgMCBSIF0KPj5lbmRvYmoKMSAwIG9iajw8Ci9UeXBlIC9YT2JqZWN0Ci9TdWJ0eXBlIC9JbWFnZQovV2lkdGggMjkwCi9IZWlnaHQgMjkwCi9GaWx0ZXIgWyAvQ0NJVFRGYXhEZWNvZGUgXQovRGVjb2RlUGFybXMgWyA8PAovSyAtMQovQmxhY2tJczEgdHJ1ZQovQ29sdW1ucyAyOTAKL1Jvd3MgMjkwCj4+IF0KL0JpdHNQZXJDb21wb25lbnQgMQovQ29sb3JTcGFjZSAvRGV2aWNlR3JheQovTGVuZ3RoIDY2Ngo+PnN0cmVhbQomoLYaX////////////8g2b4gpHITff///////////8nBSkIB8nBS/////////////////////+QgHkNB/IQD////////////////////////////+P//////////////////////////IQ5CHIQ////////////////////////////////jkNB/H/////////////////////4yEOQh+P//////////////////EhoKR//////yDYchDkIchDyBg2E4aCcFL////////////////////////IgFIiAhODQTg0f/////////////////+ThCICEQGgnDQTg0E4NBODZ////////////////////////4k4NESEOJCCP/////////////////8gpHIQ5CCCEEENB8hDyBg2f//////////////////////////xEZKQhOEJwhOB5f//////////////yDZviDQIjkDBS///////////////ycFLEnCCThP//////////////////kIB5CHkQEEnCEQEJwbP///////////////////////////4ycGgnBoIgFL/////////////////////+QhxIQ4kIcg0H////////////////////////8cSEOJCHEhAP//////////////////jIQDIQ+Qh5OE////////////////////////4iIiI/////////////wAQAQJAAABAwABAAAAIgEAAAEBAwABAAAAIgEAAAIBAwABAAAAAQAAAAMBAwABAAAABAAAAAYBAwABAAAAAQAAABEBBAABAAAACAAAABYBAwABAAAAIgEAABcBBAABAAAAKAIAABwBAwABAAAAAQAAAAAAAAAKZW5kc3RyZWFtCmVuZG9iagoyIDAgb2JqPDwKL1Jlc291cmNlcyA8PAovUHJvY1NldCBbIC9QREYgL0ltYWdlQiBdCi9YT2JqZWN0IDw8Ci9pbWFnZSAxIDAgUgo+Pgo+PgovTWVkaWFCb3ggWyAwIDAgMjkwLjAgMjkwLjAgXQovQ29udGVudHMgMyAwIFIKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgo+PmVuZG9iagozIDAgb2JqPDwKL0xlbmd0aCA0Nwo+PnN0cmVhbQpxIDI5MC4wMDAwMDAgMCAwIDI5MC4wMDAwMDAgMCAwIGNtIC9pbWFnZSBEbyBRCgplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmo8PAovQ3JlYXRpb25EYXRlIChEOjIwMjUxMTA3MTMzNTE1WikKL01vZERhdGUgKEQ6MjAyNTExMDcxMzM1MTVaKQo+PmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM2IGYgCjAwMDAwMDAxNDQgMDAwMDAgbiAKMDAwMDAwMTA1MiAwMDAwMCBuIAowMDAwMDAxMjE0IDAwMDAwIG4gCjAwMDAwMDAwNDAgMDAwMDAgbiAKMDAwMDAwMDA4NyAwMDAwMCBuIAowMDAwMDAxMzA5IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1Jvb3QgNCAwIFIKL1NpemUgNwovSW5mbyA2IDAgUgo+PgpzdGFydHhyZWYKMTM5MQolJUVPRg==",\
\
"orderId": 3869227998,\
\
"parcelId": "WB0000000001"\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status~1history/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1status~1history/post) Status History for Cross-Border Orders/api/v3/orders/status/history

posthttps://marketplace-api.wildberries.ru/api/v3/orders/status/history

https://marketplace-api.wildberries.ru/api/v3/orders/status/history

Method description

Returns status history for cross-border orders

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| orders | Array of integers\[ 1 .. 100 \] items<br>Assembly orders IDs |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"orders": [123456789,\
\
987654321\
\
]

}`

### Response samples

- 200
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orders": [{"deliveryDate": "2019-08-24T14:15:22Z",\
\
"statuses": [{"date": null,\
\
"code": "SORTED"\
\
}\
\
],\
\
"orderID": 123456789\
\
}\
\
]

}`

## [tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1client/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1client/post) Orders with Client Information/api/v3/orders/client

posthttps://marketplace-api.wildberries.ru/api/v3/orders/client

https://marketplace-api.wildberries.ru/api/v3/orders/client

Method description

The method allows getting information about the client by assembly order ID.

Only for cross-border orders from **Turkey**

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| orders | Array of integers<br>Orders list |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"orders": [987654321,\
\
123456789\
\
]

}`

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orders": [{"firstName": "Иван",\
\
"fullName": "Андреев Иван Васильевич",\
\
"lastName": "Андреев",\
\
"middleName": "Васильевич",\
\
"orderID": 134567,\
\
"phone": "79871234567",\
\
"phoneCode": "0"\
\
}\
\
]

}`

# [tag/FBS-Metadata](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata) FBS Metadata

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Marketplace** category

With these methods, you can [get](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta/get), [delete](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta/delete) and edit the metadata of [assembly orders](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders):

- [Data Matrix code](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1sgtin/put)
- [UIN](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1uin/put)
- [IMEI](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1imei/put)
- [GTIN](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1gtin/put)
- [Expiration date](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1expiration/put)

## [tag/FBS-Metadata/paths/~1api~1marketplace~1v3~1orders~1meta/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1marketplace~1v3~1orders~1meta/post) Get Assembly Orders Metadata/api/marketplace/v3/orders/meta

posthttps://marketplace-api.wildberries.ru/api/marketplace/v3/orders/meta

https://marketplace-api.wildberries.ru/api/marketplace/v3/orders/meta

Method description

The method returns metadata for [assembly orders](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders/get) by the list of their IDs.

You can get the list of metadata available for an assembly order in the `requiredMeta` and `optionalMeta` fields in the response of the [Get New Assembly Orders](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1orders~1new/get) method.

Possible metadata:

- `imei` — [IMEI](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1imei/put)
- `uin` — [UIN](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1uin/put)
- `gtin` — [GTIN](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1gtin/put)
- `sgtin` — [Data matrix code](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1sgtin/put)
- `expiration` — [Expiration date](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1expiration/put)

If any of the metadata objects are not returned in the response, it means that the assembly order cannot have such metadata, and they cannot be added

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **getting and deleting FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| orders<br>required | Array of integers<= 100 items |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Not found

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"orders": [123456,\
\
234567,\
\
345678\
\
]

}`

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orders": [{"id": 0,\
\
"meta": {"imei": {"value": "123456789012345"\
\
},\
\
"uin": {"value": "123456789012345"\
\
},\
\
"gtin": {"value": "123456789012345"\
\
},\
\
"sgtin": {"value": ["123456789012345"\
\
]\
\
},\
\
"expiration": {"value": "12.09.2030"\
\
}\
\
}\
\
}\
\
]

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta/get) Get Assembly Order Metadata Deprecated /api/v3/orders/{orderId}/meta

gethttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta

Method description

This method is deprecated. It will be removed on [December 24](https://dev.wildberries.ru/en/release-notes?id=371)

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

### Responses

**200**

Success

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"meta": {"imei": {"value": "123456789012345"

},

"uin": {"value": "123456789012345"

},

"gtin": {"value": "123456789012345"

},

"sgtin": {"value": ["123456789012345"\
\
]

},

"expiration": {"value": "12.09.2030"

}

}

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta/delete](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta/delete) Delete Assembly Order Metadata/api/v3/orders/{orderId}/meta

deletehttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta

Method description

Removes all assembly order metadata values for the passed key.

Possible metadata are:

- `imei` — [IMEI](https://dev.wildberries.ru/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1imei/put)
- `uin` — [UIN](https://dev.wildberries.ru/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1uin/put)
- `gtin` — [GTIN](https://dev.wildberries.ru/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1gtin/put)
- `sgtin` — [Data matrix code](https://dev.wildberries.ru/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta~1sgtin/put)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **getting and deleting FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### query Parameters

|     |     |
| --- | --- |
| key | string<br>Name of the metadata to remove (`imei`, `uin`, `gtin`, `sgtin`) |

### Responses

**204**

Deleted

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**409**

Error deleting metadata

**429**

Too many requests

### Response samples

- 400
- 401
- 403
- 409
- 429

Content type

application/json

Example

IncorrectRequestIncorrectParameterIncorrectRequest

Copy

`{"message": "Incorrect request parameters"

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1sgtin/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1sgtin/put) Add Data Matrix Code to the Assembly Order/api/v3/orders/{orderId}/meta/sgtin

puthttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/sgtin

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/sgtin

Method description

The method allows attaching a Data Matrix code [Chestny ZNAK](https://chestnyznak.ru/en) to an assembly order.

Attaching a Data Matrix code to an assembly order is only possible if this field is returned in the response of the method [to get the metadata of the order](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta/get), and the assembly order is in the confirm status.

The loaded Data Matrix code can be retrieved through the method [to get the metadata of the order](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta/get)

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **adding FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1000 requests | 60 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| sgtins | Array of strings\[ 1 .. 100 \] items<br>List of Data Matrix codes. |

### Responses

**204**

Sent

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error adding a Data Matrix code

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"sgtins": ["1234567890123456"\
\
]

}`

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Example

IncorrectRequestBodyIncorrectRequestIncorrectParameterIncorrectRequestBody

Copy

`{"message": "Incorrect request body"

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1uin/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1uin/put) Add UIN (Unique Identification Number) to the Assembly Order/api/v3/orders/{orderId}/meta/uin

puthttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/uin

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/uin

Method description

Sets the UIN for the assembly order. The assembly order can only have one UIN. You can add the code only for assembly orders in the `confirm` status.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **adding FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1000 requests | 60 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| uin<br>required | string= 16 characters<br>UIN |

### Responses

**204**

Updated

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**409**

Error updating metadata

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"uin": "1234567890123456"

}`

### Response samples

- 400
- 401
- 403
- 409
- 429

Content type

application/json

Example

IncorrectRequestBodyIncorrectRequestIncorrectParameterIncorrectRequestBody

Copy

`{"message": "Incorrect request body"

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1imei/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1imei/put) Add IMEI to the Assembly Order/api/v3/orders/{orderId}/meta/imei

puthttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/imei

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/imei

Method description

Sets the IMEI for the assembly order.

The assembly order can have only one IMEI. If a device has two IMEIs — **IMEI** and **IMEI2** or **IMEI1** and **IMEI2** — you should only specify **IMEI** or **IMEI1**. You don't need to specify **IMEI2**.

You can add the code only for assembly orders in the `confirm` status.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **adding FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1000 requests | 60 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| imei<br>required | string= 15 characters<br>IMEI |

### Responses

**204**

Updated

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**409**

Error updating metadata

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"imei": "123456789012345"

}`

### Response samples

- 400
- 401
- 403
- 409
- 429

Content type

application/json

Example

IncorrectRequestBodyIncorrectRequestIncorrectParameterIncorrectRequestBody

Copy

`{"message": "Incorrect request body"

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1gtin/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1gtin/put) Add GTIN to the Assembly Order/api/v3/orders/{orderId}/meta/gtin

puthttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/gtin

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/gtin

Method description

Sets the GTIN (Belarus product unique identifier) for the assembly order. The assembly order can only have one GTIN. You can add the code only for assembly orders in the `confirm` status.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **adding FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1000 requests | 60 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| gtin<br>required | string= 13 characters<br>GTIN |

### Responses

**204**

Updated

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**409**

Error updating metadata

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"gtin": "1234567890123"

}`

### Response samples

- 400
- 401
- 403
- 409
- 429

Content type

application/json

Example

IncorrectRequestBodyIncorrectRequestIncorrectParameterIncorrectRequestBody

Copy

`{"message": "Incorrect request body"

}`

## [tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1expiration/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Metadata/paths/~1api~1v3~1orders~1{orderId}~1meta~1expiration/put) Add Expiration Date to the Assembly Order/api/v3/orders/{orderId}/meta/expiration

puthttps://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/expiration

https://marketplace-api.wildberries.ru/api/v3/orders/{orderId}/meta/expiration

Method description

Sets the expiration date for the assembly order.

The expiration date can only be added for assembly orders that are delivered by WB and are in the `confirm` status.

You can get the uploaded data in the [metadata of the assembly order](https://dev.wildberries.ru/openapi/orders-fbs#tag/FBS-Metadata/paths/~1api~1v3~1orders~1%7BorderId%7D~1meta/get).

To change the expiration date, send a request with the new date.
It is impossible to remove the expiration date from the metadata of the assembly order.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods for **adding FBS metadata**:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1000 requests | 60 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| expiration | string<date (dd.mm.yyyy)><br>The date until which the product is valid. No less than 30 days from the current date. |

### Responses

**204**

Sent

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error updating metadata

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"expiration": "12.09.2030"

}`

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Example

LowExpirationDateIncorrectRequestBodyIncorrectRequestIncorrectParameterLowExpirationDate

The specified expiration date is less than the allowable limit

Copy

`{"code": "LowExpirationDate",

"message": "Не удалось обновить срок годности. Указан срок меньше допустимого"

}`

# [tag/FBS-Supplies](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies) FBS Supplies

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Marketplace** category

Work order:

Items 3-5 must be completed when delivering a supply to a pickup point


1. [Create a new supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies/post). The ID of the created supply will be returned in the format `WB-GI-1234567`.
2. In the current new supply, [add assembly orders](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1orders~1%7BorderId%7D/patch) that you will transport to the warehouse or pickup point. When adding assembly order to the supply, they will be moved to the `confirm` status — in assembly.
3. [Create a box in the supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1trbx/post)
4. [Check the list of boxes](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1trbx/get)
5. [Get the box stickers](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1trbx~1stickers/post), print them out and affix the stickers to the boxes according to the orders distributed in them.
6. After the supply has been equipped with the necessary assembly orders, it must [be handed over for delivery](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1deliver/patch). If the supply is not handed over for delivery, accepting the first product at the pickup point will automatically close the supply. When handing over assembly order for delivery, they will automatically be assembled and moved to the `complete` status — in delivery.
7. If a supply was scanned at the acceptance point but still has unscanned products, after a certain time, you must deliver them again. Check [all assembly order requiring reshipment at this time](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Assembly-Orders/paths/~1api~1v3~1supplies~1orders~1reshipment/get). [These assembly order can be transferred to another active supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1orders~1%7BorderId%7D/patch). The assembly order will also be moved to the `confirm` status — in assembly.

You can also:

1. [Remove a box from the supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1trbx/delete), but only while the supply is still in assembly.
2. [Get a list of all assembly order added to the supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1orders/get).
3. Get information [about all the seller's supplies](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies/get) or [about a specific supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D/get).
4. [Delete a supply](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D/delete) provided that it is active and not tied to any assembly orders.
5. [Move assembly orders between active supplies](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1orders~1%7BorderId%7D/patch). You cannot move an assembly order from a supply that is already closed, unless it requires reshipment.
6. [Get the supply's QR code](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D~1barcode/get) in SVG, ZPL, or PNG formats. Available only after the supply has been handed over for delivery.

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies/post) Create a New Supply/api/v3/supplies

posthttps://marketplace-api.wildberries.ru/api/v3/supplies

https://marketplace-api.wildberries.ru/api/v3/supplies

Method description

**Supplies limitations**:

- Supplies applicable only for assembly orders in the FBS (Fulfillment by Seller) delivery.
- All assembly orders added to supply automatically transferred from the `new` status to the `confirm` status.
- Please note that if you will `cancel` (`Canceled by the seller`) the order, we will automatically remove it from the supply.
- A supply can only be assembled from assembly jobs (orders) with the same dimensional type (cargoType). A new supply does not have a dimensional attribute. When the first assembly order is added to a supply, the supply acquires the dimensional attribute of that assembly order.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| name | string\[ 1 .. 128 \] characters<br>Supply name |

### Responses

**201**

Created

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

`{"name": "Some test supply"

}`

### Response samples

- 201
- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"id": "WB-GI-1234567"

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies/get) Get a Supplies List/api/v3/supplies

gethttps://marketplace-api.wildberries.ru/api/v3/supplies

https://marketplace-api.wildberries.ru/api/v3/supplies

Method description

Returns the supply list.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| limit<br>required | integer\[ 1 .. 1000 \]<br>Pagination parameter. Sets the limit for the amount of data returned. |
| next<br>required | integer<int64><br>Pagination parameter. Sets the value from which to retrieve the next batch. It should start at 0 to get the full list of data. For the subsequent requests, you must take the value from the `next` field in the response. |

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

`{"next": 13833711,

"supplies": [{"id": "WB-GI-1234567",\
\
"done": true,\
\
"createdAt": "2022-05-04T07:56:29Z",\
\
"closedAt": "2022-05-04T07:56:29Z",\
\
"scanDt": "2022-05-04T07:56:29Z",\
\
"name": "My test supply",\
\
"cargoType": 0,\
\
"destinationOfficeId": 123\
\
}\
\
]

}`

## [tag/FBS-Supplies/paths/~1api~1marketplace~1v3~1supplies~1{supplyId}~1orders/patch](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1marketplace~1v3~1supplies~1{supplyId}~1orders/patch) Add Assembly Orders to the Supply/api/marketplace/v3/supplies/{supplyId}/orders

patchhttps://marketplace-api.wildberries.ru/api/marketplace/v3/supplies/{supplyId}/orders

https://marketplace-api.wildberries.ru/api/marketplace/v3/supplies/{supplyId}/orders

Method description

The method adds up to 100 [assembly orders](https://dev.wildberries.ru/openapi/orders-fbs#tag/Assembly-Orders/paths/~1api~1v3~1orders/get) to the supply and moves it to the `confirm` [status](https://dev.wildberries.ru/openapi/orders-fbs#tag/Assembly-Orders/paths/~1api~1v3~1orders~1status/post).

It can also move the assembly orders:

- between active supplies
- from a closed to an active supply, if the assembly order requires [reshipment](https://dev.wildberries.ru/openapi/orders-fbs#tag/Assembly-Orders/paths/~1api~1v3~1supplies~1orders~1reshipment/get).

You can add assembly orders of any dimensional type to an empty supply. After adding the first assembly order, the supply acquires the dimensional type of this assembly order from the `cargoType` [field](https://dev.wildberries.ru/en/openapi/orders-fbs#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1%7BsupplyId%7D/get).


After that, you can only add assembly orders of the same dimensional type as the supply.

Assembly orders received at different warehouses cannot be added to the delivery.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| orders | Array of integers\[ 1 .. 100 \] items<br>Assembly order IDs |

### Responses

**204**

The assembly orders assigned to the supply

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error adding the assembly order to the supply

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"orders": [5632423,\
\
3453452,\
\
7654533,\
\
4529544\
\
]

}`

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1orders~1{orderId}/patch](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1orders~1{orderId}/patch) Add the Assembly Order to the Supply Deprecated /api/v3/supplies/{supplyId}/orders/{orderId}

patchhttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/orders/{orderId}

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/orders/{orderId}

Method description

This method is deprecated. It will be removed on [December 18](https://dev.wildberries.ru/en/release-notes?id=362)

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |
| orderId<br>required | integer<int64><br>Example:5632423<br>Assembly order ID |

### Responses

**204**

The assembly order assigned to the supply

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error adding the assembly order to the supply

**429**

Too many requests

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}/get) Get Supply Details/api/v3/supplies/{supplyId}

gethttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}

Method description

Returns supply details.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy

`{"id": "WB-GI-1234567",

"done": true,

"createdAt": "2022-05-04T07:56:29Z",

"closedAt": "2022-05-04T07:56:29Z",

"scanDt": "2022-05-04T07:56:29Z",

"name": "My test supply",

"cargoType": 0,

"destinationOfficeId": 123

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}/delete](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}/delete) Delete the Supply/api/v3/supplies/{supplyId}

deletehttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}

Method description

Deleted the supply if it is active and does not contain any assembly orders.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

### Responses

**204**

Deleted

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

The supply contains orders

**429**

Too many requests

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Supplies/paths/~1api~1marketplace~1v3~1supplies~1{supplyId}~1order-ids/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1marketplace~1v3~1supplies~1{supplyId}~1order-ids/get) Get Supply Assembly Order IDs/api/marketplace/v3/supplies/{supplyId}/order-ids

gethttps://marketplace-api.wildberries.ru/api/marketplace/v3/supplies/{supplyId}/order-ids

https://marketplace-api.wildberries.ru/api/marketplace/v3/supplies/{supplyId}/order-ids

Method description

The method returns assembly orders IDs assigned to the supply.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Supply ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orderIds": [132334,\
\
203984,\
\
403543,\
\
598349\
\
]

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1orders/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1orders/get) Get the Supply Orders Deprecated /api/v3/supplies/{supplyId}/orders

gethttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/orders

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/orders

Method description

This method is deprecated. It will be removed on [December 17](https://dev.wildberries.ru/en/release-notes?id=363)

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"orders": [{"scanPrice": null,\
\
"orderUid": "165918930_629fbc924b984618a44354475ca58675",\
\
"article": "one-ring-7548",\
\
"colorCode": "RAL 3017",\
\
"rid": "f884001e44e511edb8780242ac120002",\
\
"createdAt": "2022-05-04T07:56:29Z",\
\
"offices": ["Калуга"\
\
],\
\
"skus": ["6665956397512"\
\
],\
\
"id": 13833711,\
\
"warehouseId": 658434,\
\
"nmId": 123456789,\
\
"chrtId": 987654321,\
\
"price": 1014,\
\
"convertedPrice": 28322,\
\
"currencyCode": 933,\
\
"convertedCurrencyCode": 643,\
\
"cargoType": 1,\
\
"isZeroOrder": false\
\
}\
\
]

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1deliver/patch](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1deliver/patch) Move the Supply to the Delivery/api/v3/supplies/{supplyId}/deliver

patchhttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/deliver

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/deliver

Method description

Closes the supply and moves all assembly orders to `complete` (`In Delivery`) status. You cannot add any assembly orders to the supply after it is closed.

If the supply wasn't handed over for delivery, than scanning its QR code or accepting the first product will automatically close the supply.

You can transfer the supply to delivery only if it contains at least one assembly order.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

### Responses

**204**

The supply moved to the delivery

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error closing supply

**429**

Too many requests

### Response samples

- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1barcode/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1barcode/get) Get the Supply QR Code/api/v3/supplies/{supplyId}/barcode

gethttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/barcode

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/barcode

Method description

Returns the QR code in svg, zplv (vertical), zplh (horizontal), png.

Available only after the supply has been transferred to the delivery.
Available dimensions:

580x400 px

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

##### query Parameters

|     |     |
| --- | --- |
| type<br>required | string<br>Enum:"svg""zplv""zplh""png"<br>Sticker format |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**409**

Error requesting data

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 404
- 409
- 429

Content type

application/json

Copy

`{"barcode": "WB-GI-12345678",

"file": "U3dhZ2dlciByb2Nrcw=="

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/get) Get Supply Boxes List/api/v3/supplies/{supplyId}/trbx

gethttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

Method description

Returns supply boxes list.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"trbxes": [{"id": "WB-TRBX-1234567"\
\
}\
\
]

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/post) Add Boxes to the Supply/api/v3/supplies/{supplyId}/trbx

posthttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

Method description

Adds the required number of boxes to the supply.

Boxes should only be added to deliveries shipped to the pickup points.
Can only be added to an open supply.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| amount<br>required | integer\[ 1 .. 1000 \]<br>Boxes amount to add to the supply. |

### Responses

**201**

Created

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"amount": 4

}`

### Response samples

- 201
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"trbxIds": ["WB-TRBX-1234567"\
\
]

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/delete](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx/delete) Delete Boxes from the Supply/api/v3/supplies/{supplyId}/trbx

deletehttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx

Method description

The method deletes boxes from the supply. Available only while the supply is being assembled.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| trbxIds<br>required | Array of strings<br>List of box IDs to delete from the supply. |

### Responses

**204**

Deleted

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"trbxIds": ["WB-TRBX-1234567"\
\
]

}`

### Response samples

- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy

`{"code": "IncorrectParameter",

"message": "Передан некорректный параметр"

}`

## [tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx~1stickers/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Supplies/paths/~1api~1v3~1supplies~1{supplyId}~1trbx~1stickers/post) Get the Supply Box QR Code Stickers/api/v3/supplies/{supplyId}/trbx/stickers

posthttps://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx/stickers

https://marketplace-api.wildberries.ru/api/v3/supplies/{supplyId}/trbx/stickers

Method description

Returns QR-code stickers in svg, zplv (vertical), zplh (horizontal), png.

Available only if there are assembly orders in the box.

Stickers dimensions: 580x400 px.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| supplyId<br>required | string<br>Example:WB-GI-1234567<br>Supply ID |

##### query Parameters

|     |     |
| --- | --- |
| type<br>required | string<br>Enum:"svg""zplv""zplh""png"<br>Sticker format |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| trbxIds<br>required | Array of strings<br>List of supply box IDs for the sticker generation |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"trbxIds": ["WB-TRBX-1234567"\
\
]

}`

### Response samples

- 200
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy
ExpandCollapse

`{"stickers": [{"barcode": "$WBMP:1:123:1234567",\
\
"file": "U3dhZ2dlciByb2Nrcw=="\
\
}\
\
]

}`

# [tag/FBS-Passes](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes) FBS Passes

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Marketplace** category

## [tag/FBS-Passes/paths/~1api~1v3~1passes~1offices/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes/paths/~1api~1v3~1passes~1offices/get) Get Offices for Pass/api/v3/passes/offices

gethttps://marketplace-api.wildberries.ru/api/v3/passes/offices

https://marketplace-api.wildberries.ru/api/v3/passes/offices

Method description

Returns a list of offices that require a pass.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

### Responses

**200**

Success

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Response samples

- 200
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`[{"name": "Koledino",\
\
"address": "Kosmonavtov 10А",\
\
"id": 1\
\
}\
\
]`

## [tag/FBS-Passes/paths/~1api~1v3~1passes/get](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes/paths/~1api~1v3~1passes/get) Get Passes/api/v3/passes

gethttps://marketplace-api.wildberries.ru/api/v3/passes

https://marketplace-api.wildberries.ru/api/v3/passes

Method description

Returns a list of all seller's passes.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

### Responses

**200**

Success

**401**

Unauthorized

**403**

Access denied

**429**

Too many requests

### Response samples

- 200
- 401
- 403
- 429

Content type

application/json

Copy
ExpandCollapse

`[{"firstName": "Alex",\
\
"dateEnd": "2022-07-31 17:53:13+00:00",\
\
"lastName": "Petrov",\
\
"carModel": "Lamborghini",\
\
"carNumber": "A456BC123",\
\
"officeName": "Koledino",\
\
"officeAddress": "Kosmonavtov 10А",\
\
"officeId": 15,\
\
"id": 1\
\
}\
\
]`

## [tag/FBS-Passes/paths/~1api~1v3~1passes/post](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes/paths/~1api~1v3~1passes/post) Create Pass/api/v3/passes

posthttps://marketplace-api.wildberries.ru/api/v3/passes

https://marketplace-api.wildberries.ru/api/v3/passes

Method description

Creates a supplier pass.

The pass is valid for 48 hours from the time of creation.

Maximum of 1 request per 10 [minutes](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

The total length of the full name is limited from 6 to 100 characters. The car number can contain only letters and numbers.

|     |     |
| --- | --- |
| firstName<br>required | stringnon-empty<br>First name |
| lastName<br>required | stringnon-empty<br>Last name |
| carModel<br>required | string\[ 1 .. 100 \] characters<br>Car model |
| carNumber<br>required | string\[ 6 .. 9 \] characters<br>Car number |
| officeId<br>required | integer<int64>>= 1<br>Office ID |

### Responses

**201**

Created

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"firstName": "Alex",

"lastName": "Petrov",

"carModel": "Lamborghini",

"carNumber": "A456BC123",

"officeId": 15

}`

### Response samples

- 201
- 400
- 401
- 403
- 404
- 429

Content type

application/json

Copy

`{"id": 2

}`

## [tag/FBS-Passes/paths/~1api~1v3~1passes~1{passId}/put](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes/paths/~1api~1v3~1passes~1{passId}/put) Update Pass/api/v3/passes/{passId}

puthttps://marketplace-api.wildberries.ru/api/v3/passes/{passId}

https://marketplace-api.wildberries.ru/api/v3/passes/{passId}

Method description

Updates the seller's pass detail

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| passId<br>required | integer<int64><br>Example:45<br>Pass ID |

##### Request Body schema: application/json  required

The total length of the full name is limited from 6 to 100 characters. The car number can contain only letters and numbers.

|     |     |
| --- | --- |
| firstName<br>required | stringnon-empty<br>First name |
| lastName<br>required | stringnon-empty<br>Last name |
| carModel<br>required | string\[ 1 .. 100 \] characters<br>Car model |
| carNumber<br>required | string\[ 6 .. 9 \] characters<br>Car number |
| officeId<br>required | integer<int64>>= 1<br>Office ID |

### Responses

**204**

Updated

**400**

Bad request

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"firstName": "Alex",

"lastName": "Petrov",

"carModel": "Lamborghini",

"carNumber": "A456BC123",

"officeId": 15

}`

### Response samples

- 400
- 401
- 403
- 404
- 429

Content type

application/json

Example

IncorrectRequestBodyWarehouseNameInvalidIncorrectRequestBody

Copy

`{"message": "Incorrect request body"

}`

## [tag/FBS-Passes/paths/~1api~1v3~1passes~1{passId}/delete](https://dev.wildberries.ru/en/openapi/orders-fbs\#tag/FBS-Passes/paths/~1api~1v3~1passes~1{passId}/delete) Delete the Pass/api/v3/passes/{passId}

deletehttps://marketplace-api.wildberries.ru/api/v3/passes/{passId}

https://marketplace-api.wildberries.ru/api/v3/passes/{passId}

Method description

Deletes the seller's pass

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for **FBS assembly orders, supplies and passes** methods:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 300 requests | 200 milliseconds | 20 requests |

One request with a response code of `409` is counted as 10 requests

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| passId<br>required | integer<int64><br>Example:45<br>Pass ID |

### Responses

**204**

Deleted

**401**

Unauthorized

**403**

Access denied

**404**

Not found

**429**

Too many requests

### Response samples

- 401
- 403
- 404
- 429

Content type

application/json

Copy

`{"title": "unauthorized",

"detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",

"code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",

"requestId": "7b80742415072fe8b6b7f7761f1d1211",

"origin": "s2s-api-auth-catalog",

"status": 401,

"statusText": "Unauthorized",

"timestamp": "2024-09-30T06:52:38Z"

}`

We use [cookies](https://dev.wildberries.ru/privacy) to collect statistics and improve our service

Accept

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Marketplace
- **Модель доставки:** FBS (Fulfillment by Seller) - доставка со склада продавца
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/orders-fbs

