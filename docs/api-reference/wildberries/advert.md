# Promotion (Advert) API

> **Base URL:** `https://advert-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 10
> **Документация:** https://dev.wildberries.ru/openapi/promotion
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Рекламные кампании на Wildberries

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

  - Campaigns

  - Campaigns Creation

    - GET

      Promotional Configuration Values/adv/v0/config

    - POST

      Minimum Bids for Product Cards/adv/v0/bids/min

    - POST

      Minimum Bids for Product Cards/api/advert/v1/bids/min

    - POST

      Create Campaign/adv/v2/seacat/save-ad

    - GET

      Subjects for Campaigns/adv/v1/supplier/subjects

    - POST

      Product Cards for Campaigns/adv/v2/supplier/nms
  - Campaigns Management

  - Campaign Parameters

  - Search Clusters

  - Finance

  - Media

  - Statistics

  - Promotions Calendar
- Customer Communication

- Tariffs

- Analytics and Data

- Reports

- Documents and Accounting

- Wildberries Digital


- Marketing and Promotions
- Campaigns
  - getCampaigns Lists/adv/v1/promotion/count
  - postCampaigns Information/adv/v1/promotion/adverts
  - getCustom Bid Campaigns Information/adv/v0/auction/adverts
  - getCampaigns Information/api/advert/v2/adverts
- Campaigns Creation
  - getPromotional Configuration Values/adv/v0/config
  - postMinimum Bids for Product Cards/adv/v0/bids/min
  - postMinimum Bids for Product Cards/api/advert/v1/bids/min
  - postCreate Campaign/adv/v2/seacat/save-ad
  - getSubjects for Campaigns/adv/v1/supplier/subjects
  - postProduct Cards for Campaigns/adv/v2/supplier/nms
- Campaigns Management
  - getDelete Campaign/adv/v0/delete
  - postRename Campaign/adv/v0/rename
  - getLaunch Campaign/adv/v0/start
  - getPause Campaign/adv/v0/pause
  - getStop Campaign/adv/v0/stop
  - patchChanging Bids/adv/v0/bids
  - putChanging Placements in Campaigns with Custom Bid/adv/v0/auction/placements
  - patchChanging Campaigns Bids/adv/v0/auction/bids
  - patchChanging Campaigns Bids/api/advert/v1/bids
- Campaign Parameters
  - getManaging the Activity of Fixed Phrases/adv/v1/search/set-plus
  - postSetting/Deleting Fixed Phrases/adv/v1/search/set-plus
  - postSetting/Removing Minus Phrases from Search/adv/v1/search/set-excluded
  - postSetting/Removing Minus-phrases for Campaigns with Standard Bid/adv/v1/auto/set-excluded
  - getList of Product Cards for Campaign with Standard Bid/adv/v1/auto/getnmtoadd
  - postChanging the List of Product Cards in a Campaign with Standard Bid/adv/v1/auto/updatenm
  - patchChanging the List of Product Cards in Campaigns/adv/v0/auction/nms
  - postSetting and Deleting Minus Phrases/adv/v0/normquery/set-minus
- Search Clusters
  - postList of Search Clusters Bids/adv/v0/normquery/get-bids
  - postSet Bids for Search Clusters/adv/v0/normquery/bids
  - delDelete Bids from Search Clusters/adv/v0/normquery/bids
  - postList of Campaign Minus Phrases/adv/v0/normquery/get-minus
- Finance
  - getBalance/adv/v1/balance
  - getCampaign Budget/adv/v1/budget
  - postTop-up of the Campaign Budget/adv/v1/budget/deposit
  - getReceiving Costs History/adv/v1/upd
  - getReceiving the History of Account Top-ups/adv/v1/payments
- Media
  - getMedia Campaigns Number/adv/v1/count
  - getList of Media Campaigns/adv/v1/adverts
  - getInformation About Media Campaign/adv/v1/advert
- Statistics
  - postSearch Clusters Statistics/adv/v0/normquery/stats
  - postCampaigns Statistics/adv/v2/fullstats
  - getCampaigns Statistics/adv/v3/fullstats
  - getStatistics of a Campaign with Standard Bid by Phrase Clusters/adv/v2/auto/stat-words
  - getStatistics on Keywords for Campaign with Custom Bid/adv/v1/stat/words
  - getStatistics on Keywords/adv/v0/stats/keywords
  - postMedia Campaign Statistics/adv/v1/stats
- Promotions Calendar
  - getPromotions List/api/v1/calendar/promotions
  - getPromotions Details/api/v1/calendar/promotions/details
  - getList of Products for Participating in the Promotion/api/v1/calendar/promotions/nomenclatures
  - postAdd Product to the Promotion/api/v1/calendar/promotions/upload

# Marketing and Promotions(promotion)

Campaign Management, bid settings, financial data accounting, and settings for with standard and custom bid and media campaigns.

Data synchronization from the database occurs every 3 minutes. Status changes occur every 1 minute. The bid change occurs every 30 seconds. The latest changes are saved within the intervals

# [tag/Marketing-and-Promotions](https://dev.wildberries.ru/en/openapi/promotion\#tag/Marketing-and-Promotions) Marketing and Promotions

Campaign Management, bid settings, financial data accounting, and settings for with standard and custom bid and media campaigns.

Data synchronization from the database occurs every 3 minutes. Status changes occur every 1 minute. The bid change occurs every 30 seconds. The latest changes are saved within the intervals

# [tag/Campaigns](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns) Campaigns

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Campaigns/paths/~1adv~1v1~1promotion~1count/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns/paths/~1adv~1v1~1promotion~1count/get) Campaigns Lists/adv/v1/promotion/count

gethttps://advert-api.wildberries.ru/adv/v1/promotion/count

https://advert-api.wildberries.ru/adv/v1/promotion/count

Method description

Method allows to get campaigns lists grouped by type and status with information about last campaign change date.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

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
ExpandCollapse

`{"adverts": [{"type": 9,\
\
"status": 8,\
\
"count": 3,\
\
"advert_list": [{"advertId": 6485174,\
\
"changeTime": "2023-05-10T12:12:52.676254+03:00"\
\
},\
\
{"advertId": 6500443,\
\
"changeTime": "2023-05-10T17:08:46.370656+03:00"\
\
},\
\
{"advertId": 7936341,\
\
"changeTime": "2023-07-12T15:51:08.367478+03:00"\
\
}\
\
]\
\
}\
\
],

"all": 3

}`

## [tag/Campaigns/paths/~1adv~1v1~1promotion~1adverts/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns/paths/~1adv~1v1~1promotion~1adverts/post) Campaigns Information Deprecated /adv/v1/promotion/adverts

posthttps://advert-api.wildberries.ru/adv/v1/promotion/adverts

https://advert-api.wildberries.ru/adv/v1/promotion/adverts

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| status | integer<br>Enum:-1478911<br>Campaign status:<br>- `-1` — deleted, the deletion process will be completed within 10 minutes<br>- `4` — ready to be launched<br>- `7` — completed<br>- `8` — declined<br>- `9` — active<br>- `11` — paused |
| type | integer<br>Value:8<br>Campaign type:<br>- `8` — standard bid |
| order | string<br>Enum:"create""change""id"<br>Order:<br>- `create` — by the time of campaign creation<br>- `change` — by the time of the last change to the campaign<br>- `id` — by the campaign identifier |
| direction | string<br>Enum:"desc""asc"<br>Direction:<br>- `desc` — from greater to lesser<br>- `asc` — from lesser to greater |

##### Request Body schema: application/json  required

Array

integer

List of campaign IDs. A Maximum of of 50.

You can get campaign IDs using the [Campaign Lists](https://dev.wildberries.ru/en/openapi/promotion#tag/Campaigns/paths/~1adv~1v1~1promotion~1count/get) method

### Responses

**200**

Success

**204**

Campaigns not found

**400**

Bad request

**401**

Unauthorized

**422**

Error processing request parameters

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`[1234567,\
\
63453471\
\
]`

### Response samples

- 200
- 400
- 401
- 422
- 429

Content type

application/json

Example

ResponseInfoAdvertType8ResponseInfoAdvertsAllResponseInfoAdvertType8

Copy
ExpandCollapse

`[{"endTime": "2023-10-05T21:37:37.226021+03:00",\
\
"createTime": "2023-08-21T13:45:31.121172+03:00",\
\
"changeTime": "2023-08-21T14:59:33.622594+03:00",\
\
"startTime": "2023-08-21T13:45:31.147601+03:00",\
\
"autoParams": {"subject": {"name": "Обложки",\
\
"id": 342\
\
},\
\
"sets": [{"name": "для женщин",\
\
"id": 623\
\
}\
\
],\
\
"nms": [1234567\
\
],\
\
"active": {"carousel": true,\
\
"recom": true,\
\
"booster": true\
\
},\
\
"nmCPM": [{"nm": 1234567,\
\
"cpm": 150\
\
}\
\
]\
\
},\
\
"name": "Кампания1",\
\
"dailyBudget": 0,\
\
"advertId": 11111111,\
\
"status": 7,\
\
"type": 8,\
\
"paymentType": "cpm"\
\
}\
\
]`

## [tag/Campaigns/paths/~1adv~1v0~1auction~1adverts/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns/paths/~1adv~1v0~1auction~1adverts/get) Custom Bid Campaigns Information Deprecated /adv/v0/auction/adverts

gethttps://advert-api.wildberries.ru/adv/v0/auction/adverts

https://advert-api.wildberries.ru/adv/v0/auction/adverts

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| ids | string<br>Example:ids=12345,23456,34567,45678,56789<br>Campaign IDs, maximum 50 values |
| statuses | string<br>Enum:"-1""4""7""8""9""11"<br>Example:statuses=-1,4,8<br>Campaign statuses:<br>- `-1` — deleted, the deletion process will be completed within 10 minutes<br>- `4` — ready to be launched<br>- `7` — completed<br>- `8` — declined<br>- `9` — active<br>- `11` — paused |
| payment\_type | string<br>Enum:"cpm""cpc"<br>Рayment type:<br>- `cpm` — cost per mille<br>- `cpc` — cost per click |

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
ExpandCollapse

`{"adverts": [{"id": 18298989\
\
},\
\
{"nm_settings": [{"bids": {"recommendations": 0,\
\
"search": 150\
\
},\
\
"subject": {"id": 69,\
\
"name": "платья"\
\
},\
\
"nm_id": 139312996\
\
}\
\
]\
\
},\
\
{"settings": {"name": "Кампания 34",\
\
"payment_type": "cpc",\
\
"placements": {"recommendations": false,\
\
"search": true\
\
}\
\
}\
\
},\
\
{"status": 7\
\
},\
\
{"timestamps": {"created": "2024-06-28T15:49:02.031402+03:00",\
\
"deleted": "2024-07-03T13:53:42.260198+03:00",\
\
"started": "2024-07-01T23:32:09.083098+03:00",\
\
"updated": "2025-07-30T10:23:55.719721+03:00"\
\
}\
\
},\
\
{"bid_type": "manual"\
\
}\
\
]

}`

## [tag/Campaigns/paths/~1api~1advert~1v2~1adverts/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns/paths/~1api~1advert~1v2~1adverts/get) Campaigns Information/api/advert/v2/adverts

gethttps://advert-api.wildberries.ru/api/advert/v2/adverts

https://advert-api.wildberries.ru/api/advert/v2/adverts

Method description

The method returns information about campaigns with standard or custom bid via statuses, payment types and IDs.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| ids | string<br>Example:ids=12345,23456,34567,45678,56789<br>Campaign IDs, maximum 50 |
| statuses | string<br>Enum:"-1""4""7""8""9""11"<br>Example:statuses=-1,4,8<br>Campaign statuses:<br>- `-1` — deleted, the deletion process will be completed within 10 minutes<br>- `4` — ready to be launched<br>- `7` — completed<br>- `8` — declined<br>- `9` — active<br>- `11` — paused |
| payment\_type | string<br>Enum:"cpm""cpc"<br>Рayment type:<br>- `cpm` — cost per mille<br>- `cpc` — cost per click |

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
ExpandCollapse

`{"adverts": [{"bid_type": "manual",\
\
"id": 567456457,\
\
"nm_settings": [{"bids_kopecks": {"recommendations": 0,\
\
"search": 0\
\
},\
\
"nm_id": 123456789,\
\
"subject": {"id": 52,\
\
"name": "кошельки"\
\
}\
\
},\
\
{"bids_kopecks": {"recommendations": 11200,\
\
"search": 11200\
\
},\
\
"nm_id": 987654321,\
\
"subject": {"id": 54,\
\
"name": "ювелирные кольца"\
\
}\
\
}\
\
],\
\
"settings": {"name": "Кампания от 01.02.2024",\
\
"payment_type": "cpm",\
\
"placements": {"recommendations": false,\
\
"search": true\
\
}\
\
},\
\
"status": 7,\
\
"timestamps": {"created": "2024-02-01T09:57:38.500606+03:00",\
\
"deleted": "2024-02-05T14:29:32.633968+03:00",\
\
"started": "2024-02-05T12:38:10.212086+03:00",\
\
"updated": "2024-02-05T14:29:32.633968+03:00"\
\
}\
\
},\
\
{"bid_type": "manual",\
\
"id": 28150154,\
\
"nm_settings": [{"bids_kopecks": {"recommendations": 0,\
\
"search": 1100\
\
},\
\
"nm_id": 5764746785,\
\
"subject": {"id": 69,\
\
"name": "платья"\
\
}\
\
}\
\
],\
\
"settings": {"name": "Кампания от 28.08.2025 ",\
\
"payment_type": "cpc",\
\
"placements": {"recommendations": false,\
\
"search": true\
\
}\
\
},\
\
"status": 11,\
\
"timestamps": {"created": "2025-08-28T09:50:57.611559+03:00",\
\
"deleted": "2100-01-01T00:00:00+03:00",\
\
"started": null,\
\
"updated": "2025-09-10T10:14:58.475499+03:00"\
\
}\
\
}\
\
]

}`

# [tag/Campaigns-Creation](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation) Campaigns Creation

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Campaigns-Creation/paths/~1adv~1v0~1config/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1adv~1v0~1config/get) Promotional Configuration Values Deprecated /adv/v0/config

gethttps://advert-api.wildberries.ru/adv/v0/config

https://advert-api.wildberries.ru/adv/v0/config

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

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
ExpandCollapse

`{"categories": [{"id": 760,\
\
"name": "Автомобильные товары",\
\
"cpm_min": 112\
\
}\
\
],

"config": [{"description": "Минимальный бюджет кампании",\
\
"name": "budget_min",\
\
"value": "1000"\
\
},\
\
{"description": "Максимальный период в днях, за который можно получить статистику",\
\
"name": "api_fullstat_day_depth",\
\
"value": "31"\
\
},\
\
{"description": "Минимальная ставка CPM для кампаний с ручной ставкой",\
\
"name": "cpm_min_booster",\
\
"value": "100"\
\
},\
\
{"description": "Минимальная ставка CPM для кампаний с единой ставкой",\
\
"name": "cpm_min_search_catalog",\
\
"value": "150"\
\
},\
\
{"description": "Максимальное количество товаров для кампаний с ручной ставкой",\
\
"name": "max_nm_count",\
\
"value": "50"\
\
},\
\
{"description": "Максимальное количество товаров для кампаний с единой ставкой",\
\
"name": "max_auto_nms",\
\
"value": "100"\
\
}\
\
]

}`

## [tag/Campaigns-Creation/paths/~1adv~1v0~1bids~1min/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1adv~1v0~1bids~1min/post) Minimum Bids for Product Cards Deprecated /adv/v0/bids/min

posthttps://advert-api.wildberries.ru/adv/v0/bids/min

https://advert-api.wildberries.ru/adv/v0/bids/min

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| advert\_id<br>required | integer<int64><br>Campaign ID |
| nm\_ids<br>required | Array of integers<int64>\[ 1 .. 100 \] characters\[ items <int64 > \]<br>WB articles array |
| payment\_type<br>required | string<br>Enum:"cpm""cpc"<br>Payment type:<br>- `cpm` — per mille<br>- `cpc` — per click |
| placement\_types<br>required | Array of strings<br>ItemsEnum:"combined""search""recommendation"<br>Placements:<br>- `search` — search<br>- `recommendation` — recommendation<br>- `combined` — search and recommendation |

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
ExpandCollapse

`{"advert_id": 98765432,

"nm_ids": [12345678,\
\
87654321\
\
],

"payment_type": "cpm",

"placement_types": ["combined",\
\
"search",\
\
"recommendation"\
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
ExpandCollapse

`{"bids": [{"bids": [{"type": "combined",\
\
"value": 155\
\
},\
\
{"type": "search",\
\
"value": 250\
\
},\
\
{"type": "recommendation",\
\
"value": 250\
\
}\
\
],\
\
"nm_id": 12345678\
\
},\
\
{"bids": [{"type": "combined",\
\
"value": 155\
\
},\
\
{"type": "search",\
\
"value": 250\
\
},\
\
{"type": "recommendation",\
\
"value": 250\
\
}\
\
],\
\
"nm_id": 87654321\
\
}\
\
]

}`

## [tag/Campaigns-Creation/paths/~1api~1advert~1v1~1bids~1min/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1api~1advert~1v1~1bids~1min/post) Minimum Bids for Product Cards/api/advert/v1/bids/min

posthttps://advert-api.wildberries.ru/api/advert/v1/bids/min

https://advert-api.wildberries.ru/api/advert/v1/bids/min

Method description

Method allows minimum bids for product cards in kopecks depending on the payment type and placements.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 20 requests | 3 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| advert\_id<br>required | integer<int64><br>Campaign ID |
| nm\_ids<br>required | Array of integers<int64>\[ 1 .. 100 \] characters\[ items <int64 > \]<br>WB articles list |
| payment\_type<br>required | string<br>Enum:"cpm""cpc"<br>Payment type:<br>- `cpm` — per mille<br>- `cpc` — per click |
| placement\_types<br>required | Array of strings<br>ItemsEnum:"combined""search""recommendation"<br>Placements:<br>- `search` — search<br>- `recommendation` — recommendation<br>- `combined` — search and recommendation |

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
ExpandCollapse

`{"advert_id": 98765432,

"nm_ids": [12345678,\
\
87654321\
\
],

"payment_type": "cpm",

"placement_types": ["combined",\
\
"search",\
\
"recommendation"\
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
ExpandCollapse

`{"bids": [{"bids": [{"type": "combined",\
\
"value": 155\
\
},\
\
{"type": "search",\
\
"value": 250\
\
},\
\
{"type": "recommendation",\
\
"value": 250\
\
}\
\
],\
\
"nm_id": 12345678\
\
},\
\
{"bids": [{"type": "combined",\
\
"value": 155\
\
},\
\
{"type": "search",\
\
"value": 250\
\
},\
\
{"type": "recommendation",\
\
"value": 250\
\
}\
\
],\
\
"nm_id": 87654321\
\
}\
\
]

}`

## [tag/Campaigns-Creation/paths/~1adv~1v2~1seacat~1save-ad/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1adv~1v2~1seacat~1save-ad/post) Create Campaign/adv/v2/seacat/save-ad

posthttps://advert-api.wildberries.ru/adv/v2/seacat/save-ad

https://advert-api.wildberries.ru/adv/v2/seacat/save-ad

Method description

The method creates campaign:

- with custom bid for promotion products in search and/or recommendations
- with standard bid for promotion products both in search and recommendations

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 5 requests | 12 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| name | string<br>Campaign name |
| nms | Array of integers<br>Product card for this campaign. You can available product cards with [product cards for campaigns](https://dev.wildberries.ru/en/openapi/promotion#tag/Campaigns-Creation/paths/~1adv~1v2~1supplier~1nms/post) method. Maximum of 50 products (`nm`) |
| bid\_type | string<br>Default:"manual"<br>Enum:"manual""unified"<br>Тип ставки:<br>- `manual` — ручная<br>- `unified` — единая |
| payment\_type | string<br>Default:"cpm"<br>Enum:"cpm""cpc"<br>Рayment type:<br>- `cpm` — cost per mille<br>- `cpc` — cost per click. When creating a campaign with this payment type, a minimum bid is automatically set |
| placement\_types | Array of strings<br>Default:\["search"\]<br>ItemsEnum:"search""recommendations"<br>Placements:<br>- `search` — search<br>- `recommendations` — recommendations<br>Specify for campaign with custom bid only |

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
ExpandCollapse

`{"name": "Телефоны",

"nms": [146168367,\
\
200425104\
\
],

"bid_type": "manual",

"placement_types": ["search",\
\
"recommendations"\
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

`1234567`

## [tag/Campaigns-Creation/paths/~1adv~1v1~1supplier~1subjects/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1adv~1v1~1supplier~1subjects/get) Subjects for Campaigns/adv/v1/supplier/subjects

gethttps://advert-api.wildberries.ru/adv/v1/supplier/subjects

https://advert-api.wildberries.ru/adv/v1/supplier/subjects

Method description

Returns subjects product cards from which are available for all campaigns

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 12 seconds | 1 request | 12 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| payment\_type | string<br>Default:"cpm"<br>Рayment type:<br>- `cpm` — cost per mille<br>- `cpc` — cost per click |

### Responses

**200**

Success

**401**

Unauthorized

**404**

Not found

**429**

Too many requests

### Response samples

- 200
- 401
- 429

Content type

application/json

Example

ArraynullArray

Copy
ExpandCollapse

`[{"name": "3D очки",\
\
"id": 2560,\
\
"count": 1899\
\
}\
\
]`

## [tag/Campaigns-Creation/paths/~1adv~1v2~1supplier~1nms/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Creation/paths/~1adv~1v2~1supplier~1nms/post) Product Cards for Campaigns/adv/v2/supplier/nms

posthttps://advert-api.wildberries.ru/adv/v2/supplier/nms

https://advert-api.wildberries.ru/adv/v2/supplier/nms

Method description

Returns product cards that are available for all campaigns.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 5 requests | 12 seconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

ID of subjects to get product cards

Array

integer

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

`[123,\
\
456,\
\
765,\
\
321\
\
]`

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Copy
ExpandCollapse

`[{"title": "Плед",\
\
"nm": 146168367,\
\
"subjectId": 765\
\
}\
\
]`

# [tag/Campaigns-Management](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management) Campaigns Management

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Campaigns-Management/paths/~1adv~1v0~1delete/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1delete/get) Delete Campaign/adv/v0/delete

gethttps://advert-api.wildberries.ru/adv/v0/delete

https://advert-api.wildberries.ru/adv/v0/delete

Method description

The method allows to delete campaigns in the status `4` — ready to launch.

After deleting, the campaign will be in `-1` status for a while.

It takes between 3 and 10 minutes to completely delete the campaign.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Campaign ID |

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

- 400
- 401
- 429

Content type

application/json

Invalid campaign identifier

Copy

`{"error": "Invalid campaign identifier"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1rename/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1rename/post) Rename Campaign/adv/v0/rename

posthttps://advert-api.wildberries.ru/adv/v0/rename

https://advert-api.wildberries.ru/adv/v0/rename

Method description

The method allows to rename a campaign.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| advertId<br>required | integer<br>ID of the campaign where the name is changing |
| name<br>required | string<br>New name (max 100 characters) |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Error processing request parameters

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"advertId": 2233344,

"name": "newnmame"

}`

### Response samples

- 400
- 401
- 422
- 429

Content type

text/plain

Example

InvalidRcIdAdvIncorrectNameIncorrectSupplierIdAdvInvalidRcIdAdv

Copy

```
Incorrect campaign identifier (RC ID)
```

## [tag/Campaigns-Management/paths/~1adv~1v0~1start/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1start/get) Launch Campaign/adv/v0/start

gethttps://advert-api.wildberries.ru/adv/v0/start

https://advert-api.wildberries.ru/adv/v0/start

Method description

The method allows to run campaigns that are in statuses `4` — ready to launch or `11` — paused campaign.

To run an ad campaign with status `11`, check its budget. If the budget is insufficient, replenish it.

To run a campaign with status `4`, it is necessary to do following (the order of actions does not matter):

1. After creating a campaign in the WB. Promotion cabinet click the `Apply changes` button.
2. Set the budget.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234<br>Campaign ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Status not changed

**429**

Too many requests

### Response samples

- 400
- 401
- 422
- 429

Content type

application/json

Example

IncorrectIdAdvertNotFoundIncorrectId

Incorrect campaign ID

Copy

`{"error": "Invalid Advert: invalid advert"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1pause/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1pause/get) Pause Campaign/adv/v0/pause

gethttps://advert-api.wildberries.ru/adv/v0/pause

https://advert-api.wildberries.ru/adv/v0/pause

Method description

Campaign in status `9` — active — can be paused

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234<br>Campaign ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Status not changed

**429**

Too many requests

### Response samples

- 400
- 401
- 422
- 429

Content type

application/json

Example

IncorrectIdAdvertNotFoundIncorrectId

Incorrect campaign ID

Copy

`{"error": "Invalid Advert: invalid advert"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1stop/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1stop/get) Stop Campaign/adv/v0/stop

gethttps://advert-api.wildberries.ru/adv/v0/stop

https://advert-api.wildberries.ru/adv/v0/stop

Method description

The method allows to end campaigns in statuses:

- `4` — ready to launch
- `9` — active
- `11` — paused

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234<br>Campaign ID |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Status not changed

**429**

Too many requests

### Response samples

- 400
- 401
- 422
- 429

Content type

application/json

Example

IncorrectIdAdvertNotFoundIncorrectId

Incorrect campaign ID

Copy

`{"error": "Invalid Advert: invalid advert"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1bids/patch](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1bids/patch) Changing Bids Deprecated /adv/v0/bids

patchhttps://advert-api.wildberries.ru/adv/v0/bids

https://advert-api.wildberries.ru/adv/v0/bids

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| bids<br>required | Array of objects (V0AdvertMultibid) <= 20 items |

### Responses

**204**

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
ExpandCollapse

`{"bids": [{"advert_id": 6348555,\
\
"nm_bids": [{"nm": 3462354,\
\
"bid": 500\
\
}\
\
]\
\
}\
\
]

}`

### Response samples

- 400
- 401
- 429

Content type

application/json

Example

CampaignIsNotUniqueCanNotDeserializeResponseBodyCampaignNotFoundNmNotFoundWrongCampaignIDWrongCampaignStatusWrongBidValueCampaignIsNotUnique

Duplicate campaign ID.

The position of the campaign in the bids array of the request is indicated in `.bids[n]`

Copy
ExpandCollapse

`{"errors": [{"detail": "advert 1234567 is not unique",\
\
"field": ".bids[2]"\
\
}\
\
],

"request_id": "2c991dcab0fe971e8c0321c340a8c7fd",

"status": 400,

"title": "invalid payload",

"type": "Bad Request"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1auction~1placements/put](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1auction~1placements/put) Changing Placements in Campaigns with Custom Bid/adv/v0/auction/placements

puthttps://advert-api.wildberries.ru/adv/v0/auction/placements

https://advert-api.wildberries.ru/adv/v0/auction/placements

Method description

The method allows you to change placements in campaigns with custom bid and per mille payment model — `cpm`.

For campaigns in statuses `4`, `9` and `11`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 1 request |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| placements<br>required | Array of objects<= 50 items<br>Placements in campaigns |

### Responses

**204**

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
ExpandCollapse

`{"placements": [{"advert_id": 12345,\
\
"placements": {"search": true,\
\
"recommendations": true\
\
}\
\
}\
\
]

}`

### Response samples

- 400
- 401
- 429

Content type

application/json

Example

BadRequestBadAdvertPaymentTypeBadRequest

Copy

`{"detail": "can not deserialize response body",

"origin": "camp-api-public-cache",

"request_id": "9a929a81ea9dc1601fcc4be81f32c1cb",

"status": 400,

"title": "invalid payload"

}`

## [tag/Campaigns-Management/paths/~1adv~1v0~1auction~1bids/patch](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1adv~1v0~1auction~1bids/patch) Changing Campaigns Bids Deprecated /adv/v0/auction/bids

patchhttps://advert-api.wildberries.ru/adv/v0/auction/bids

https://advert-api.wildberries.ru/adv/v0/auction/bids

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| bids<br>required | Array of objects<= 50 items<br>Bids in campaigns |

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
ExpandCollapse

`{"bids": [{"advert_id": 12345,\
\
"nm_bids": [{"nm_id": 13335157,\
\
"bid": 250,\
\
"placement": "recommendations"\
\
}\
\
]\
\
}\
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
ExpandCollapse

`{"bids": [{"advert_id": 12345,\
\
"nm_bids": [{"nm_id": 13335157,\
\
"bid": 250,\
\
"placement": "recommendations"\
\
}\
\
]\
\
}\
\
]

}`

## [tag/Campaigns-Management/paths/~1api~1advert~1v1~1bids/patch](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaigns-Management/paths/~1api~1advert~1v1~1bids/patch) Changing Campaigns Bids/api/advert/v1/bids

patchhttps://advert-api.wildberries.ru/api/advert/v1/bids

https://advert-api.wildberries.ru/api/advert/v1/bids

Method description

The method changes the bids of product cards by WB articles in campaigns with standard bid or custom bid.

For campaigns in statuses `4`, `9` and `11`.

Specify the placement in the request parameter `placement`:

- `combined` — in search and recommendations for campaigns with standard bid
- `search`or `recommendations` — in search or recommendations for campaigns with custom bid

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| bids<br>required | Array of objects<= 50 items<br>Bids in campaigns, kopecks |

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
ExpandCollapse

`{"bids": [{"advert_id": 12345,\
\
"nm_bids": [{"nm_id": 13335157,\
\
"bid_kopecks": 250,\
\
"placement": "recommendations"\
\
}\
\
]\
\
}\
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
ExpandCollapse

`{"bids": [{"advert_id": 12345,\
\
"nm_bids": [{"nm_id": 13335157,\
\
"bid": 250,\
\
"placement": "recommendations"\
\
}\
\
]\
\
}\
\
]

}`

# [tag/Campaign-Parameters](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters) Campaign Parameters

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-plus/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-plus/get) Managing the Activity of Fixed Phrases Deprecated /adv/v1/search/set-plus

gethttps://advert-api.wildberries.ru/adv/v1/search/set-plus

https://advert-api.wildberries.ru/adv/v1/search/set-plus

Method description

This method is deprecated. It will be removed on [January 15](https://dev.wildberries.ru/en/release-notes?id=385)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234567<br>Campaign ID |
| fixed | boolean<br>New state (`false` — make inactive, `true` — make active) |

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

- 400
- 401
- 429

Content type

application/json

Copy

`"Bad request"`

## [tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-plus/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-plus/post) Setting/Deleting Fixed Phrases Deprecated /adv/v1/search/set-plus

posthttps://advert-api.wildberries.ru/adv/v1/search/set-plus

https://advert-api.wildberries.ru/adv/v1/search/set-plus

Method description

This method is deprecated. It will be removed on [January 15](https://dev.wildberries.ru/en/release-notes?id=385)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234567<br>Campaign ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| pluse | Array of strings<br>Fixed phrase list (max. 100) |

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
ExpandCollapse

`{"pluse": ["Фраза 1",\
\
"Фраза 2"\
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

`["Фраза 1",\
\
"Фраза 2"\
\
]`

## [tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-excluded/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1search~1set-excluded/post) Setting/Removing Minus Phrases from Search Deprecated /adv/v1/search/set-excluded

posthttps://advert-api.wildberries.ru/adv/v1/search/set-excluded

https://advert-api.wildberries.ru/adv/v1/search/set-excluded

Method description

This method is deprecated. It will be removed on [February 2](https://dev.wildberries.ru/en/release-notes?id=388)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234567<br>Campaign ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| excluded | Array of strings<br>List of minus-phrases, up to 1000 phrases |

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
ExpandCollapse

`{"excluded": ["что-то синее",\
\
"картошечка"\
\
]

}`

### Response samples

- 401
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

## [tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1set-excluded/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1set-excluded/post) Setting/Removing Minus-phrases for Campaigns with Standard Bid Deprecated /adv/v1/auto/set-excluded

posthttps://advert-api.wildberries.ru/adv/v1/auto/set-excluded

https://advert-api.wildberries.ru/adv/v1/auto/set-excluded

Method description

This method is deprecated. It will be removed on [January 15](https://dev.wildberries.ru/en/release-notes?id=385)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234567<br>Campaign ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| excluded | Array of strings<br>List of phrases (Maximum of 1000 pcs) |

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

Example

SettingMinusPhraseRemovingMinusPhraseSettingMinusPhrase

Setting minus phrases

Copy
ExpandCollapse

`{"excluded": ["первая фраза",\
\
"вторая фраза"\
\
]

}`

### Response samples

- 400
- 401
- 429

Content type

application/json

Example

InvalidCampaignIdInvalidPayloadBodyInvalidCampaignId

Incorrect campaign ID

Copy

`{"error": "Invalid Params: invalid advert ID"

}`

## [tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1getnmtoadd/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1getnmtoadd/get) List of Product Cards for Campaign with Standard Bid/adv/v1/auto/getnmtoadd

gethttps://advert-api.wildberries.ru/adv/v1/auto/getnmtoadd

https://advert-api.wildberries.ru/adv/v1/auto/getnmtoadd

Method description

The method allows to get the list of product cards available for adding to the campaign.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1<br>Campaign ID |

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

`[1111111111,\
\
2222222222,\
\
3333333333,\
\
4444444444\
\
]`

## [tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1updatenm/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1updatenm/post) Changing the List of Product Cards in a Campaign with Standard Bid/adv/v1/auto/updatenm

posthttps://advert-api.wildberries.ru/adv/v1/auto/updatenm

https://advert-api.wildberries.ru/adv/v1/auto/updatenm

Method description

The method allows you to add and remove product cards.

It is possible to add only those product cards that will be returned in the method response [List of product cards in an campaign with standard bid](https://dev.wildberries.ru/en/openapi/promotion#tag/Campaign-Parameters/paths/~1adv~1v1~1auto~1getnmtoadd/get).

You cannot delete a one single product card from a campaign.

There is no validation by the `delete` parameter.

If you receive a response with a status code of 200 and no change has occurred, check the request for documentation compliance

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 60 requests | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1<br>Campaign ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| add | Array of integers<br>The product cards that need to be added |
| delete | Array of integers<br>The product cards that need to be deleted |

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
ExpandCollapse

`{"add": [11111111,\
\
44444444\
\
],

"delete": [55555555\
\
]

}`

### Response samples

- 400
- 401
- 429

Content type

application/json

Copy

`{"error": "Not found"

}`

## [tag/Campaign-Parameters/paths/~1adv~1v0~1auction~1nms/patch](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v0~1auction~1nms/patch) Changing the List of Product Cards in Campaigns/adv/v0/auction/nms

patchhttps://advert-api.wildberries.ru/adv/v0/auction/nms

https://advert-api.wildberries.ru/adv/v0/auction/nms

Method description

The method allows you to add and remove product cards in campaigns.

For campaigns in statuses `4`, `9` and `11`.

The current minimum bid is set for the added products.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 1 request |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| nms<br>required | Array of objects<= 20 items<br>Product cards in campaigns |

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
ExpandCollapse

`{"nms": [{"advert_id": 12345,\
\
"nms": {"add": [11111111,\
\
44444444\
\
],\
\
"delete": [55555555\
\
]\
\
}\
\
}\
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
ExpandCollapse

`{"nms": [{"advert_id": 12345,\
\
"nms": {"added": [11111111,\
\
44444444\
\
],\
\
"deleted": [55555555\
\
]\
\
}\
\
}\
\
]

}`

## [tag/Campaign-Parameters/paths/~1adv~1v0~1normquery~1set-minus/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Campaign-Parameters/paths/~1adv~1v0~1normquery~1set-minus/post) Setting and Deleting Minus Phrases/adv/v0/normquery/set-minus

posthttps://advert-api.wildberries.ru/adv/v0/normquery/set-minus

https://advert-api.wildberries.ru/adv/v0/normquery/set-minus

Method description

The method sets and deletes the minus phrases in campaigns with:

- custom bid
- a `cpm` payment model — per displays

Sending an empty array deletes all minus phrases

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| advert\_id<br>required | integer<br>Campaign ID |
| nm\_id<br>required | integer<br>WB article |
| norm\_queries<br>required | Array of strings<= 1000 items |

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

`{"advert_id": 1825035,

"nm_id": 983512347,

"norm_queries": ["Фраза 1"\
\
]

}`

### Response samples

- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"detail": "invalid payment_type value",

"origin": "camp-api-public-cache",

"request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",

"status": 400,

"title": "invalid payload"

}`

# [tag/Search-Clusters](https://dev.wildberries.ru/en/openapi/promotion\#tag/Search-Clusters) Search Clusters

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

**Search Clusters**

**Request cluster** is a grouped list of requests that buyers use to search for products on WB. The cluster includes:

- synonyms
- requests in different genders
- requests with typos
- different word forms
- phrases with similar meanings

For example, the `men t-shirt` cluster will also include requests like `mren t-shirt`, `men t-shirts with sleeves`, `man t-shirts`, and other similar phrases.

To get clusters that have already had impressions, use the [search clusters statistics](https://dev.wildberries.ru/en/openapi/promotion#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1stats/post) method.

You can [set](https://dev.wildberries.ru/en/openapi/promotion#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/post) or [delete](https://dev.wildberries.ru/en/openapi/promotion#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/delete) bids for campaigns with custom bids. Bids are individual for each search cluster.

**Exclusions**

[Set minus phrases](https://dev.wildberries.ru/en/openapi/promotion#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1set-minus/post) to exclude request clusters from campaigns. The product will not be promoted for minus phrases.

## [tag/Search-Clusters/paths/~1adv~1v0~1normquery~1get-bids/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1get-bids/post) List of Search Clusters Bids/adv/v0/normquery/get-bids

posthttps://advert-api.wildberries.ru/adv/v0/normquery/get-bids

https://advert-api.wildberries.ru/adv/v0/normquery/get-bids

Method description

The method returns a list of search clusters with bids by:

- campaign IDs
- WB articles

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| items<br>required | Array of objects (V0GetNormQueryBidsRequestItem) <= 100 items |

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

`{"items": [{"advert_id": 1825035,\
\
"nm_id": 983512347\
\
}\
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

`{"bids": [{"advert_id": 1825035,\
\
"bid": 700,\
\
"nm_id": 983512347,\
\
"norm_query": "Фраза 1"\
\
},\
\
{"advert_id": 1825035,\
\
"bid": 9000,\
\
"nm_id": 983512347,\
\
"norm_query": "Фраза 2"\
\
},\
\
{"advert_id": 1825035,\
\
"bid": 9999,\
\
"nm_id": 983512347,\
\
"norm_query": "Фраза 3"\
\
}\
\
]

}`

## [tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/post) Set Bids for Search Clusters/adv/v0/normquery/bids

posthttps://advert-api.wildberries.ru/adv/v0/normquery/bids

https://advert-api.wildberries.ru/adv/v0/normquery/bids

Method description

The method sets the bids for search clusters.

You can use this method only for campaigns with:

- custom bid
- a `cpm` payment model — per displays

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 2 requests | 500 milliseconds | 4 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| bids<br>required | Array of objects (V0SetNormQueryBidsRequestItem) <= 100 items |

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

`{"bids": [{"advert_id": 1825035,\
\
"nm_id": 983512347,\
\
"norm_query": "Фраза 1",\
\
"bid": 1000\
\
}\
\
]

}`

### Response samples

- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"detail": "invalid payment_type value",

"origin": "camp-api-public-cache",

"request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",

"status": 400,

"title": "invalid payload"

}`

## [tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/delete](https://dev.wildberries.ru/en/openapi/promotion\#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1bids/delete) Delete Bids from Search Clusters/adv/v0/normquery/bids

deletehttps://advert-api.wildberries.ru/adv/v0/normquery/bids

https://advert-api.wildberries.ru/adv/v0/normquery/bids

Method description

The method deletes the bids from search clusters.

You can use this method only for campaigns with:

- custom bid
- a `cpm` payment model — per displays

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| bids<br>required | Array of objects (V0SetNormQueryBidsRequestItem) <= 100 items |

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

`{"bids": [{"advert_id": 1825035,\
\
"nm_id": 983512347,\
\
"norm_query": "Фраза 1",\
\
"bid": 1000\
\
}\
\
]

}`

### Response samples

- 400
- 401
- 403
- 429

Content type

application/json

Copy

`{"detail": "invalid payment_type value",

"origin": "camp-api-public-cache",

"request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",

"status": 400,

"title": "invalid payload"

}`

## [tag/Search-Clusters/paths/~1adv~1v0~1normquery~1get-minus/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Search-Clusters/paths/~1adv~1v0~1normquery~1get-minus/post) List of Campaign Minus Phrases/adv/v0/normquery/get-minus

posthttps://advert-api.wildberries.ru/adv/v0/normquery/get-minus

https://advert-api.wildberries.ru/adv/v0/normquery/get-minus

Method description

The method returns a list of minus phrases by:

- campaign IDs
- WB articles

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 5 requests | 200 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| items<br>required | Array of objects (V0GetNormQueryMinusRequestItem) <= 100 items |

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

`{"items": [{"advert_id": 1825035,\
\
"nm_id": 983512347\
\
}\
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

`{"items": [{"advert_id": 1825035,\
\
"nm_id": 983512347,\
\
"norm_queries": ["Фраза 1"\
\
]\
\
}\
\
]

}`

# [tag/Finance](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance) Finance

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Finance/paths/~1adv~1v1~1balance/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance/paths/~1adv~1v1~1balance/get) Balance/adv/v1/balance

gethttps://advert-api.wildberries.ru/adv/v1/balance

https://advert-api.wildberries.ru/adv/v1/balance

Method description

The method allows to get information about the seller's net, balance and bonuses

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

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
ExpandCollapse

`{"balance": 11083,

"net": 0,

"bonus": 15187,

"cashbacks": [{"sum": 10672,\
\
"percent": 50,\
\
"expiration_date": "2026-04-17T10:46:02.176174Z"\
\
}\
\
]

}`

## [tag/Finance/paths/~1adv~1v1~1budget/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance/paths/~1adv~1v1~1budget/get) Campaign Budget/adv/v1/budget

gethttps://advert-api.wildberries.ru/adv/v1/budget

https://advert-api.wildberries.ru/adv/v1/budget

Method description

The method allows to get information about the budget of a campaign.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 4 requests | 250 milliseconds | 4 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1<br>Campaign ID |

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

`{"cash": 0,

"netting": 0,

"total": 500

}`

## [tag/Finance/paths/~1adv~1v1~1budget~1deposit/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance/paths/~1adv~1v1~1budget~1deposit/post) Top-up of the Campaign Budget/adv/v1/budget/deposit

posthttps://advert-api.wildberries.ru/adv/v1/budget/deposit

https://advert-api.wildberries.ru/adv/v1/budget/deposit

Method description

The method tops up the campaign [budget](https://dev.wildberries.ru/en/openapi/promotion#tag/Finance/paths/~1adv~1v1~1budget/get) in the status `11` — paused.

To launch the campaign after topping up the budget, use the [Launch campaign](https://dev.wildberries.ru/en/openapi/promotion#tag/Campaigns-Management/paths/~1adv~1v0~1start/get) method.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234567<br>Campaign ID |

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| sum | integer<br>Budget top-up amount |
| cashback\_sum | integer or null<br>Top-up budget sum paid with promo bonuses.<br>You can top up only a certain percentage of the amount, indicated in the `percent` field of the response from the method for getting [balance](https://dev.wildberries.ru/en/openapi/promotion#tag/Finance/paths/~1adv~1v1~1balance/get).<br>Promo bonuses are only applicable to these top-up sources:<br>- `0` — account<br>- `1` — balance sheet |
| cashback\_percent | integer or null<br>The percentage of the top-up amount that can be paid with promo bonuses. You need to specify the value of the `percent` field from the response for the method for getting \[balance\]<br>If you specified `cashback_sum`, the `cashback_percent` parameter becomes required |
| type | integer<br>Type of top-up source:<br>- `0` — Account<br>- `1` — Balance<br>- `3` — Bonuses |
| return | boolean<br>Response return flag (`true` means updated campaign budget size will be returned in the response, `false` or empty means nothing will be returned). |

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

`{"sum": 5000,

"cashback_sum": 1000,

"cashback_percent": 50,

"type": 1,

"return": true

}`

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Response when return is true

Copy

`{"total": 7289

}`

## [tag/Finance/paths/~1adv~1v1~1upd/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance/paths/~1adv~1v1~1upd/get) Receiving Costs History/adv/v1/upd

gethttps://advert-api.wildberries.ru/adv/v1/upd

https://advert-api.wildberries.ru/adv/v1/upd

Method description

The method allows to get a costs history

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| from<br>required | string<date><br>Example:from=2023-07-31<br>Beginning of the interval |
| to<br>required | string<date><br>Example:to=2023-08-02<br>End of interval. <br>(Minimum interval is 1 day, maximum is 31) |

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
ExpandCollapse

`[{"updNum": 0,\
\
"updTime": "2023-07-31T12:12:54.060536+03:00",\
\
"updSum": 24,\
\
"advertId": 3355881,\
\
"campName": "лук лучок",\
\
"advertType": 6,\
\
"paymentType": "Баланс",\
\
"advertStatus": 9\
\
},\
\
{"updNum": 0,\
\
"updTime": null,\
\
"updSum": 107,\
\
"advertId": 3366882,\
\
"campName": "золотая луковица",\
\
"advertType": 8,\
\
"paymentType": "Счет",\
\
"advertStatus": 11\
\
}\
\
]`

## [tag/Finance/paths/~1adv~1v1~1payments/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Finance/paths/~1adv~1v1~1payments/get) Receiving the History of Account Top-ups/adv/v1/payments

gethttps://advert-api.wildberries.ru/adv/v1/payments

https://advert-api.wildberries.ru/adv/v1/payments

Method description

The method allows you to get a history of top-ups.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 1 request | 1 second | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| from | string<date><br>Example:from=2023-07-31<br>Beginning of the interval |
| to | string<date><br>Example:to=2023-08-02<br>End of interval. <br>(Minimum interval is 1 day, maximum is 31) |

### Responses

**200**

Success

**204**

Transaction history not found

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
ExpandCollapse

`[{"id": 1036666,\
\
"date": "2022-02-04T09:06:47.985843Z",\
\
"sum": 600,\
\
"type": 0,\
\
"statusId": 1,\
\
"cardStatus": ""\
\
},\
\
{"id": 55261296,\
\
"date": "2023-04-13T10:07:42",\
\
"sum": 1500,\
\
"type": 3,\
\
"statusId": 1,\
\
"cardStatus": "succeeded"\
\
}\
\
]`

# [tag/Media](https://dev.wildberries.ru/en/openapi/promotion\#tag/Media) Media

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Media/paths/~1adv~1v1~1count/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Media/paths/~1adv~1v1~1count/get) Media Campaigns Number/adv/v1/count

gethttps://advert-media-api.wildberries.ru/adv/v1/count

https://advert-media-api.wildberries.ru/adv/v1/count

Method description

Method allows you to get the number of the seller's media campaigns.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 10 requests | 100 milliseconds | 10 requests |

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
ExpandCollapse

`{"all": 6,

"adverts": {"type": 2,

"status": 7,

"count": 2

}

}`

## [tag/Media/paths/~1adv~1v1~1adverts/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Media/paths/~1adv~1v1~1adverts/get) List of Media Campaigns/adv/v1/adverts

gethttps://advert-media-api.wildberries.ru/adv/v1/adverts

https://advert-media-api.wildberries.ru/adv/v1/adverts

Method description

The method allows to get the list of media campaigns of the seller

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 10 requests | 100 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| status | integer<br>Example:status=1<br>Media campaign status:<br>- `1` — template<br>- `2` — moderation<br>- `3` — rejected (with the possibility to resubmit for moderation)<br>- `4` — ready for launch<br>- `5` — scheduled<br>- `6` — running<br>- `7` — completed<br>- `8` — declined<br>- `9` — paused by seller<br>- `10` — paused due to daily limit<br>- `11` — paused |
| type | integer<br>Example:type=1<br>Media campaign type:<br>- `1` — daily basis<br>- `2` — views basis |
| limit | integer<br>Example:limit=1<br>Number of campaigns in the response |
| offset | integer<br>Example:offset=1<br>Offset relative to the first media campaign |
| order | string<br>Example:order=id<br>The order in which the response is displayed:<br>- `create` — by time of media campaign creation<br>- `id` — by ID of media campaign creation |
| direction | string<br>Example:direction=desc<br>Sorting order:<br>- `desc` — upward<br>- `asc` — smaller to larger |

### Responses

**200**

Success

**204**

Media campaigns not found

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
ExpandCollapse

`[{"advertId": 123456,\
\
"name": "тост",\
\
"brand": "goosb",\
\
"type": 2,\
\
"status": 8,\
\
"createTime": "2023-03-25T20:35:57.116943+03:00"\
\
},\
\
{"advertId": 54321,\
\
"name": "тест",\
\
"brand": "bobr",\
\
"type": 1,\
\
"status": 7,\
\
"createTime": "2023-07-24T16:48:20.935599+03:00",\
\
"endTime": "2023-07-25T20:35:50.104978Z"\
\
}\
\
]`

## [tag/Media/paths/~1adv~1v1~1advert/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Media/paths/~1adv~1v1~1advert/get) Information About Media Campaign/adv/v1/advert

gethttps://advert-media-api.wildberries.ru/adv/v1/advert

https://advert-media-api.wildberries.ru/adv/v1/advert

Method description

The method allows to get information about a media campaign

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 10 requests | 100 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=23569<br>Media campaign ID |

### Responses

**200**

Success

**204**

Media campaign not found

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
ExpandCollapse

`{"advertId": 23569,

"name": "Реклама денег принеси",

"brand": "Plank",

"type": 2,

"status": 11,

"createTime": "2023-07-19T11:13:41.195138+03:00",

"extended": {"reason": "Для возобновления показов пополните бюджет медиакампании",

"expenses": 10000,

"from": "2023-07-19T12:05:35.847348Z",

"to": "2123-07-20T08:14:13.079176+03:00",

"updated_at": "2023-07-21T13:25:31.129766+03:00",

"price": 0,

"budget": 0,

"operation": 1,

"contract_id": 0

},

"items": [{"id": 68080,\
\
"name": "Унисон",\
\
"status": 7,\
\
"place": 2,\
\
"budget": 650000,\
\
"daily_limit": 500,\
\
"category_name": "Главная",\
\
"cpm": 351,\
\
"url": "https://www.wildberries.ru/promotions/ssylka-na-akciyou",\
\
"advert_type": 1,\
\
"created_at": "2023-11-01T15:40:46.86165+03:00",\
\
"updated_at": "2023-11-08T23:44:33.248229+03:00",\
\
"date_from": "2023-11-01T16:05:22.286002Z",\
\
"date_to": "2023-11-09T17:27:32.745869+03:00",\
\
"nms": [123456,\
\
11111111\
\
],\
\
"bottomText1": "string",\
\
"bottomText2": "string",\
\
"message": "string",\
\
"additionalSettings": 1,\
\
"receiversCount": 1,\
\
"subject_id": 6945,\
\
"subject_name": "Бельё",\
\
"action_name": "Распродажа! Создай себе домашний уют!",\
\
"show_hours": [{"From": 7,\
\
"To": 8\
\
}\
\
],\
\
"Erid": "string"\
\
}\
\
]

}`

# [tag/Statistics](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics) Statistics

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Promotion** category

## [tag/Statistics/paths/~1adv~1v0~1normquery~1stats/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v0~1normquery~1stats/post) Search Clusters Statistics/adv/v0/normquery/stats

posthttps://advert-api.wildberries.ru/adv/v0/normquery/stats

https://advert-api.wildberries.ru/adv/v0/normquery/stats

Method description

The method returns statistics for search clusters over a specified period.

You can use this method only for campaigns with a `cpm` payment model — for displays.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 10 requests | 6 seconds | 20 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| from<br>required | string<date><br>Period start date |
| to<br>required | string<date><br>Period end date |
| items<br>required | Array of objects<= 100 items |

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

`{"from": "2025-10-07",

"to": "2025-10-08",

"items": [{"advert_id": 1825035,\
\
"nm_id": 983512347\
\
}\
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

`{"stats": [{"advert_id": 1825035,\
\
"nm_id": 983512347,\
\
"stats": [{"atbs": 68,\
\
"avg_pos": 3.6,\
\
"clicks": 2090,\
\
"cpc": 471,\
\
"cpm": 813,\
\
"ctr": 107.23,\
\
"norm_query": "Фраза 1",\
\
"orders": 19,\
\
"views": 1949\
\
},\
\
{"atbs": 68,\
\
"avg_pos": 3.6,\
\
"clicks": 2090,\
\
"cpc": 471,\
\
"cpm": 813,\
\
"ctr": 107.23,\
\
"norm_query": "Фраза 2",\
\
"orders": 19,\
\
"views": 1949\
\
},\
\
{"atbs": 68,\
\
"avg_pos": 3.6,\
\
"clicks": 2090,\
\
"cpc": 471,\
\
"cpm": 813,\
\
"ctr": 107.23,\
\
"norm_query": "Фраза 3",\
\
"orders": 19,\
\
"views": 1949\
\
},\
\
{"atbs": 36,\
\
"avg_pos": 3.9,\
\
"clicks": 1847,\
\
"cpc": 278,\
\
"cpm": 445,\
\
"ctr": 96.4,\
\
"norm_query": "Фраза 4",\
\
"orders": 28,\
\
"views": 1916\
\
},\
\
{"atbs": 36,\
\
"avg_pos": 3.9,\
\
"clicks": 1847,\
\
"cpc": 278,\
\
"cpm": 445,\
\
"ctr": 96.4,\
\
"norm_query": "Фраза 5",\
\
"orders": 28,\
\
"views": 1916\
\
},\
\
{"atbs": 79,\
\
"avg_pos": 2.2,\
\
"clicks": 2468,\
\
"cpc": 106,\
\
"cpm": 819,\
\
"ctr": 145.01,\
\
"norm_query": "Фраза 6",\
\
"orders": 14,\
\
"views": 1702\
\
},\
\
{"atbs": 79,\
\
"avg_pos": 2.2,\
\
"clicks": 2468,\
\
"cpc": 106,\
\
"cpm": 819,\
\
"ctr": 145.01,\
\
"norm_query": "Фраза 7",\
\
"orders": 14,\
\
"views": 1702\
\
},\
\
{"atbs": 67,\
\
"avg_pos": 9.9,\
\
"clicks": 1166,\
\
"cpc": 250,\
\
"cpm": 837,\
\
"ctr": 70.33,\
\
"norm_query": "Фраза 8",\
\
"orders": 26,\
\
"views": 1658\
\
},\
\
{"atbs": 67,\
\
"avg_pos": 9.9,\
\
"clicks": 1166,\
\
"cpc": 250,\
\
"cpm": 837,\
\
"ctr": 70.33,\
\
"norm_query": "Фраза 9",\
\
"orders": 26,\
\
"views": 1658\
\
},\
\
{"atbs": 46,\
\
"avg_pos": 2,\
\
"clicks": 2927,\
\
"cpc": 122,\
\
"cpm": 468,\
\
"ctr": 186.43,\
\
"norm_query": "Фраза 10",\
\
"orders": 23,\
\
"views": 1570\
\
},\
\
{"atbs": 46,\
\
"avg_pos": 2,\
\
"clicks": 2927,\
\
"cpc": 122,\
\
"cpm": 468,\
\
"ctr": 186.43,\
\
"norm_query": "Фраза 11",\
\
"orders": 23,\
\
"views": 1570\
\
},\
\
{"atbs": 79,\
\
"avg_pos": 7.1,\
\
"clicks": 2447,\
\
"cpc": 67,\
\
"cpm": 426,\
\
"ctr": 163.9,\
\
"norm_query": "Фраза 12",\
\
"orders": 13,\
\
"views": 1493\
\
},\
\
{"atbs": 79,\
\
"avg_pos": 7.1,\
\
"clicks": 2447,\
\
"cpc": 67,\
\
"cpm": 426,\
\
"ctr": 163.9,\
\
"norm_query": "Фраза 13",\
\
"orders": 13,\
\
"views": 1493\
\
},\
\
{"atbs": 61,\
\
"avg_pos": 6,\
\
"clicks": 1391,\
\
"cpc": 370,\
\
"cpm": 980,\
\
"ctr": 99.29,\
\
"norm_query": "Фраза 14",\
\
"orders": 27,\
\
"views": 1401\
\
},\
\
{"atbs": 61,\
\
"avg_pos": 6,\
\
"clicks": 1391,\
\
"cpc": 370,\
\
"cpm": 980,\
\
"ctr": 99.29,\
\
"norm_query": "Фраза 15",\
\
"orders": 27,\
\
"views": 1401\
\
},\
\
{"atbs": 26,\
\
"avg_pos": 6.9,\
\
"clicks": 1029,\
\
"cpc": 88,\
\
"cpm": 459,\
\
"ctr": 77.43,\
\
"norm_query": "Фраза 16",\
\
"orders": 3,\
\
"views": 1329\
\
},\
\
{"atbs": 26,\
\
"avg_pos": 6.9,\
\
"clicks": 1029,\
\
"cpc": 88,\
\
"cpm": 459,\
\
"ctr": 77.43,\
\
"norm_query": "Фраза 17",\
\
"orders": 3,\
\
"views": 1329\
\
},\
\
{"atbs": 67,\
\
"avg_pos": 3.8,\
\
"clicks": 1371,\
\
"cpc": 448,\
\
"cpm": 534,\
\
"ctr": 104.18,\
\
"norm_query": "Фраза 18",\
\
"orders": 3,\
\
"views": 1316\
\
},\
\
{"atbs": 67,\
\
"avg_pos": 3.8,\
\
"clicks": 1371,\
\
"cpc": 448,\
\
"cpm": 534,\
\
"ctr": 104.18,\
\
"norm_query": "Фраза 19",\
\
"orders": 3,\
\
"views": 1316\
\
},\
\
{"atbs": 18,\
\
"avg_pos": 10,\
\
"clicks": 2944,\
\
"cpc": 472,\
\
"cpm": 839,\
\
"ctr": 256,\
\
"norm_query": "Фраза 20",\
\
"orders": 4,\
\
"views": 1150\
\
},\
\
{"atbs": 18,\
\
"avg_pos": 10,\
\
"clicks": 2944,\
\
"cpc": 472,\
\
"cpm": 839,\
\
"ctr": 256,\
\
"norm_query": "Фраза 21",\
\
"orders": 4,\
\
"views": 1150\
\
}\
\
]\
\
}\
\
]

}`

## [tag/Statistics/paths/~1adv~1v2~1fullstats/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v2~1fullstats/post) Campaigns Statistics Deprecated /adv/v2/fullstats

posthttps://advert-api.wildberries.ru/adv/v2/fullstats

https://advert-api.wildberries.ru/adv/v2/fullstats

Method description

The method will be disabled on September 30. Use [the current method](https://dev.wildberries.ru/en/openapi/promotion#tag/Statistics/paths/~1adv~1v3~1fullstats/get).

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 1 request | 1 minute | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

Array

One of

RequestWithDateRequestWithIntervalRequestWithCampaignID

|     |     |
| --- | --- |
| id<br>required | integer<br>Campaign ID |
| dates<br>required | Array of strings<date>\[ items <date > \]<br>Dates for which information needs to be provided |

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

Example

RequestWithDateRequestWithIntervalRequestWithCampaignIDRequestWithDate

Request with dates

Copy
ExpandCollapse

`[{"id": 8960367,\
\
"dates": ["2023-10-07",\
\
"2023-10-06"\
\
]\
\
},\
\
{"id": 9876543,\
\
"dates": ["2023-10-07",\
\
"2023-12-06"\
\
]\
\
}\
\
]`

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Example

ResponseWithDateResponseWithIntervalResponseWithDate

Response for a request with the field `date`

Copy
ExpandCollapse

`[{"views": 1052,\
\
"clicks": 2,\
\
"ctr": 0.19,\
\
"cpc": 0.09,\
\
"sum": 177.7,\
\
"atbs": 0,\
\
"orders": 0,\
\
"cr": 0,\
\
"shks": 0,\
\
"sum_price": 0,\
\
"dates": ["2023-10-07",\
\
"2023-10-06"\
\
],\
\
"days": [{"date": "2023-10-06T03:00:00+03:00",\
\
"views": 414,\
\
"clicks": 1,\
\
"ctr": 0.24,\
\
"cpc": 70,\
\
"sum": 70,\
\
"atbs": 0,\
\
"orders": 0,\
\
"cr": 0,\
\
"shks": 0,\
\
"sum_price": 0,\
\
"apps": [{"views": 228,\
\
"clicks": 0,\
\
"ctr": 0,\
\
"cpc": 0,\
\
"sum": 38.71,\
\
"atbs": 0,\
\
"orders": 0,\
\
"cr": 0,\
\
"shks": 0,\
\
"sum_price": 0,\
\
"nm": [{"views": 25,\
\
"clicks": 0,\
\
"ctr": 0,\
\
"cpc": 0,\
\
"sum": 4,\
\
"atbs": 0,\
\
"orders": 0,\
\
"cr": 0,\
\
"shks": 0,\
\
"sum_price": 0,\
\
"name": "Тапочки",\
\
"nmId": 111111111111\
\
}\
\
],\
\
"appType": 1\
\
}\
\
]\
\
}\
\
],\
\
"boosterStats": [{"date": "2023-10-07T00:00:00Z",\
\
"nm": 170095908,\
\
"avg_position": 348\
\
}\
\
],\
\
"advertId": 10524818\
\
}\
\
]`

## [tag/Statistics/paths/~1adv~1v3~1fullstats/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v3~1fullstats/get) Campaigns Statistics/adv/v3/fullstats

gethttps://advert-api.wildberries.ru/adv/v3/fullstats

https://advert-api.wildberries.ru/adv/v3/fullstats

Method description

The method generates statistics for campaigns, regardless of their type.

The maximum period in a request is 31 days.

For campaigns in statuses `7`, `9` and `11`.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 3 requests | 20 seconds | 1 request |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| ids<br>required | string<br>Example:ids=22161678,28449281,28155229<br>Campaign IDs, maximum 50 values |
| beginDate<br>required | string<date><br>Example:beginDate=2025-09-07<br>Start date for the interval |
| endDate<br>required | string<date><br>Example:endDate=2025-09-08<br>End date for the interval |

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
ExpandCollapse

`[{"advertId": 22161678,\
\
"atbs": 9,\
\
"boosterStats": [{"avg_position": 24,\
\
"date": "2025-09-07",\
\
"nm": 221725278\
\
},\
\
{"avg_position": 35,\
\
"date": "2025-09-08",\
\
"nm": 221725278\
\
}\
\
],\
\
"canceled": 0,\
\
"clicks": 139,\
\
"cpc": 4.76,\
\
"cr": 0,\
\
"ctr": 10.12,\
\
"days": [{"apps": [{"appType": 1,\
\
"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 1,\
\
"cpc": 10.19,\
\
"cr": 0,\
\
"ctr": 4.76,\
\
"nms": [{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 1,\
\
"cpc": 10.19,\
\
"cr": 0,\
\
"ctr": 4.76,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 10.19,\
\
"sum_price": 0,\
\
"views": 21\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 10.19,\
\
"sum_price": 0,\
\
"views": 21\
\
},\
\
{"appType": 32,\
\
"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 54,\
\
"cpc": 4.26,\
\
"cr": 0,\
\
"ctr": 11.37,\
\
"nms": [{"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 54,\
\
"cpc": 4.26,\
\
"cr": 0,\
\
"ctr": 11.37,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 230.08,\
\
"sum_price": 0,\
\
"views": 475\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 230.08,\
\
"sum_price": 0,\
\
"views": 475\
\
},\
\
{"appType": 64,\
\
"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 20,\
\
"cpc": 6.91,\
\
"cr": 0,\
\
"ctr": 6.94,\
\
"nms": [{"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 20,\
\
"cpc": 6.91,\
\
"cr": 0,\
\
"ctr": 6.94,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 138.23,\
\
"sum_price": 0,\
\
"views": 288\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 138.23,\
\
"sum_price": 0,\
\
"views": 288\
\
}\
\
],\
\
"atbs": 2,\
\
"canceled": 0,\
\
"clicks": 75,\
\
"cpc": 5.05,\
\
"cr": 0,\
\
"ctr": 9.57,\
\
"date": "2025-09-07T00:00:00Z",\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 378.49,\
\
"sum_price": 0,\
\
"views": 784\
\
},\
\
{"apps": [{"appType": 32,\
\
"atbs": 5,\
\
"canceled": 0,\
\
"clicks": 45,\
\
"cpc": 3.58,\
\
"cr": 0,\
\
"ctr": 13.43,\
\
"nms": [{"atbs": 5,\
\
"canceled": 0,\
\
"clicks": 45,\
\
"cpc": 3.58,\
\
"cr": 0,\
\
"ctr": 13.43,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 161.02,\
\
"sum_price": 0,\
\
"views": 335\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 161.02,\
\
"sum_price": 0,\
\
"views": 335\
\
},\
\
{"appType": 64,\
\
"atbs": 2,\
\
"canceled": 0,\
\
"clicks": 19,\
\
"cpc": 6.05,\
\
"cr": 0,\
\
"ctr": 8.02,\
\
"nms": [{"atbs": 2,\
\
"canceled": 0,\
\
"clicks": 19,\
\
"cpc": 6.05,\
\
"cr": 0,\
\
"ctr": 8.02,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 114.95,\
\
"sum_price": 0,\
\
"views": 237\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 114.95,\
\
"sum_price": 0,\
\
"views": 237\
\
},\
\
{"appType": 1,\
\
"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 0,\
\
"cpc": 0,\
\
"cr": 0,\
\
"ctr": 0,\
\
"nms": [{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 0,\
\
"cpc": 0,\
\
"cr": 0,\
\
"ctr": 0,\
\
"name": "постер 2",\
\
"nmId": 221725278,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 6.79,\
\
"sum_price": 0,\
\
"views": 17\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 6.79,\
\
"sum_price": 0,\
\
"views": 17\
\
}\
\
],\
\
"atbs": 7,\
\
"canceled": 0,\
\
"clicks": 64,\
\
"cpc": 4.42,\
\
"cr": 0,\
\
"ctr": 10.87,\
\
"date": "2025-09-08T00:00:00Z",\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 282.76,\
\
"sum_price": 0,\
\
"views": 589\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 661.25,\
\
"sum_price": 0,\
\
"views": 1373\
\
},\
\
{"advertId": 28449281,\
\
"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 9,\
\
"cpc": 35.94,\
\
"cr": 11.11,\
\
"ctr": 1.76,\
\
"days": [{"apps": [{"appType": 32,\
\
"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 7,\
\
"cpc": 26.31,\
\
"cr": 14.29,\
\
"ctr": 2.41,\
\
"nms": [{"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 5,\
\
"cpc": 33.02,\
\
"cr": 20,\
\
"ctr": 1.92,\
\
"name": "Футболка желтая",\
\
"nmId": 398309059,\
\
"orders": 1,\
\
"shks": 1,\
\
"sum": 165.1,\
\
"sum_price": 500,\
\
"views": 260\
\
},\
\
{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 2,\
\
"cpc": 9.53,\
\
"cr": 0,\
\
"ctr": 6.67,\
\
"name": "Футболка салатовая",\
\
"nmId": 301957154,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 19.05,\
\
"sum_price": 0,\
\
"views": 30\
\
}\
\
],\
\
"orders": 1,\
\
"shks": 1,\
\
"sum": 184.15,\
\
"sum_price": 500,\
\
"views": 290\
\
},\
\
{"appType": 64,\
\
"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 2,\
\
"cpc": 62.87,\
\
"cr": 0,\
\
"ctr": 1.01,\
\
"nms": [{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 1,\
\
"cpc": 12.7,\
\
"cr": 0,\
\
"ctr": 5,\
\
"name": "Футболка салатовая",\
\
"nmId": 301957154,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 12.7,\
\
"sum_price": 0,\
\
"views": 20\
\
},\
\
{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 1,\
\
"cpc": 113.03,\
\
"cr": 0,\
\
"ctr": 0.56,\
\
"name": "Футболка желтая",\
\
"nmId": 398309059,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 113.03,\
\
"sum_price": 0,\
\
"views": 178\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 125.73,\
\
"sum_price": 0,\
\
"views": 198\
\
},\
\
{"appType": 1,\
\
"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 0,\
\
"cpc": 0,\
\
"cr": 0,\
\
"ctr": 0,\
\
"nms": [{"atbs": 0,\
\
"canceled": 0,\
\
"clicks": 0,\
\
"cpc": 0,\
\
"cr": 0,\
\
"ctr": 0,\
\
"name": "Футболка желтая",\
\
"nmId": 398309059,\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 13.59,\
\
"sum_price": 0,\
\
"views": 22\
\
}\
\
],\
\
"orders": 0,\
\
"shks": 0,\
\
"sum": 13.59,\
\
"sum_price": 0,\
\
"views": 22\
\
}\
\
],\
\
"atbs": 1,\
\
"canceled": 0,\
\
"clicks": 9,\
\
"cpc": 35.94,\
\
"cr": 11.11,\
\
"ctr": 1.76,\
\
"date": "2025-09-08T00:00:00Z",\
\
"orders": 1,\
\
"shks": 1,\
\
"sum": 323.47,\
\
"sum_price": 500,\
\
"views": 510\
\
}\
\
],\
\
"orders": 1,\
\
"shks": 1,\
\
"sum": 323.47,\
\
"sum_price": 500,\
\
"views": 510\
\
}\
\
]`

## [tag/Statistics/paths/~1adv~1v2~1auto~1stat-words/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v2~1auto~1stat-words/get) Statistics of a Campaign with Standard Bid by Phrase Clusters/adv/v2/auto/stat-words

gethttps://advert-api.wildberries.ru/adv/v2/auto/stat-words

https://advert-api.wildberries.ru/adv/v2/auto/stat-words

Method description

Returns clusters of key phrases (sets of similar ones) for which products were shown in the campaign, and the number of displays for them. Only those phrases for which products were shown at least once are included in the method's response.

Information is updated every 15 minutes.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 4 requests | 250 milliseconds | 4 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1234<br>Campaign ID |

### Responses

**200**

Success

**204**

Campaign not found

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
ExpandCollapse

`{"excluded": ["Samsung",\
\
"Xiaomi"\
\
],

"clusters": [{"cluster": "Phone",\
\
"count": 100,\
\
"keywords": ["Телефон",\
\
"Мобильный телефон"\
\
]\
\
}\
\
]

}`

## [tag/Statistics/paths/~1adv~1v1~1stat~1words/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v1~1stat~1words/get) Statistics on Keywords for Campaign with Custom Bid Deprecated /adv/v1/stat/words

gethttps://advert-api.wildberries.ru/adv/v1/stat/words

https://advert-api.wildberries.ru/adv/v1/stat/words

Method description

This method is deprecated. It will be removed on [January 15](https://dev.wildberries.ru/en/release-notes?id=385)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | integer<br>Example:id=1<br>Campaign ID |

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
- 401
- 429

Content type

application/json

Copy
ExpandCollapse

`{"words": {"phrase": [ ],

"strong": [ ],

"excluded": [ ],

"pluse": ["детское постельное белье для мальчика 1.5"\
\
],

"keywords": [{"keyword": "постельное белье 1.5",\
\
"count": 772\
\
}\
\
],

"fixed": true

},

"stat": [{"advertId": 7703570,\
\
"keyword": "Всего по кампании",\
\
"advertName": "",\
\
"campaignName": "Бельё",\
\
"begin": "2023-07-03T15:15:38.287441+03:00",\
\
"end": "2023-07-03T15:15:38.287441+03:00",\
\
"views": 1846,\
\
"clicks": 73,\
\
"frq": 1,\
\
"ctr": 3.95,\
\
"cpc": 7.88,\
\
"duration": 769159,\
\
"sum": 575.6\
\
},\
\
{"advertId": 7703570,\
\
"keyword": "постельное белье 1.5 детское",\
\
"advertName": "",\
\
"campaignName": "Бельё",\
\
"begin": "2023-07-03T15:15:38.287441+03:00",\
\
"end": "2023-07-03T15:15:38.287441+03:00",\
\
"views": 1846,\
\
"clicks": 73,\
\
"frq": 1,\
\
"ctr": 3.95,\
\
"cpc": 7.88,\
\
"duration": 769159,\
\
"sum": 575.6\
\
}\
\
]

}`

## [tag/Statistics/paths/~1adv~1v0~1stats~1keywords/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v0~1stats~1keywords/get) Statistics on Keywords Deprecated /adv/v0/stats/keywords

gethttps://advert-api.wildberries.ru/adv/v0/stats/keywords

https://advert-api.wildberries.ru/adv/v0/stats/keywords

Method description

This method is deprecated. It will be removed on [January 15](https://dev.wildberries.ru/en/release-notes?id=385)

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| advert\_id<br>required | integer<br>Example:advert\_id=123456789<br>Campaign ID |
| from<br>required | string<date><br>Example:from=2024-08-10<br>Period start |
| to<br>required | string<date><br>Example:to=2024-08-12<br>Period end |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**404**

Не найдено

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
ExpandCollapse

`{"keywords": [{"date": "2024-08-12",\
\
"stats": [{"clicks": 68,\
\
"ctr": 3.73,\
\
"keyword": "светильники",\
\
"sum": 565.75,\
\
"views": 1825\
\
}\
\
]\
\
}\
\
]

}`

## [tag/Statistics/paths/~1adv~1v1~1stats/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Statistics/paths/~1adv~1v1~1stats/post) Media Campaign Statistics/adv/v1/stats

posthttps://advert-media-api.wildberries.ru/adv/v1/stats

https://advert-media-api.wildberries.ru/adv/v1/stats

Method description

The method allows to get statistics of [WB Media](https://cmp.wildberries.ru/cmpf/statistics) campaigns

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 10 requests | 100 milliseconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

Array (\[ 1 .. 100 \] items)

One of

RequestWithDateRequestWithIntervalRequestWithCampaignID

|     |     |
| --- | --- |
| id<br>required | integer<br>Campaign ID |
| dates<br>required | Array of strings<date>\[ items <date > \]<br>Dates for which information needs to be provided |

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

Example

RequestWithDateRequestWithIntervalRequestWithoutParamRequestAggregateRequestWithDate

Request with dates

Copy
ExpandCollapse

`[{"id": 8960367,\
\
"dates": ["2023-10-07",\
\
"2023-10-06"\
\
]\
\
},\
\
{"id": 9876543,\
\
"dates": ["2023-10-07",\
\
"2023-12-06"\
\
]\
\
}\
\
]`

### Response samples

- 200
- 400
- 401
- 429

Content type

application/json

Example

RespStatMediaIntervalRespStatMediaDatesRespStatMediaWithoutParamRespStatMediaAggregateRespStatMediaInterval

Response for interval queries

Copy
ExpandCollapse

`[{"interval": {"begin": "2023-10-21",\
\
"end": "2023-10-25"\
\
},\
\
"stats": [{"item_id": 62237,\
\
"item_name": "Gloria Jeans",\
\
"category_name": "Детям",\
\
"advert_type": 1,\
\
"place": 2,\
\
"views": 11849,\
\
"clicks": 209,\
\
"cr": 0.48,\
\
"ctr": 1.76,\
\
"date_from": "2023-10-21T00:00:00+03:00",\
\
"date_to": "2023-10-27T23:59:59+03:00",\
\
"subject_name": "Одежда",\
\
"atbs": 4,\
\
"orders": 1,\
\
"price": 175000,\
\
"cpc": 837.32,\
\
"status": 6,\
\
"daily_stats": [{"date": "2023-10-21T00:00:00+03:00",\
\
"app_type_stats": [{"app_type": 1,\
\
"stats": [{"views": 2017,\
\
"clicks": 27,\
\
"atbs": 1,\
\
"ctr": 1.34\
\
}\
\
]\
\
}\
\
]\
\
}\
\
],\
\
"expenses": 175000,\
\
"cr1": 1.91,\
\
"cr2": 25\
\
}\
\
]\
\
}\
\
]`

# [tag/Promotions-Calendar](https://dev.wildberries.ru/en/openapi/promotion\#tag/Promotions-Calendar) Promotions Calendar

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Prices and Discounts** category

Using these methods, you can obtain information about promotions and participate in them.

## [tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions/get) Promotions List/api/v1/calendar/promotions

gethttps://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions

https://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions

Method description

Returns a promotions list with dates and times of occurrence

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Promotions Calendar** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 6 seconds | 10 requests | 600 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| startDateTime<br>required | string<date-time><br>Example:startDateTime=2023-09-01T00:00:00Z<br>Period start, format `YYYY-MM-DDTHH:MM:SSZ` |
| endDateTime<br>required | string<date-time><br>Example:endDateTime=2024-08-01T23:59:59Z<br>Period end, format `YYYY-MM-DDTHH:MM:SSZ` |
| allPromo<br>required | boolean<br>Default:false<br>Show promotions:<br>- `false` — available for participating<br>- `true` — all promotion |
| limit | integer<uint>\[ 1 .. 1000 \]<br>Example:limit=10<br>Number of requested promotions |
| offset | integer<uint>>= 0<br>Example:offset=0<br>From which element to start outputting data |

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
ExpandCollapse

`{"data": {"promotions": [{"id": 123,\
\
"name": "скидки",\
\
"startDateTime": "2023-06-05T21:00:00Z",\
\
"endDateTime": "2023-06-05T21:00:00Z",\
\
"type": "regular"\
\
}\
\
]

}

}`

## [tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1details/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1details/get) Promotions Details/api/v1/calendar/promotions/details

gethttps://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/details

https://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/details

Method description

Returns detailed information about the selected promotions

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Promotions Calendar** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 6 seconds | 10 requests | 600 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| promotionIDs<br>required | string\[ 1 .. 100 \] itemsunique<br>Example:promotionIDs=1&promotionIDs=3&promotionIDs=64<br>IDs of the promotions for which information should be returned |

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
ExpandCollapse

`{"data": {"promotions": [{"id": 123,\
\
"name": "ХИТЫ ГОДА",\
\
"description": "В акции принимают участие самые популярные товары 2023 года. Карточки товаров будут выделены плашкой «ХИТ ГОДА», чтобы покупатели замечали эти товары среди других. Также они будут размещены под баннерами на главной странице и примут участие в PUSH-уведомлениях. С ценами для вступления в акцию вы можете ознакомиться ниже.",\
\
"advantages": ["Плашка",\
\
"Баннер",\
\
"Топ выдачи товаров"\
\
],\
\
"startDateTime": "2023-06-05T21:00:00Z",\
\
"endDateTime": "2023-06-05T21:00:00Z",\
\
"inPromoActionLeftovers": 45,\
\
"inPromoActionTotal": 123,\
\
"notInPromoActionLeftovers": 3,\
\
"notInPromoActionTotal": 10,\
\
"participationPercentage": 10,\
\
"type": "auto",\
\
"exceptionProductsCount": 10,\
\
"ranging": [{"condition": "productsInPromotion",\
\
"participationRate": 10,\
\
"boost": 7\
\
},\
\
{"condition": "calculateProducts",\
\
"participationRate": 20,\
\
"boost": 17\
\
},\
\
{"condition": "allProducts",\
\
"participationRate": 35,\
\
"boost": 30\
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

## [tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1nomenclatures/get](https://dev.wildberries.ru/en/openapi/promotion\#tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1nomenclatures/get) List of Products for Participating in the Promotion/api/v1/calendar/promotions/nomenclatures

gethttps://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/nomenclatures

https://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/nomenclatures

Method description

Returns a list of products suitable for participation in the promotion.

Not applicable for auto promotions

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Promotions Calendar** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 6 seconds | 10 requests | 600 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| promotionID<br>required | integer<br>Example:promotionID=1<br>Promotion ID |
| inAction<br>required | boolean<br>Default:false<br>Example:inAction=true<br>Participates in the promotion:<br>- `true` — yes<br>- `false` — no |
| limit | integer<uint>\[ 1 .. 1000 \]<br>Example:limit=10<br>Number of requested products |
| offset | integer<uint>>= 0<br>Example:offset=0<br>From which element to start outputting data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Error processing request parameters

**429**

Too many requests

### Response samples

- 200
- 400
- 401
- 422
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"nomenclatures": [{"id": 162579635,\
\
"inAction": true,\
\
"price": 1500,\
\
"currencyCode": "RUB",\
\
"planPrice": 1000,\
\
"discount": 15,\
\
"planDiscount": 34\
\
}\
\
]

}

}`

## [tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1upload/post](https://dev.wildberries.ru/en/openapi/promotion\#tag/Promotions-Calendar/paths/~1api~1v1~1calendar~1promotions~1upload/post) Add Product to the Promotion/api/v1/calendar/promotions/upload

posthttps://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/upload

https://dp-calendar-api.wildberries.ru/api/v1/calendar/promotions/upload

Method description

Creates a product upload for the promotion.

The upload status can be checked using [separate methods](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Prices-and-Discounts/paths/~1api~1v2~1history~1tasks/get).

Not applicable for auto promotions

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Promotions Calendar** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 6 seconds | 10 requests | 600 milliseconds | 5 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| data | object<br>Request data |

### Responses

**200**

Success

**400**

Bad request

**401**

Unauthorized

**422**

Error processing request parameters

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy
ExpandCollapse

`{"data": {"promotionID": 1,

"uploadNow": true,

"nomenclatures": [75632091,\
\
31322455,\
\
642080796\
\
]

}

}`

### Response samples

- 200
- 400
- 401
- 422
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"alreadyExists": false,

"uploadID": 11

}

}`

We use [cookies](https://dev.wildberries.ru/privacy) to collect statistics and improve our service

Accept

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Promotion
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/promotion

