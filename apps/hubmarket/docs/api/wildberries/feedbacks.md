# Customer Communication (Feedbacks) API

> **Base URL:** `https://feedbacks-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 10
> **Документация:** https://dev.wildberries.ru/openapi/user-communication
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Управление отзывами, вопросами, чатом с покупателями и возвратами

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

  - Questions

  - Feedbacks

    - GET

      Unanswered Feedbacks/api/v1/feedbacks/count-unanswered

    - GET

      Number of Feedbacks/api/v1/feedbacks/count

    - GET

      Feedbacks List/api/v1/feedbacks

    - POST

      Reply to Feedback/api/v1/feedbacks/answer

    - PATCH

      Edit Response to Feedback/api/v1/feedbacks/answer

    - POST

      Return Product by Feedback ID/api/v1/feedbacks/order/return

    - GET

      Get the Feedback by ID/api/v1/feedback

    - GET

      List of Archived Feedbacks/api/v1/feedbacks/archive
  - Pinned Feedback

  - Buyers Chat

  - Buyers Returns
- Tariffs

- Analytics and Data

- Reports

- Documents and Accounting

- Wildberries Digital


- Customer Communication
- Questions
  - getUnseen Feedbacks and Questions/api/v1/new-feedbacks-questions
  - getUnanswered Questions/api/v1/questions/count-unanswered
  - getNumber of Questions/api/v1/questions/count
  - getQuestion List/api/v1/questions
  - patchWorking with Questions/api/v1/questions
  - getGet the Question by ID/api/v1/question
- Feedbacks
  - getUnanswered Feedbacks/api/v1/feedbacks/count-unanswered
  - getNumber of Feedbacks/api/v1/feedbacks/count
  - getFeedbacks List/api/v1/feedbacks
  - postReply to Feedback/api/v1/feedbacks/answer
  - patchEdit Response to Feedback/api/v1/feedbacks/answer
  - postReturn Product by Feedback ID/api/v1/feedbacks/order/return
  - getGet the Feedback by ID/api/v1/feedback
  - getList of Archived Feedbacks/api/v1/feedbacks/archive
- Pinned Feedback
  - getList of Pinned and Unpinned Feedback/api/feedbacks/v1/pins
  - postPin Feedback/api/feedbacks/v1/pins
  - delUnpin Feedback/api/feedbacks/v1/pins
  - getPinned and Unpinned Feedback Number/api/feedbacks/v1/pins/count
  - getPinned Feedback Limits/api/feedbacks/v1/pins/limits
- Buyers Chat
  - getChat List/api/v1/seller/chats
  - getChat Events/api/v1/seller/events
  - postSend Message/api/v1/seller/message
  - getGet File from the Message/api/v1/seller/download/{id}
- Buyers Returns
  - getBuyers Return Applications/api/v1/claims
  - patchAnswer Buyers Application/api/v1/claim

# Customer Communication(communication)

Management of customer inquiries and feedback, chats, and returns processing

# [tag/Customer-Communication](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Customer-Communication) Customer Communication

Management of customer inquiries and feedback, chats, and returns processing

# [tag/Questions](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions) Questions

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Feedbacks and Questions** category

## [tag/Questions/paths/~1api~1v1~1new-feedbacks-questions/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1new-feedbacks-questions/get) Unseen Feedbacks and Questions/api/v1/new-feedbacks-questions

gethttps://feedbacks-api.wildberries.ru/api/v1/new-feedbacks-questions

https://feedbacks-api.wildberries.ru/api/v1/new-feedbacks-questions

Method description

The method displays information about the seller's unseen feedbacks and questions

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

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

`{"data": {"hasNewQuestions": true,

"hasNewFeedbacks": false

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Questions/paths/~1api~1v1~1questions~1count-unanswered/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1questions~1count-unanswered/get) Unanswered Questions/api/v1/questions/count-unanswered

gethttps://feedbacks-api.wildberries.ru/api/v1/questions/count-unanswered

https://feedbacks-api.wildberries.ru/api/v1/questions/count-unanswered

Method description

The method allows you to get the number of unanswered questions for today and for all time

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

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

`{"data": {"countUnanswered": 24,

"countUnansweredToday": 0

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Questions/paths/~1api~1v1~1questions~1count/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1questions~1count/get) Number of Questions/api/v1/questions/count

gethttps://feedbacks-api.wildberries.ru/api/v1/questions/count

https://feedbacks-api.wildberries.ru/api/v1/questions/count

Method description

The method allows to get the number of questions for requested period

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom | integer<br>Example:dateFrom=1688465092<br>The start date of the period in Unix timestamp format |
| dateTo | integer<br>Example:dateTo=1688465092<br>The end date of the period in Unix timestamp format |
| isAnswered | boolean<br>Example:isAnswered=false<br>If the question was answered:<br>- `true` — yes, by default<br>- `false` — no |

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

`{"data": 77,

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Questions/paths/~1api~1v1~1questions/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1questions/get) Question List/api/v1/questions

gethttps://feedbacks-api.wildberries.ru/api/v1/questions

https://feedbacks-api.wildberries.ru/api/v1/questions

Method description

The method allows you to get a list of questions by the specified parameters with pagination and sorting.

It is possible to get a maximum of 10,000 questions per query

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| isAnswered<br>required | boolean<br>The question is answered:<br>- `true` — yes, by default<br>- `false` — no |
| nmId | integer<br>WB article |
| take<br>required | integer<br>Number of requested questions (the maximum possible value for the parameter is 10,000, and the total amount of `take` and `skip` parameters must not exceed 10,000) |
| skip<br>required | integer<br>Number of questions to skip (maximum possible value for the parameter is 10,000, and the total amount of `take` and `skip` parameters must not exceed 10,000) |
| order | string<br>Sorting questions by date (`dateAsc`/`dateDesc`) |
| dateFrom | integer<br>Example:dateFrom=1688465092<br>The start date of the period in Unix timestamp format |
| dateTo | integer<br>Example:dateTo=1688465092<br>The end date of the period in Unix timestamp format |

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

`{"data": {"countUnanswered": 24,

"countArchive": 508,

"questions": [{"id": "2ncBtX4B9I0UHoornoqG",\
\
"text": "Question text",\
\
"createdDate": "2022-02-01T11:18:08.769513469Z",\
\
"state": "suppliersPortalSynch",\
\
"answer": null,\
\
"productDetails": {"imtId": 11157265,\
\
"nmId": 14917842,\
\
"productName": "Coffee",\
\
"supplierArticle": "123401",\
\
"supplierName": " ГП Реклама и услуги",\
\
"brandName": "Nescafe"\
\
},\
\
"wasViewed": false,\
\
"isWarned": false\
\
}\
\
]

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Questions/paths/~1api~1v1~1questions/patch](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1questions/patch) Working with Questions/api/v1/questions

patchhttps://feedbacks-api.wildberries.ru/api/v1/questions

https://feedbacks-api.wildberries.ru/api/v1/questions

Method description

Depending on the request body, you can:

- View question.
- Reject question.
- Answer question or edit the answer.

It is possible to edit a response to a question within 2 months (60 days), after the response has been submitted and only once.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

One of

objectobject

|     |     |
| --- | --- |
| id<br>required | string<br>Question ID |
| wasViewed<br>required | boolean<br>If the question was viewed |

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

Example

ViewQuestionRejectQuestionAnswerQuestionOrEditAnswerViewQuestion

View question

Copy

`{"id": "n5um6IUBQOOSTxXoo0gV",

"wasViewed": true

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

`{"data": null,

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Questions/paths/~1api~1v1~1question/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Questions/paths/~1api~1v1~1question/get) Get the Question by ID/api/v1/question

gethttps://feedbacks-api.wildberries.ru/api/v1/question

https://feedbacks-api.wildberries.ru/api/v1/question

Method description

The method allows you to get a question by its ID

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | string<br>Example:id=ljAVapEBL38RyMdRln61<br>Question ID |

### Responses

**200**

Success

**401**

Unauthorized

**403**

Access denied

**422**

Error processing request parameters

**429**

Too many requests

### Response samples

- 200
- 401
- 403
- 422
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"id": "TfWOp5QBfEYrrd0AMJau",

"text": "Хороший карандаш? Когда еще поставите?",

"createdDate": "2025-01-27T11:38:21.202143857Z",

"state": "wbRu",

"answer": {"text": "На следующей неделе",

"editable": true,

"createDate": "2025-07-28T08:24:37.187113704Z"

},

"productDetails": {"imtId": 202306781,

"nmId": 224747484,

"productName": "Карандаш с ластиком",

"supplierArticle": "12113156uw",

"supplierName": "",

"brandName": "Maped",

"size": ""

},

"wasViewed": true,

"isWarned": false

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

# [tag/Feedbacks](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks) Feedbacks

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Feedbacks and Questions** category

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1count-unanswered/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1count-unanswered/get) Unanswered Feedbacks/api/v1/feedbacks/count-unanswered

gethttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/count-unanswered

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/count-unanswered

Method description

The method allows you to get the number of unanswered feedbacks for today, for all time and get an estimate of all feedbacks

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

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

`{"data": {"countUnanswered": 1,

"countUnansweredToday": 0

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1count/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1count/get) Number of Feedbacks/api/v1/feedbacks/count

gethttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/count

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/count

Method description

The method allows to get the number of feedbacks

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| dateFrom | integer<br>Example:dateFrom=1688465092<br>The start date of the period in Unix timestamp format |
| dateTo | integer<br>Example:dateTo=1688465092<br>The end date of the period in Unix timestamp format |
| isAnswered | boolean<br>Example:isAnswered=false<br>If the feedback was answered:<br>- `true` — yes, by default<br>- `false` — no |

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

`{"data": 724583,

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks/get) Feedbacks List/api/v1/feedbacks

gethttps://feedbacks-api.wildberries.ru/api/v1/feedbacks

https://feedbacks-api.wildberries.ru/api/v1/feedbacks

Method description

The method allows you to get a list of feedbacks by the specified parameters with pagination and sorting

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| isAnswered<br>required | boolean<br>Example:isAnswered=false<br>If the feedback was answered:<br>- `true` — yes, by default<br>- `false` — no |
| nmId | integer<br>Example:nmId=5870243<br>WB article |
| take<br>required | integer<br>Example:take=1<br>Number of feedbacks (max. 5 000) |
| skip<br>required | integer<br>Example:skip=0<br>Number of feedbacks for skip (max. 199990) |
| order | string<br>Enum:"dateAsc""dateDesc"<br>Sorting of feedbacks by date (dateAsc/dateDesc) |
| dateFrom | integer<br>Example:dateFrom=1688465092<br>The start date of the period in Unix timestamp format |
| dateTo | integer<br>Example:dateTo=1688465092<br>The end date of the period in Unix timestamp format |

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

`{"data": {"countUnanswered": 52,

"countArchive": 1000,

"feedbacks": [{"id": "YX52RZEBhH9mrcYdEJuD",\
\
"text": "Спасибо, всё подошло",\
\
"pros": "Удобный",\
\
"cons": "Нет",\
\
"productValuation": 5,\
\
"createdDate": "2024-09-26T10:20:48+03:00",\
\
"answer": {"text": "Пожалуйста. Ждём вас снова!",\
\
"state": "wbRu",\
\
"editable": false\
\
},\
\
"state": "wbRu",\
\
"productDetails": {"imtId": 123456789,\
\
"nmId": 987654321,\
\
"productName": "ВАЗ",\
\
"supplierArticle": "DP02/черный",\
\
"supplierName": "ГП Реклама и услуги",\
\
"brandName": "Бест Трикотаж",\
\
"size": "0"\
\
},\
\
"video": {"previewImage": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/preview.webp",\
\
"link": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/index.m3u8",\
\
"durationSec": 10\
\
},\
\
"wasViewed": true,\
\
"photoLinks": [{"fullSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/ms.jpg"\
\
}\
\
],\
\
"userName": "Николай",\
\
"matchingSize": "ok",\
\
"isAbleSupplierFeedbackValuation": false,\
\
"supplierFeedbackValuation": 1,\
\
"isAbleSupplierProductValuation": false,\
\
"supplierProductValuation": 2,\
\
"isAbleReturnProductOrders": false,\
\
"returnProductOrdersDate": "2024-08-20T16:39:49Z",\
\
"bables": ["цена"\
\
],\
\
"lastOrderShkId": 123456789,\
\
"lastOrderCreatedAt": "2024-08-12T10:20:48+03:00",\
\
"color": "colorless",\
\
"subjectId": 219,\
\
"subjectName": "Футболки-поло",\
\
"parentFeedbackId": null,\
\
"childFeedbackId": "bIjTCZDvJni7NGnLbUlf"\
\
}\
\
]

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1answer/post](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1answer/post) Reply to Feedback/api/v1/feedbacks/answer

posthttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer

Method description

Allows you to respond to the feedback.


There is no validation by `feedback ID`: if an incorrect value is provided in the request, you will not receive an error.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| id<br>required | string<br>Feedback ID |
| text<br>required | string\[ 2 .. 5000 \]<br>Reply text |

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

`{"id": "J2FMRjUj6hwvwCElqssz",

"text": "Спасибо за Ваш отзыв!"

}`

### Response samples

- 400
- 401
- 429

Content type

application/json

Example

contentTypeHeaderNotSpecifiedincorrectContentTypeHeaderincorrectContentTypeinvalidJsonSyntaxcontentTypeHeaderNotSpecified

Content-Type header not specified

Copy

`{"title": "bad request",

"requestId": "e6c4100223db8bf5818b2e5f12705891",

"origin": "fbapi",

"detail": "content-type header not specified"

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1answer/patch](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1answer/patch) Edit Response to Feedback/api/v1/feedbacks/answer

patchhttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer

Method description

Allows you to edit an already sent response to the feedback.

You can edit the response only once within 60 days.

There is no validation by `feedback ID`: if an incorrect value is provided in the request, you will not receive an error.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| id<br>required | string<br>Feedback ID |
| text<br>required | string\[ 2 .. 5000 \]<br>Reply text |

### Responses

**204**

Success

**401**

Unauthorized

**429**

Too many requests

### Request samples

- Payload

Content type

application/json

Copy

`{"id": "J2FMRjUj6hwvwCElqssz",

"text": "Спасибо за Ваш отзыв, он очень важен для нас!"

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

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1order~1return/post](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1order~1return/post) Return Product by Feedback ID/api/v1/feedbacks/order/return

posthttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/order/return

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/order/return

Method description

The method allows requesting a return for a product for which a feedback has been left.

Return is available for feedbacks with `"isAbleReturnProductOrders": true`

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

|     |     |
| --- | --- |
| feedbackId | string<br>Feedback ID |

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

`{"feedbackId": "absdfgerrrfff1234"

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

`{"data": { },

"error": true,

"errorText": "string",

"additionalErrors": ["string"\
\
]

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedback/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedback/get) Get the Feedback by ID/api/v1/feedback

gethttps://feedbacks-api.wildberries.ru/api/v1/feedback

https://feedbacks-api.wildberries.ru/api/v1/feedback

Method description

The method allows you to get a feedback by its ID

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| id<br>required | string<br>Example:id=G7Y9Y1kBAtKOitoBT\_lV<br>Feedback ID |

### Responses

**200**

Success

**401**

Unauthorized

**422**

Error processing request parameters

**429**

Too many requests

### Response samples

- 200
- 401
- 422
- 429

Content type

application/json

Copy
ExpandCollapse

`{"data": {"id": "YX52RZEBhH9mrcYdEJuD",

"text": "Спасибо, всё подошло",

"pros": "Удобный",

"cons": "Нет",

"productValuation": 5,

"createdDate": "2024-09-26T10:20:48+03:00",

"answer": {"text": "Пожалуйста. Ждём вас снова!",

"state": "wbRu",

"editable": false

},

"state": "wbRu",

"productDetails": {"imtId": 123456789,

"nmId": 987654321,

"productName": "ВАЗ",

"supplierArticle": "DP02/черный",

"supplierName": "ГП Реклама и услуги",

"brandName": "Бест Трикотаж",

"size": "0"

},

"video": {"previewImage": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/preview.webp",

"link": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/index.m3u8",

"durationSec": 10

},

"wasViewed": true,

"photoLinks": [{"fullSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/ms.jpg"\
\
}\
\
],

"userName": "Николай",

"matchingSize": "ok",

"isAbleSupplierFeedbackValuation": false,

"supplierFeedbackValuation": 1,

"isAbleSupplierProductValuation": false,

"supplierProductValuation": 2,

"isAbleReturnProductOrders": false,

"returnProductOrdersDate": "2024-08-20T16:39:49Z",

"bables": ["цена"\
\
],

"lastOrderShkId": 123456789,

"lastOrderCreatedAt": "2024-08-12T10:20:48+03:00",

"color": "colorless",

"subjectId": 219,

"subjectName": "Футболки-поло",

"parentFeedbackId": null,

"childFeedbackId": "bIjTCZDvJni7NGnLbUlf"

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

## [tag/Feedbacks/paths/~1api~1v1~1feedbacks~1archive/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Feedbacks/paths/~1api~1v1~1feedbacks~1archive/get) List of Archived Feedbacks/api/v1/feedbacks/archive

gethttps://feedbacks-api.wildberries.ru/api/v1/feedbacks/archive

https://feedbacks-api.wildberries.ru/api/v1/feedbacks/archive

Method description

The method allows you to get a list of archived feedbacks.

The feedback becomes archived if:

- A response to the feedback is received.
- No response to the feedback is received within 30 days.
- The feedback contains no text or photos.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| nmId | integer<br>Example:nmId=14917842<br>WB article |
| take<br>required | integer<br>Example:take=1<br>Number of feedbacks (max. 5 000) |
| skip<br>required | integer<br>Example:skip=0<br>Number of feedbacks for skip |
| order | string<br>Enum:"dateAsc""dateDesc"<br>Sorting of feedbacks by date (dateAsc/dateDesc) |

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

`{"data": {"feedbacks": [{"id": "YX52RZEBhH9mrcYdEJuD",\
\
"text": "Спасибо, всё подошло",\
\
"pros": "Удобный",\
\
"cons": "Нет",\
\
"productValuation": 5,\
\
"createdDate": "2024-09-26T10:20:48+03:00",\
\
"answer": {"text": "Пожалуйста. Ждём вас снова!",\
\
"state": "wbRu",\
\
"editable": false\
\
},\
\
"state": "wbRu",\
\
"productDetails": {"imtId": 123456789,\
\
"nmId": 987654321,\
\
"productName": "ВАЗ",\
\
"supplierArticle": "DP02/черный",\
\
"supplierName": "ГП Реклама и услуги",\
\
"brandName": "Бест Трикотаж",\
\
"size": "0"\
\
},\
\
"video": {"previewImage": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/preview.webp",\
\
"link": "https://videofeedback01.wbbasket.ru/8defc853-7f62-4d6d-b236-8a16cfb63128/index.m3u8",\
\
"durationSec": 10\
\
},\
\
"wasViewed": true,\
\
"photoLinks": [{"fullSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1333/part133337/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1508/part150887/123456789/photos/ms.jpg"\
\
},\
\
{"fullSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/fs.jpg",\
\
"miniSize": "https://feedback04.wbbasket.ru/vol1486/part148682/123456789/photos/ms.jpg"\
\
}\
\
],\
\
"userName": "Николай",\
\
"matchingSize": "ok",\
\
"isAbleSupplierFeedbackValuation": false,\
\
"supplierFeedbackValuation": 1,\
\
"isAbleSupplierProductValuation": false,\
\
"supplierProductValuation": 2,\
\
"isAbleReturnProductOrders": false,\
\
"returnProductOrdersDate": "2024-08-20T16:39:49Z",\
\
"bables": ["цена"\
\
],\
\
"lastOrderShkId": 123456789,\
\
"lastOrderCreatedAt": "2024-08-12T10:20:48+03:00",\
\
"color": "colorless",\
\
"subjectId": 219,\
\
"subjectName": "Футболки-поло",\
\
"parentFeedbackId": null,\
\
"childFeedbackId": "bIjTCZDvJni7NGnLbUlf"\
\
}\
\
]

},

"error": false,

"errorText": "",

"additionalErrors": null

}`

# [tag/Pinned-Feedback](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback) Pinned Feedback

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-token) for the **Feedbacks and Questions** category

Use these methods for:

1. [Getting the list of pinned and unpinned feedback](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/get)
2. [Pinning feedback](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/post). The method is available for [Jam subscription](https://seller.wildberries.ru/monetization/jam) or **Pin a feedback** option in the [tariff constructor](https://seller.wildberries.ru/tariff-constructor)
3. [Unpinning feedback](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/delete)
4. [Getting pinned and unpinned feedback number](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1count/get)
5. [Getting pinned feedback limits](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1limits/get)

## [tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/get) List of Pinned and Unpinned Feedback/api/feedbacks/v1/pins

gethttps://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

https://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

Method description

The method allows to get the list of pinned and unpinned feedback.

Only automatically unpinned feedback cause of the reasons specified in the response in the `unpinnedCause` field are considered unpinned.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| state | string<br>Enum:"pinned""unpinned"<br>Example:state=pinned<br>If the feedback is pinned:<br>- `pinned` — yes<br>- `unpinned` — no |
| pinOn | string<br>Enum:"nm""imt"<br>Example:pinOn=nm<br>Место закрепления отзыва:<br>- `nm` — карточка товара<br>- `imt` — объединённая карточка |
| imtId | integer<br>Example:imtId=256972151<br>Merged product card ID<br>All WB articles of a merged product card have the same `imtId`.<br>Every product card has `imtId`, even if is not merged with any other card |
| nmId | integer<br>Example:nmId=177974151<br>WB article |
| feedbackId | integer<br>Example:feedbackId=789<br>Feedback ID |
| dateFrom | string<date-time><br>Example:dateFrom=2020-01-01T15:04:05Z<br>The date the first feedback in the list was pinned |
| dateTo | string<date-time><br>Example:dateTo=2020-02-01T15:04:05Z<br>The date the last feedback in the list was pinned |
| next | integer<br>Example:next=741<br>The last pinning operation ID (paginator) |
| limit | integer<= 500<br>Default:500<br>Example:limit=100<br>Feedback number per page (pagination) |

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

`{"data": [{"changeStateAt": "2020-01-01T15:04:05Z",\
\
"imtId": 256971531,\
\
"nmId": 177974151,\
\
"pinId": 1857762,\
\
"pinMethod": "subscription",\
\
"pinOn": "imt",\
\
"feedbackId": "DibuRAImknLyiqgzvGcU",\
\
"state": "unpinned",\
\
"unpinnedCause": "sysTariffUnpinned"\
\
}\
\
],

"next": 200

}`

## [tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/post](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/post) Pin Feedback/api/feedbacks/v1/pins

posthttps://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

https://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

Method description

The method allows to pin the feedback to the merged product card or to product card.

To get feedback ID, use the [List of pinned and unpinned feedback](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/get) method.

The method is available for [Jam subscription](https://seller.wildberries.ru/monetization/jam) or **Pin a feedback** option in the [tariff constructor](https://seller.wildberries.ru/tariff-constructor).

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

Array (<= 500 items)

|     |     |
| --- | --- |
| pinMethod<br>required | string<br>Enum:"tariff""subscription"<br>Pinning methods:<br>- `subscription` — Jam subscription<br>- `tariff` — tariff option |
| pinOn<br>required | string<br>Enum:"nm""imt"<br>Feedback pinning placement:<br>- `nm` — product card<br>- `imt` — merged product card |
| feedbackId<br>required | string<br>Feedback ID |

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

`[{"pinMethod": "subscription",\
\
"pinOn": "imt",\
\
"feedbackId": "VlbkVVl7mtw37wуWkJZz"\
\
},\
\
{"pinMethod": "tariff",\
\
"pinOn": "imt",\
\
"feedbackId": "DibuRAImknLyiqgzvGcU"\
\
}\
\
]`

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

`{"data": [{"feedbackId": "VlbkVVl7mtw37wуWkJZz",\
\
"pinId": 18577062,\
\
"pinMethod": "subscription",\
\
"pinOn": "imt",\
\
"isErrors": false\
\
},\
\
{"feedbackId": "DibuRAImknLyiqgzvGcU",\
\
"pinMethod": "tariff",\
\
"pinOn": "imt",\
\
"isErrors": true,\
\
"errors": [{"status": "itemNotFound",\
\
"title": "item not found",\
\
"detail": "item not found or does not belong to seller",\
\
"requestId": "0414dc48df701618e0a3bfc414fe3136",\
\
"origin": "pin-open-api"\
\
}\
\
]\
\
}\
\
]

}`

## [tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/delete](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/delete) Unpin Feedback/api/feedbacks/v1/pins

deletehttps://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

https://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins

Method description

The method allows to unpin the feedback in the merged product card or product card.

To get `pinId` — feedback pinning operation ID, use the [List of pinned and unpinned feedback](https://dev.wildberries.ru/en/openapi/user-communication#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins/get) method.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

List of `pinId` — IDs of feedback pinning operations

Array (<= 500 items)

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

`[123456,\
\
234567,\
\
345678\
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

`{"data": [123456,\
\
234567,\
\
345678\
\
]

}`

## [tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1count/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1count/get) Pinned and Unpinned Feedback Number/api/feedbacks/v1/pins/count

gethttps://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins/count

https://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins/count

Method description

The method returns the number of pinned and unpinned feedback for the period.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| state | string<br>Enum:"pinned""unpinned"<br>Example:state=pinned<br>If the feedback is pinned:<br>- `pinned` — yes<br>- `unpinned` — no |
| pinOn | string<br>Enum:"nm""imt"<br>Example:pinOn=nm<br>Feedback pinning placement:<br>- `nm` — product card<br>- `imt` — merged product card |
| imtId | integer<br>Example:imtId=256971531<br>Merged product card ID<br>All WB articles of a merged product card have the same `imtId`.<br>Every product card has `imtId`, even if is not merged with any other card |
| nmId | integer<br>Example:nmId=177974151<br>WB article |
| feedbackId | integer<br>Example:feedbackId=789<br>Feedback ID |
| dateFrom | string<date-time><br>Example:dateFrom=2020-01-01T15:04:05Z<br>The date the first feedback in the list was pinned |
| dateTo | string<date-time><br>Example:dateTo=2020-02-01T15:04:05Z<br>The date the last feedback in the list was pinned |

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

`{"data": 0

}`

## [tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1limits/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Pinned-Feedback/paths/~1api~1feedbacks~1v1~1pins~1limits/get) Pinned Feedback Limits/api/feedbacks/v1/pins/limits

gethttps://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins/limits

https://feedbacks-api.wildberries.ru/api/feedbacks/v1/pins/limits

Method description

The method returns the pinned feedback limits for a tariff and subscription.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account for all methods in the **Feedbacks and Questions** category:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 second | 3 requests | 333 milliseconds | 6 requests |

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

`{"data": {"subscription": {"perUnitLimit": 2,

"remaining": 5,

"totalLimit": 15,

"unlimited": false,

"used": 10

},

"tariff": {"perUnitLimit": 2,

"remaining": 5,

"totalLimit": 15,

"unlimited": false,

"used": 10

}

}

}`

# [tag/Buyers-Chat](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Chat) Buyers Chat

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Buyers chat** category

Buyers chat allows sellers and buyers to communicate directly.


Buyers can ask questions about products or file complaints. We recommended to respond to the messages in the chat within 10 days.


The buyer always starts the chat. In one chat you can communicate only with one buyer.

Processing requests for product refunds is only available in [the web version of buyers chat](https://seller.wildberries.ru/chat-with-clients).


Chat operations:

1. [Get a chat list](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1chats/get). Save the chat ID in your database — this will allow you to update the chat information when receiving events.
2. [Get chat events](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1events/get): messages. New chats will have the `isNewChat` parameter set to `true`.
3. [Send messages to the chat](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1message/post)

## [tag/Buyers-Chat/paths/~1api~1v1~1seller~1chats/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Chat/paths/~1api~1v1~1seller~1chats/get) Chat List/api/v1/seller/chats

gethttps://buyer-chat-api.wildberries.ru/api/v1/seller/chats

https://buyer-chat-api.wildberries.ru/api/v1/seller/chats

Method description

Returns a list of all seller's chats.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 10 requests | 1 second | 10 requests |

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

`{"result": [{"chatID": "1:4019cd7d-cca8-4e90-8b11-f78afbea42e3",\
\
"replySign": "1:4019cd7d-cca8-4e90-8b11-f78afbea42e3:54828159:bc3a4c04079f5956cff170b25e73523aa1208b5c0bd7aea1e520a64ae3e212b1ebae6712661f3afd27520fa785fa3042254e8a3100ce00644322054ae7cfcd0e",\
\
"clientID": "123456",\
\
"clientName": "Иван",\
\
"goodCard": {"date": "string",\
\
"nmID": 0,\
\
"price": 0,\
\
"priceCurrency": "string",\
\
"rid": "string",\
\
"size": "string",\
\
"statusID": 0\
\
},\
\
"lastMessage": {"text": "Можно заказать 100 штук?",\
\
"addTimestamp": 1766138234889\
\
}\
\
}\
\
],

"errors": null

}`

## [tag/Buyers-Chat/paths/~1api~1v1~1seller~1events/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Chat/paths/~1api~1v1~1seller~1events/get) Chat Events/api/v1/seller/events

gethttps://buyer-chat-api.wildberries.ru/api/v1/seller/events

https://buyer-chat-api.wildberries.ru/api/v1/seller/events

Method description

Returns an event list for all chats.

To retrieve all events:

1. Make the first request without a `next` parameter.
2. Repeat the request with the `next` parameter value from the previous response until `totalEvents` becomes `0`. This will indicate that you have received all events.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 10 requests | 1 second | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| next | integer<br>Paginator. Retrieve the next data packet starting from this moment. <br>Format: Unix timestamp **with milliseconds** |

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

`{"result": {"next": 1698045576000,

"newestEventTime": "2023-10-23T07:19:36Z",

"oldestEventTime": "2023-10-23T05:02:20Z",

"totalEvents": 4,

"events": [{"chatID": "1:1e265a58-a120-b178-008c-60af2460207c",\
\
"eventID": "55adee45-11f0-33b6-a847-6ccc7c78b2ec",\
\
"eventType": "message",\
\
"isNewChat": true,\
\
"message": {"attachments": {"goodCard": {"date": "2023-10-18T11:46:01.528526Z",\
\
"nmID": 12345678,\
\
"price": 500,\
\
"priceCurrency": "RUB",\
\
"rid": "2fb52cd9e25e52538a5f05994e688ae5",\
\
"size": "0",\
\
"statusID": 11\
\
},\
\
"files": [{"contentType": "application/pdf",\
\
"date": "2023-10-23T08:02:19.594Z",\
\
"downloadID": "ecaeb056-a4ee-45b4-ae45-666811755d38",\
\
"name": "Чек.pdf",\
\
"url": "https://chat-basket-01.wbbasket.ru/vol0/part3265/fb25c9e9-cae8-52db-b68e-736c1896a3f5/pdf/0380e781-281e-41b5-8ae1-ce281f15a4a7.pdf",\
\
"size": 1046143\
\
}\
\
],\
\
"images": [{"date": "2023-10-23T08:02:20.717Z",\
\
"downloadID": "fd6be4e3-5447-41d7-a1e6-b2d3e06c3b05",\
\
"url": "https://chat-basket-01.wbbasket.ru/vol0/part2345/fb89c9e9-cae8-52db-b68e-736c1466a3f5/jpg/0823ff24-821e-40e9-8cdf-0a2b5fd86a32.jpg"\
\
}\
\
]\
\
},\
\
"text": "Здравствуйте! У меня вопрос по товару \"Альбом, бренд Эконом, артикул 13480414, товар получен 18.10.2023\""\
\
},\
\
"source": "rusite",\
\
"addTimestamp": 1698037340000,\
\
"addTime": "2023-10-23T05:02:20Z",\
\
"replySign": "1:1e265a58-a120-b178-008c-60af2460207c:66f136e919a8207e136757754f253189bfb9ae1ad9da9170c9d5c478626663908888c370216525bef51c0ca8d77952e05c9c17f9b63ab00374c5555b42efc07d",\
\
"sender": "client",\
\
"clientID": "186132",\
\
"clientName": "Алёна"\
\
},\
\
{"chatID": "1:1e265a58-a120-b178-008c-60af2460207c",\
\
"eventID": "cef95d3c-0345-4dc9-b6df-4c8c57a176a9",\
\
"eventType": "message",\
\
"message": {"text": "Здравствуйте! Пришёл не тот цвет. Можно вернуть и заказать другой товар?"\
\
},\
\
"source": "rusite",\
\
"addTimestamp": 1698037387000,\
\
"addTime": "2023-10-23T05:03:07Z",\
\
"sender": "client",\
\
"clientID": "186132",\
\
"clientName": "Алёна"\
\
},\
\
{"chatID": "1:1e265a58-a120-b178-008c-60af2460207c",\
\
"eventID": "fd22e5bf-64fd-43f7-b3a0-ad29uu027f97",\
\
"eventType": "message",\
\
"message": {"text": "Здравствуйте. Да, сейчас оформим возврат."\
\
},\
\
"source": "seller-public-api",\
\
"addTimestamp": 1698038124000,\
\
"addTime": "2023-10-23T05:15:24Z",\
\
"sender": "seller"\
\
},\
\
{"chatID": "1:1e265a58-a120-b178-008c-60af2460207c",\
\
"eventID": "cef95d3c-0345-4dc9-b6df-4c8c75a176a7",\
\
"eventType": "message",\
\
"addTimestamp": 1698045576000,\
\
"addTime": "2023-10-23T07:19:36Z",\
\
"sender": "seller"\
\
}\
\
]

},

"errors": null

}`

## [tag/Buyers-Chat/paths/~1api~1v1~1seller~1message/post](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Chat/paths/~1api~1v1~1seller~1message/post) Send Message/api/v1/seller/message

posthttps://buyer-chat-api.wildberries.ru/api/v1/seller/message

https://buyer-chat-api.wildberries.ru/api/v1/seller/message

Method description

Sends message to the buyer.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 10 requests | 1 second | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: multipart/form-data  required

|     |     |
| --- | --- |
| replySign<br>required | string<= 255 characters<br>Chat signature. Can be obtained from [chat information](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1chats/get) or [event data](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1events/get) if the event contains the `"isNewChat": true` field. |
| message | string<= 1000 characters<br>Message text. Maximum of 1000 symbols. |
| file | Array of strings<binary>\[ items <binary > \]<br>Files, in JPEG, PDF, or PNG format, maximum size — 5 MB each. Maximum of total file size — 30 MB. |

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

`{"result": {"addTime": 1712848270018,

"chatID": "1:641b623c-5c0e-295b-db03-3d5b4d484c32"

},

"errors": [ ]

}`

## [tag/Buyers-Chat/paths/~1api~1v1~1seller~1download~1{id}/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Chat/paths/~1api~1v1~1seller~1download~1{id}/get) Get File from the Message/api/v1/seller/download/{id}

gethttps://buyer-chat-api.wildberries.ru/api/v1/seller/download/{id}

https://buyer-chat-api.wildberries.ru/api/v1/seller/download/{id}

Method description

The method provides a file or image from the message by its ID.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 10 seconds | 10 requests | 1 second | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### path Parameters

|     |     |
| --- | --- |
| id<br>required | string<br>File ID from the `downloadID` field in the [chat events](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Chat/paths/~1api~1v1~1seller~1events/get) method |

### Responses

**200**

Success

**400**

Bad request

### Response samples

- 400

Content type

application/json

Invalid file ID

Copy

`{"status": 400,

"title": "invalid fileID",

"origin": "proxy-chats",

"detail": "invalid fileID",

"requestId": "62f59a4ce21064f20b1bbc28c85f38d8",

"error": "invalid fileID"

}`

# [tag/Buyers-Returns](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Returns) Buyers Returns

To access the methods, use a [token](https://dev.wildberries.ru/en/openapi/api-information#tag/Authorization/How-to-create-a-personal-access-base-or-test-token) for the **Buyers returns** category

## [tag/Buyers-Returns/paths/~1api~1v1~1claims/get](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Returns/paths/~1api~1v1~1claims/get) Buyers Return Applications/api/v1/claims

gethttps://returns-api.wildberries.ru/api/v1/claims

https://returns-api.wildberries.ru/api/v1/claims

Method description

Returns buyers applications for product returns for the current 14 days.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 20 requests | 3 seconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### query Parameters

|     |     |
| --- | --- |
| is\_archive<br>required | boolean<br>Example:is\_archive=true<br>Application status:<br>- `false` — under review<br>- `true` — in archive |
| id | string<UUID><br>Example:id=fe3e9337-e9f9-423c-8930-946a8ebef80<br>Application ID |
| limit | integer<uint>\[ 1 .. 200 \]<br>Example:limit=50<br>Number of applications in the response. `50` by default |
| offset | integer<uint>>= 0<br>Example:offset=0<br>From which element to start outputting data. `0` by default |
| nm\_id | integer<br>Example:nm\_id=196320101<br>WB article |

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

`{"claims": [{"id": "fe3e9337-e9f9-423c-8930-946a8ebef80",\
\
"claim_type": 1,\
\
"status": 2,\
\
"status_ex": 8,\
\
"nm_id": 196320101,\
\
"user_comment": "Длина провода не соответствует описанию",\
\
"wb_comment": "Продавец одобрил вашу заявку на возврат. В течение 14 дней принесите товар в определённый пункт выдачи — всё зависит от того, как вы получали заказ:\r\n\r\n∙ В пункте выдачи. Тогда нужно будет вернуть в тот же пункт по тому же адресу. \r\n∙ Курьером. Зайдите в раздел «Покупки» на сайте — там будет адрес пункта, в который нужно принести товар.\r\n\r\nВозьмите с собой пакет со штрих-кодом, в котором был товар. Если вы его потеряли или выбросили — ничего страшного, мы всё равно сможем провести возврат. Но в будущем, пожалуйста, сохраняйте этот пакет. \r\n\r\nДеньги придут на вашу карту или счёт в течение 10 дней после возврата товара на склад.\r\n\r\nЕсли у вас крупногабаритный товар, то для его возврата вызовите курьера через раздел «Доставки».",\
\
"dt": "2024-03-26T17:06:12.245611",\
\
"imt_name": "Кабель 0.5 м, 3797",\
\
"order_dt": "2020-10-27T05:18:56",\
\
"dt_update": "2024-05-10T18:01:06.999613",\
\
"photos": ["//photos.wbstatic.net/claim/fe3e9337-e9f9-423c-8930-946a8ebef80/1.webp",\
\
"//photos.wbstatic.net/claim/fe3e9337-e9f9-423c-8930-946a8ebef80/2.webp"\
\
],\
\
"video_paths": ["//video.wbstatic.net/claim/fe3e9337-e9f9-423c-8930-946a8ebef80/1.mp4"\
\
],\
\
"actions": ["autorefund1",\
\
"approve1"\
\
],\
\
"price": 157,\
\
"currency_code": "643",\
\
"srid": "v5o_7143225816503318733.0.0"\
\
}\
\
],

"total": 31

}`

## [tag/Buyers-Returns/paths/~1api~1v1~1claim/patch](https://dev.wildberries.ru/en/openapi/user-communication\#tag/Buyers-Returns/paths/~1api~1v1~1claim/patch) Answer Buyers Application/api/v1/claim

patchhttps://returns-api.wildberries.ru/api/v1/claim

https://returns-api.wildberries.ru/api/v1/claim

Method description

Sends an answer to the buyers application for product return.

[Request limit](https://dev.wildberries.ru/en/openapi/api-information#tag/Introduction/Rate-Limits) per one seller's account:

| Period | Limit | Interval | Burst |
| --- | --- | --- | --- |
| 1 minute | 20 requests | 3 seconds | 10 requests |

##### Authorizations:

_HeaderApiKey_

##### Request Body schema: application/json  required

Application answer

|     |     |
| --- | --- |
| id<br>required | string<UUID><br>Application ID |
| action<br>required | string<br>Application action.<br>Use one of the `actions` array values from the response of the getting [buyers applications](https://dev.wildberries.ru/en/openapi/user-communication#tag/Buyers-Returns/paths/~1api~1v1~1claims/get) method |
| comment | string\[ 10 .. 1000 \] characters<br>Comment.<br>Only when `"action":"rejectcustom"` or `"action":"approvecc1"`. When `"action":"rejectcustom"` this parameter is required |

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

`{"id": "fe3e9337-e9f9-423c-8930-946a8ebef80",

"action": "rejectcustom",

"comment": "The photo is not related to the product in the application"

}`

### Response samples

- 400
- 401
- 429

Content type

application/json; charset=utf-8

Copy

`{"title": "Validation error",

"detail": "Input model is not valid; Details: The Action field is required.",

"requestId": "0HN3PI6JUGFSL:00000004"

}`

We use [cookies](https://dev.wildberries.ru/privacy) to collect statistics and improve our service

Accept

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категории токена:** Feedbacks and Questions, Buyers Chat, Buyers Returns
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/user-communication

