# HubMarket — API Catalog (полный реестр эндпоинтов трёх спек)

> Автогенерируется: `node scripts/gen-api-coverage.mjs`. Не редактировать вручную.
> **Все** эндпоинты из локальных спек WB / Ozon / YM. Колонка «Исп.» = метод нашего клиента
> (`lib/api/*.ts`), если уже используем; пусто = ещё не внедрено (кандидат на реализацию).

## Спеки (источники)

| Маркетплейс | Файл | Формат | Базовые хосты | Refresh |
|---|---|---|---|---|
| Wildberries | `docs/api/wb/01-general.yaml` … `13-finances.yaml` (13 шт.) | OpenAPI YAML | `{content,statistics,discounts-prices,advert,feedbacks,finance,seller-analytics,marketplace,common,dp-calendar}-api.wildberries.ru` | `https://dev.wildberries.ru/api/swagger/yaml/en/{n}-{name}.yaml` |
| Yandex Market | `docs/api/yandex-market/openapi.yaml` | OpenAPI YAML | `api.partner.market.yandex.ru` (база `…/v2`) | github.com/yandex-market/yandex-market-partner-api |
| Ozon Seller | `docs/api/ozon/swagger_ozon.json` | OpenAPI 3.0 JSON | `api-seller.ozon.ru` | Redoc на docs.ozon.ru (Swagger UI 403) |

Performance API Ozon (реклама) — отдельно на `api-performance.ozon.ru`, OAuth2, НЕ в спеке.

## Сводка покрытия

| Маркетплейс | Эндпоинтов в спеке | Используем | Осталось |
|---|---|---|---|
| Wildberries | 282 | 68 | 214 |
| Ozon | 447 | 37 | 410 |
| Yandex Market | 152 | 24 | 128 |
| **Итого** | **881** | **129** | **752** |

«Используем» считается по совпадению пути (нормализация параметров; для YM — без префикса `/v2`).

---

# Wildberries — 282 эндпоинтов (по файлам спек)

### 01-general.yaml — 9 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/common/v1/rating | Получить рейтинг продавца |  |
| `GET` /api/common/v1/subscriptions | Получить информацию о подписке Джем |  |
| `GET` /api/communications/v2/news | Получение новостей портала продавцов |  |
| `POST` /api/v1/invite | Создать приглашение для нового пользователя |  |
| `GET` /api/v1/seller-info | Получить информацию о продавце |  |
| `DELETE` /api/v1/user | Удалить пользователя |  |
| `GET` /api/v1/users | Получить список активных или приглашённых пользователей продавца |  |
| `PUT` /api/v1/users/access | Изменить права доступа пользователей |  |
| `GET` /ping | Проверка подключения | ✅ `validateKey` |

### 02-products.yaml — 50 (используем 15)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/content/v1/brands | Бренды |  |
| `POST` /api/discounts-prices/v1/upload/task/b2b/wholesale | Установить оптовые скидки для B2B-продаж |  |
| `GET` /api/v2/buffer/goods/task | Детализация необработанной загрузки |  |
| `GET` /api/v2/buffer/tasks | Состояние необработанной загрузки |  |
| `GET` /api/v2/history/goods/task | Детализация обработанной загрузки |  |
| `GET` /api/v2/history/tasks | Состояние обработанной загрузки |  |
| `GET` /api/v2/list/goods/filter | Получить товары с ценами | ✅ `getPrices` |
| `POST` /api/v2/list/goods/filter | Получить товары с ценами по артикулам | ✅ `getPrices` |
| `GET` /api/v2/list/goods/size/nm | Получить размеры товара с ценами |  |
| `GET` /api/v2/quarantine/goods | Получить товары в карантине |  |
| `POST` /api/v2/upload/task | Установить цены и скидки | ✅ `updatePrices` |
| `POST` /api/v2/upload/task/club-discount | Установить скидки WB Клуба |  |
| `POST` /api/v2/upload/task/size | Установить цены для размеров |  |
| `GET` /api/v3/dbw/warehouses/{warehouseId}/contacts | Список контактов |  |
| `PUT` /api/v3/dbw/warehouses/{warehouseId}/contacts | Обновить список контактов |  |
| `GET` /api/v3/offices | Получить список складов WB |  |
| `POST` /api/v3/stocks/{warehouseId} | Получить остатки товаров | ✅ `updateStocks` |
| `PUT` /api/v3/stocks/{warehouseId} | Обновить остатки товаров | ✅ `updateStocks` |
| `DELETE` /api/v3/stocks/{warehouseId} | Удалить остатки товаров | ✅ `updateStocks` |
| `GET` /api/v3/warehouses | Получить список складов продавца | ✅ `getWarehouses` |
| `POST` /api/v3/warehouses | Создать склад продавца | ✅ `getWarehouses` |
| `PUT` /api/v3/warehouses/{warehouseId} | Обновить склад продавца | ✅ `getWarehouses` |
| `DELETE` /api/v3/warehouses/{warehouseId} | Удалить склад продавца | ✅ `getWarehouses` |
| `POST` /content/v2/barcodes | Генерация баркодов |  |
| `POST` /content/v2/cards/delete/trash | Перенос карточек товаров в корзину | ✅ `moveToTrash` |
| `POST` /content/v2/cards/error/list | Список несозданных карточек товаров с ошибками |  |
| `GET` /content/v2/cards/limits | Лимиты карточек товаров |  |
| `POST` /content/v2/cards/moveNm | Объединение и разъединение карточек товаров |  |
| `POST` /content/v2/cards/recover | Восстановление карточек товаров из корзины |  |
| `POST` /content/v2/cards/update | Редактирование карточек товаров |  |
| `POST` /content/v2/cards/upload | Создание карточек товаров | ✅ `createProduct` |
| `POST` /content/v2/cards/upload/add | Создание карточек товаров с присоединением |  |
| `GET` /content/v2/directory/colors | Цвет |  |
| `GET` /content/v2/directory/countries | Страна производства |  |
| `GET` /content/v2/directory/kinds | Пол |  |
| `GET` /content/v2/directory/seasons | Сезон |  |
| `GET` /content/v2/directory/tnved | ТНВЭД-код |  |
| `GET` /content/v2/directory/vat | Ставка НДС |  |
| `POST` /content/v2/get/cards/list | Список карточек товаров | ✅ `getProducts` |
| `POST` /content/v2/get/cards/trash | Список карточек товаров в корзине |  |
| `GET` /content/v2/object/all | Список предметов | ✅ `getCategories` |
| `GET` /content/v2/object/charcs/{subjectId} | Характеристики предмета | ✅ `getCategoryCharacteristics` |
| `GET` /content/v2/object/parent/all | Родительские категории товаров |  |
| `POST` /content/v2/tag | Создание ярлыка |  |
| `PATCH` /content/v2/tag/{id} | Изменение ярлыка |  |
| `DELETE` /content/v2/tag/{id} | Удаление ярлыка |  |
| `POST` /content/v2/tag/nomenclature/link | Управление ярлыками в карточке товара |  |
| `GET` /content/v2/tags | Список ярлыков |  |
| `POST` /content/v3/media/file | Загрузить медиафайл |  |
| `POST` /content/v3/media/save | Загрузить медиафайлы по ссылкам |  |

### 03-orders-fbs.yaml — 35 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/marketplace/v3/fbs/orders/archive | Получить список архивных сборочных заданий |  |
| `PUT` /api/marketplace/v3/orders/{orderId}/meta/customs-declaration | Закрепить за сборочным заданием номер ДТ |  |
| `POST` /api/marketplace/v3/orders/meta | Получить идентификаторы маркировки сборочных заданий |  |
| `GET` /api/marketplace/v3/supplies/{supplyId}/order-ids | Получить ID сборочных заданий поставки |  |
| `PATCH` /api/marketplace/v3/supplies/{supplyId}/orders | Добавить сборочные задания к поставке |  |
| `GET` /api/v3/orders | Получить информацию о сборочных заданиях |  |
| `PATCH` /api/v3/orders/{orderId}/cancel | Отменить сборочное задание |  |
| `DELETE` /api/v3/orders/{orderId}/meta | Удалить идентификаторы маркировки сборочного задания |  |
| `PUT` /api/v3/orders/{orderId}/meta/expiration | Закрепить за сборочным заданием срок годности товара |  |
| `PUT` /api/v3/orders/{orderId}/meta/gtin | Закрепить за сборочным заданием GTIN |  |
| `PUT` /api/v3/orders/{orderId}/meta/imei | Закрепить за сборочным заданием IMEI |  |
| `PUT` /api/v3/orders/{orderId}/meta/sgtin | Закрепить за сборочным заданием код маркировки Честного знака |  |
| `PUT` /api/v3/orders/{orderId}/meta/uin | Закрепить за сборочным заданием УИН |  |
| `POST` /api/v3/orders/client | Заказы с информацией по клиенту |  |
| `GET` /api/v3/orders/new | Получить список новых сборочных заданий |  |
| `POST` /api/v3/orders/status | Получить статусы сборочных заданий |  |
| `POST` /api/v3/orders/status/history | История статусов для сборочных заданий трансграничных поставок |  |
| `POST` /api/v3/orders/stickers | Получить стикеры сборочных заданий |  |
| `POST` /api/v3/orders/stickers/cross-border | Получить стикеры сборочных заданий трансграничных поставок |  |
| `GET` /api/v3/passes | Получить список пропусков |  |
| `POST` /api/v3/passes | Создать пропуск |  |
| `PUT` /api/v3/passes/{passId} | Обновить пропуск |  |
| `DELETE` /api/v3/passes/{passId} | Удалить пропуск |  |
| `GET` /api/v3/passes/offices | Получить список складов, для которых требуется пропуск |  |
| `GET` /api/v3/supplies | Получить список поставок |  |
| `POST` /api/v3/supplies | Создать новую поставку |  |
| `GET` /api/v3/supplies/{supplyId} | Получить информацию о поставке |  |
| `DELETE` /api/v3/supplies/{supplyId} | Удалить поставку |  |
| `GET` /api/v3/supplies/{supplyId}/barcode | Получить QR-код поставки |  |
| `PATCH` /api/v3/supplies/{supplyId}/deliver | Передать поставку в доставку |  |
| `GET` /api/v3/supplies/{supplyId}/trbx | Получить список грузомест поставки |  |
| `POST` /api/v3/supplies/{supplyId}/trbx | Добавить грузоместа к поставке |  |
| `DELETE` /api/v3/supplies/{supplyId}/trbx | Удалить грузоместа из поставки |  |
| `POST` /api/v3/supplies/{supplyId}/trbx/stickers | Получить стикеры грузомест поставки |  |
| `GET` /api/v3/supplies/orders/reshipment | Получить все сборочные задания для повторной отгрузки |  |

### 04-orders-dbw.yaml — 20 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/marketplace/v3/dbw/orders/client | Информация о покупателе |  |
| `POST` /api/marketplace/v3/dbw/orders/meta/delete | Удалить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/dbw/orders/meta/details | Получить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/dbw/orders/meta/sgtin | Закрепить коды маркировки Честного знака за сборочными заданиями |  |
| `POST` /api/marketplace/v3/dbw/orders/status/deliver | Перевести сборочные задания в доставку |  |
| `GET` /api/v3/dbw/orders | Получить информацию о завершенных сборочных заданиях |  |
| `PATCH` /api/v3/dbw/orders/{orderId}/assemble ⚠️deprecated | Перевести в доставку |  |
| `PATCH` /api/v3/dbw/orders/{orderId}/cancel | Отменить сборочное задание |  |
| `PATCH` /api/v3/dbw/orders/{orderId}/confirm | Перевести на сборку |  |
| `GET` /api/v3/dbw/orders/{orderId}/meta ⚠️deprecated | Получить идентификаторы маркировки сборочного задания |  |
| `DELETE` /api/v3/dbw/orders/{orderId}/meta ⚠️deprecated | Удалить идентификаторы маркировки сборочного задания |  |
| `PUT` /api/v3/dbw/orders/{orderId}/meta/gtin | Закрепить за сборочным заданием GTIN |  |
| `PUT` /api/v3/dbw/orders/{orderId}/meta/imei | Закрепить за сборочным заданием IMEI |  |
| `PUT` /api/v3/dbw/orders/{orderId}/meta/sgtin ⚠️deprecated | Закрепить за сборочным заданием код маркировки товара |  |
| `PUT` /api/v3/dbw/orders/{orderId}/meta/uin | Закрепить за сборочным заданием УИН (уникальный идентификационный номер) |  |
| `POST` /api/v3/dbw/orders/courier | Информация о курьере |  |
| `POST` /api/v3/dbw/orders/delivery-date | Получить дату и время доставки |  |
| `GET` /api/v3/dbw/orders/new | Получить список новых сборочных заданий |  |
| `POST` /api/v3/dbw/orders/status | Получить статусы сборочных заданий |  |
| `POST` /api/v3/dbw/orders/stickers | Получить стикеры сборочных заданий |  |

### 05-orders-dbs.yaml — 21 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/marketplace/v3/dbs/orders/b2b/info | Информация о покупателе B2B |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/customs-declaration | Закрепить за сборочными заданиями номер ДТ |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/delete | Удалить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/details | Получить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/gtin | Закрепить GTIN за сборочными заданиями |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/imei | Закрепить IMEI за сборочными заданиями |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/info ⚠️deprecated | Получить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/sgtin | Закрепить коды маркировки Честного знака за сборочными заданиями |  |
| `POST` /api/marketplace/v3/dbs/orders/meta/uin | Закрепить УИН за сборочными заданиями |  |
| `POST` /api/marketplace/v3/dbs/orders/status/cancel | Отменить сборочные задания |  |
| `POST` /api/marketplace/v3/dbs/orders/status/confirm | Перевести сборочные задания на сборку |  |
| `POST` /api/marketplace/v3/dbs/orders/status/deliver | Перевести сборочные задания в доставку |  |
| `POST` /api/marketplace/v3/dbs/orders/status/info | Получить статусы сборочных заданий |  |
| `POST` /api/marketplace/v3/dbs/orders/status/receive | Сообщить о получении заказов |  |
| `POST` /api/marketplace/v3/dbs/orders/status/reject | Сообщить об отказе от заказов |  |
| `POST` /api/marketplace/v3/dbs/orders/stickers | Получить стикеры для сборочных заданий с доставкой в ПВЗ |  |
| `POST` /api/v3/dbs/groups/info | Получить информацию о платной доставке |  |
| `GET` /api/v3/dbs/orders | Получить информацию о завершенных сборочных заданиях |  |
| `POST` /api/v3/dbs/orders/client | Информация о покупателе |  |
| `POST` /api/v3/dbs/orders/delivery-date | Получить дату и время доставки |  |
| `GET` /api/v3/dbs/orders/new | Получить список новых сборочных заданий |  |

### 06-in-store-pickup.yaml — 16 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/marketplace/v3/click-collect/orders/meta/delete | Удалить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/click-collect/orders/meta/gtin | Закрепить GTIN за сборочными заданиями |  |
| `POST` /api/marketplace/v3/click-collect/orders/meta/imei | Закрепить IMEI за сборочными заданиями |  |
| `POST` /api/marketplace/v3/click-collect/orders/meta/info | Получить идентификаторы маркировки сборочных заданий |  |
| `POST` /api/marketplace/v3/click-collect/orders/meta/sgtin | Закрепить коды маркировки Честного знака за сборочными заданиями |  |
| `POST` /api/marketplace/v3/click-collect/orders/meta/uin | Закрепить УИН за сборочными заданиями |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/cancel | Отменить сборочные задания |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/confirm | Перевести сборочные задания на сборку |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/info | Получить статусы сборочных заданий |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/prepare | Сообщить, что сборочные задания готовы к выдаче |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/receive | Сообщить, что заказы приняты покупателями |  |
| `POST` /api/marketplace/v3/click-collect/orders/status/reject | Сообщить об отказе от заказов |  |
| `GET` /api/v3/click-collect/orders | Получить информацию о завершённых сборочных заданиях |  |
| `POST` /api/v3/click-collect/orders/client | Информация о покупателе |  |
| `POST` /api/v3/click-collect/orders/client/identity | Проверить, что заказ принадлежит покупателю |  |
| `GET` /api/v3/click-collect/orders/new | Получить список новых сборочных заданий |  |

### 07-orders-fbw.yaml — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/v1/acceptance/options | Опции приёмки |  |
| `POST` /api/v1/supplies | Список поставок |  |
| `GET` /api/v1/supplies/{ID} | Детали поставки |  |
| `GET` /api/v1/supplies/{ID}/goods | Товары поставки |  |
| `GET` /api/v1/supplies/{ID}/package | Упаковка поставки |  |
| `GET` /api/v1/transit-tariffs | Транзитные направления |  |
| `GET` /api/v1/warehouses | Список складов |  |

### 08-promotion.yaml — 39 (используем 17)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `PATCH` /adv/v0/auction/nms | Изменение списка карточек товаров в кампаниях |  |
| `PUT` /adv/v0/auction/placements | Изменение мест размещения в кампаниях с ручной ставкой |  |
| `GET` /adv/v0/delete | Удаление кампании |  |
| `POST` /adv/v0/normquery/bids | Установить ставки для поисковых кластеров | ✅ `setNormQueryBids` |
| `DELETE` /adv/v0/normquery/bids | Удалить ставки поисковых кластеров | ✅ `setNormQueryBids` |
| `POST` /adv/v0/normquery/get-bids | Список ставок поисковых кластеров | ✅ `getNormQueryBids` |
| `POST` /adv/v0/normquery/get-minus | Список минус-фраз кампаний | ✅ `getMinusWords` |
| `POST` /adv/v0/normquery/list | Списки активных и неактивных поисковых кластеров |  |
| `POST` /adv/v0/normquery/set-minus | Установка и удаление минус-фраз | ✅ `setMinusWords` |
| `POST` /adv/v0/normquery/stats | Статистика поисковых кластеров | ✅ `getKeywordStats` |
| `GET` /adv/v0/pause | Пауза кампании | ✅ `pauseCampaign` |
| `POST` /adv/v0/rename | Переименование кампании |  |
| `GET` /adv/v0/start | Запуск кампании | ✅ `startCampaign` |
| `GET` /adv/v0/stop | Завершение кампании |  |
| `GET` /adv/v1/advert | Информация о медиакампании |  |
| `GET` /adv/v1/adverts | Список медиакампаний |  |
| `GET` /adv/v1/balance | Баланс | ✅ `getAdvertBalance` |
| `GET` /adv/v1/budget | Бюджет кампании |  |
| `POST` /adv/v1/budget/deposit | Пополнение бюджета кампании |  |
| `GET` /adv/v1/count | Количество медиакампаний |  |
| `POST` /adv/v1/normquery/stats | Статистика по поисковым кластерам с детализацией по дням |  |
| `GET` /adv/v1/payments | Получение истории пополнений счёта |  |
| `GET` /adv/v1/promotion/count | Списки кампаний | ✅ `getCampaignCounts` |
| `POST` /adv/v1/stats | Статистика медиакампаний |  |
| `GET` /adv/v1/supplier/subjects | Предметы для кампаний |  |
| `GET` /adv/v1/upd | Получение истории затрат | ✅ `getAdvertCostHistory` |
| `POST` /adv/v2/seacat/save-ad | Создать кампанию |  |
| `POST` /adv/v2/supplier/nms | Карточки товаров для кампаний |  |
| `GET` /adv/v3/fullstats | Статистика кампаний | ✅ `getAdvertStats` |
| `GET` /api/advert/v0/bids/recommendations | Рекомендуемые ставки для карточек товаров и поисковых кластеров |  |
| `PATCH` /api/advert/v1/bids | Изменение ставок в кампаниях |  |
| `POST` /api/advert/v1/bids/min | Минимальные ставки для карточек товаров |  |
| `GET` /api/advert/v2/adverts | Информация о кампаниях | ✅ `getAdverts` |
| `POST` /api/content/v1/recommendations/list | Список рекомендаций в карточках товаров |  |
| `POST` /api/content/v1/recommendations/set | Установить рекомендации для товаров |  |
| `GET` /api/v1/calendar/promotions | Список акций | ✅ `getCalendarPromotions` |
| `GET` /api/v1/calendar/promotions/details | Детальная информация об акциях | ✅ `getCalendarPromotionDetails` |
| `GET` /api/v1/calendar/promotions/nomenclatures | Список товаров для участия в акции | ✅ `getCalendarNomenclatures` |
| `POST` /api/v1/calendar/promotions/upload | Добавить товар в акцию | ✅ `uploadToPromotion` |

### 09-communications.yaml — 25 (используем 5)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/feedbacks/v1/pins | Список закреплённых и откреплённых отзывов |  |
| `POST` /api/feedbacks/v1/pins | Закрепить отзывы |  |
| `DELETE` /api/feedbacks/v1/pins | Открепить отзывы |  |
| `GET` /api/feedbacks/v1/pins/count | Количество закреплённых и откреплённых отзывов |  |
| `GET` /api/feedbacks/v1/pins/limits | Лимиты закреплённых отзывов |  |
| `PATCH` /api/v1/claim | Ответ на заявку покупателя |  |
| `GET` /api/v1/claims | Заявки покупателей на возврат |  |
| `GET` /api/v1/feedback | Получить отзыв по ID |  |
| `GET` /api/v1/feedbacks | Список отзывов | ✅ `getFeedbacks` |
| `POST` /api/v1/feedbacks/answer | Ответить на отзыв | ✅ `answerFeedback` |
| `PATCH` /api/v1/feedbacks/answer | Отредактировать ответ на отзыв | ✅ `answerFeedback` |
| `GET` /api/v1/feedbacks/archive | Список архивных отзывов |  |
| `GET` /api/v1/feedbacks/count | Количество отзывов |  |
| `GET` /api/v1/feedbacks/count-unanswered | Необработанные отзывы |  |
| `POST` /api/v1/feedbacks/order/return | Возврат товара по ID отзыва |  |
| `GET` /api/v1/new-feedbacks-questions | Непросмотренные отзывы и вопросы |  |
| `GET` /api/v1/question | Получить вопрос по ID |  |
| `GET` /api/v1/questions | Список вопросов | ✅ `getQuestions` |
| `PATCH` /api/v1/questions | Работа с вопросами | ✅ `getQuestions` |
| `GET` /api/v1/questions/count | Количество вопросов |  |
| `GET` /api/v1/questions/count-unanswered | Неотвеченные вопросы |  |
| `GET` /api/v1/seller/chats | Список чатов |  |
| `GET` /api/v1/seller/download/{id} | Получить файл из сообщения |  |
| `GET` /api/v1/seller/events | События чатов |  |
| `POST` /api/v1/seller/message | Отправить сообщение |  |

### 10-tariffs.yaml — 5 (используем 5)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/tariffs/v1/acceptance/coefficients | Тарифы на поставку | ✅ `getAcceptanceCoefficients` |
| `GET` /api/v1/tariffs/box | Тарифы для коробов | ✅ `getTariffBox` |
| `GET` /api/v1/tariffs/commission | Комиссия по категориям товаров | ✅ `getTariffCommission` |
| `GET` /api/v1/tariffs/pallet | Тарифы для монопаллет | ✅ `getPalletTariffs` |
| `GET` /api/v1/tariffs/return | Тарифы на возврат | ✅ `getReturnTariffs` |

### 11-analytics.yaml — 18 (используем 9)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/analytics/v1/item-rating | Получить отчёт |  |
| `POST` /api/analytics/v1/stocks-report/wb-warehouses | Остатки на складах WB |  |
| `POST` /api/analytics/v3/sales-funnel/grouped/history | Статистика групп карточек товаров по дням | ✅ `getNmReportGrouped` |
| `POST` /api/analytics/v3/sales-funnel/products | Статистика карточек товаров за период |  |
| `POST` /api/analytics/v3/sales-funnel/products/history | Статистика карточек товаров по дням | ✅ `getNmReport` |
| `GET` /api/v2/nm-report/downloads | Получить список отчётов |  |
| `POST` /api/v2/nm-report/downloads | Создать отчёт |  |
| `GET` /api/v2/nm-report/downloads/file/{downloadId} | Получить отчёт |  |
| `POST` /api/v2/nm-report/downloads/retry | Сгенерировать отчёт повторно |  |
| `POST` /api/v2/search-report/product/orders | Заказы и позиции по поисковым запросам товара |  |
| `POST` /api/v2/search-report/product/search-texts | Поисковые запросы по товару | ✅ `getProductSearchTexts` |
| `POST` /api/v2/search-report/report | Основная страница | ✅ `getSearchReport` |
| `POST` /api/v2/search-report/table/details | Пагинация по товарам в группе | ✅ `getSearchReportDetails` |
| `POST` /api/v2/search-report/table/groups | Пагинация по группам |  |
| `POST` /api/v2/stocks-report/offices | Данные по складам | ✅ `getStocksReportOffices` |
| `POST` /api/v2/stocks-report/products/groups | Данные по группам | ✅ `getStocksReportGroups` |
| `POST` /api/v2/stocks-report/products/products | Данные по товарам | ✅ `getStocksReportProducts` |
| `POST` /api/v2/stocks-report/products/sizes | Данные по размерам | ✅ `getStocksReportSizes` |

### 12-reports.yaml — 25 (используем 14)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /api/analytics/v1/deductions | Подмены и неверные вложения | ✅ `getSearchReportDetails` |
| `GET` /api/analytics/v1/measurement-penalties | Удержания за занижение габаритов упаковки |  |
| `GET` /api/analytics/v1/warehouse-measurements | Замеры склада |  |
| `GET` /api/v1/acceptance_report | Создать отчёт |  |
| `GET` /api/v1/acceptance_report/tasks/{task_id}/download | Получить отчёт |  |
| `GET` /api/v1/acceptance_report/tasks/{task_id}/status | Проверить статус |  |
| `GET` /api/v1/analytics/antifraud-details | Самовыкупы | ✅ `getAntifraudDetails` |
| `GET` /api/v1/analytics/banned-products/blocked | Заблокированные карточки | ✅ `getBannedProducts` |
| `GET` /api/v1/analytics/banned-products/shadowed | Скрытые из каталога |  |
| `GET` /api/v1/analytics/brand-share | Получить отчёт | ✅ `getBrandShareReport` |
| `GET` /api/v1/analytics/brand-share/brands | Бренды продавца | ✅ `getBrandShareBrands` |
| `GET` /api/v1/analytics/brand-share/parent-subjects | Родительские категории бренда | ✅ `getBrandShareCategories` |
| `POST` /api/v1/analytics/excise-report | Получить отчёт |  |
| `GET` /api/v1/analytics/goods-labeling | Маркировка товара |  |
| `GET` /api/v1/analytics/goods-return | Получить отчёт | ✅ `getReturns` |
| `GET` /api/v1/analytics/region-sale | Получить отчёт | ✅ `getRegionalSales` |
| `GET` /api/v1/paid_storage | Создать отчёт | ✅ `getPaidStorage` |
| `GET` /api/v1/paid_storage/tasks/{task_id}/download | Получить отчёт | ✅ `getPaidStorage` |
| `GET` /api/v1/paid_storage/tasks/{task_id}/status | Проверить статус | ✅ `getPaidStorage` |
| `GET` /api/v1/supplier/orders | Заказы | ✅ `getOrders` |
| `GET` /api/v1/supplier/sales | Продажи | ✅ `getSales` |
| `GET` /api/v1/supplier/stocks ⚠️deprecated | Склады | ✅ `getStocksFbw` |
| `GET` /api/v1/warehouse_remains | Создать отчёт |  |
| `GET` /api/v1/warehouse_remains/tasks/{task_id}/download | Получить отчёт |  |
| `GET` /api/v1/warehouse_remains/tasks/{task_id}/status | Проверить статус |  |

### 13-finances.yaml — 12 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /api/finance/v1/acquiring/detailed | Детализации к отчётам об издержках на приём платежей за период |  |
| `POST` /api/finance/v1/acquiring/detailed/{reportId} | Детализации к отчётам об издержках на приём платежей по ID отчётов |  |
| `POST` /api/finance/v1/acquiring/list | Список отчётов об издержках на приём платежей |  |
| `POST` /api/finance/v1/sales-reports/detailed | Детализации к отчётам реализации за период |  |
| `POST` /api/finance/v1/sales-reports/detailed/{reportId} | Детализации к отчётам реализации по ID отчётов |  |
| `POST` /api/finance/v1/sales-reports/list | Список отчётов реализации |  |
| `GET` /api/v1/account/balance | Получить баланс продавца | ✅ `getBalance` |
| `GET` /api/v1/documents/categories | Категории документов |  |
| `GET` /api/v1/documents/download | Получить документ |  |
| `POST` /api/v1/documents/download/all | Получить документы |  |
| `GET` /api/v1/documents/list | Список документов |  |
| `GET` /api/v5/supplier/reportDetailByPeriod ⚠️deprecated | Отчёт о продажах по реализации | ✅ `getReportDetails` |


---

# Ozon — 447 эндпоинтов (по разделам)

### AnalyticsAPI — 3 (используем 3)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/analytics/stocks | Получить аналитику по остаткам | ✅ `getAnalyticsStocks` |
| `POST` /v1/analytics/turnover/stocks | Оборачиваемость товара | ✅ `getTurnover` |
| `POST` /v2/analytics/stock_on_warehouses | Отчёт по остаткам и товарам | ✅ `getWarehouseStocks` |

### APIkey — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/roles | Получить список ролей и методов по API-ключу |  |

### BarcodeAPI — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/barcode/add | Привязать штрихкод к товару |  |
| `POST` /v1/barcode/generate | Создать штрихкод для товара |  |

### BetaMethod — 13 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/analytics/manage/stocks | Управление остатками |  |
| `POST` /v1/finance/accrual/by-day | Получить начисления за день |  |
| `POST` /v1/finance/accrual/postings | Получить начисления по отправлениям |  |
| `POST` /v1/finance/accrual/types | Получить справочник начислений |  |
| `POST` /v1/finance/balance | Получить отчёт о балансе | ✅ `getBalance` |
| `POST` /v1/product/stairway-discount/by-quantity/get | Получить информацию о скидке от количества |  |
| `POST` /v1/product/stairway-discount/by-quantity/set | Управлять скидкой от количества |  |
| `POST` /v1/product/visibility/info | Получить информацию о видимости товара |  |
| `POST` /v1/product/visibility/set | Настроить видимость товара на витрине Ozon и Ozon Селект |  |
| `POST` /v1/removal/from-stock/list | Отчёт по вывозу и утилизации со стока FBO |  |
| `POST` /v1/removal/from-supply/list | Отчёт по вывозу и утилизации с поставки FBO |  |
| `POST` /v2/actions/discounts-task/list | Получить список заявок на скидку |  |
| `POST` /v2/posting/digital/list | Получить список отправлений |  |

### BrandAPI — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/brand/company-certification/list | Список сертифицируемых брендов |  |

### CancellationAPI — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/conditional-cancellation/approve | Подтвердить заявку на отмену rFBS |  |
| `POST` /v2/conditional-cancellation/list | Получить список заявок на отмену rFBS |  |
| `POST` /v2/conditional-cancellation/reject | Отклонить заявку на отмену rFBS |  |

### CancelReasonAPI — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/cancel-reason/list | Причины отмены отправлений |  |
| `POST` /v1/cancel-reason/list-by-order | Причины отмены заказа |  |
| `POST` /v1/cancel-reason/list-by-posting | Причины отмены отправления |  |

### CarriageAPI — 13 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/carriage/container/approve | Подтвердить состав грузоместа |  |
| `POST` /v1/carriage/container/cancel | Отменить грузоместо |  |
| `POST` /v1/carriage/container/create | Создать грузоместо |  |
| `POST` /v1/carriage/container/document/get | Получить документы по грузоместам — ТрН и лист отгрузки |  |
| `POST` /v1/carriage/container/fill | Наполнить грузоместо отправлениями |  |
| `POST` /v1/carriage/container/get | Получить информацию о грузоместах |  |
| `POST` /v1/carriage/container/label/get | Получить этикетку по грузоместам |  |
| `POST` /v1/carriage/container/list | Получить список грузомест |  |
| `POST` /v1/carriage/container/place-into | Разместить коробки на палете |  |
| `POST` /v1/carriage/container/remove-from | Убрать коробки с палеты |  |
| `POST` /v1/carriage/container/remove-postings | Убрать отправления из грузоместа |  |
| `POST` /v1/carriage/container/status/get | Получить статус грузомест FBS |  |
| `POST` /v1/carriage/container/task/info | Получить статус задачи грузового места |  |

### CategoryAPI — 4 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/description-category/attribute | Список характеристик категории | ✅ `getCategoryAttributes` |
| `POST` /v1/description-category/attribute/values | Справочник значений характеристики |  |
| `POST` /v1/description-category/attribute/values/search | Поиск по справочным значениям характеристики |  |
| `POST` /v1/description-category/tree | Дерево категорий и типов товаров | ✅ `getCategories` |

### CertificationAPI — 15 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v1/product/certificate/accordance-types | Список типов соответствия требованиям (версия 1) |  |
| `POST` /v1/product/certificate/bind | Привязать сертификат к товару |  |
| `POST` /v1/product/certificate/create | Добавить сертификаты для товаров |  |
| `POST` /v1/product/certificate/delete | Удалить сертификат |  |
| `POST` /v1/product/certificate/info | Информация о сертификате |  |
| `POST` /v1/product/certificate/list | Список сертификатов |  |
| `POST` /v1/product/certificate/product_status/list | Список возможных статусов товаров |  |
| `POST` /v1/product/certificate/products/list | Список товаров, привязанных к сертификату |  |
| `POST` /v1/product/certificate/rejection_reasons/list | Возможные причины отклонения сертификата |  |
| `POST` /v1/product/certificate/status/list | Возможные статусы сертификатов |  |
| `GET` /v1/product/certificate/types | Справочник типов документов |  |
| `POST` /v1/product/certificate/unbind | Отвязать товар от сертификата |  |
| `POST` /v1/product/certification/list | Список сертифицируемых категорий |  |
| `GET` /v2/product/certificate/accordance-types/list | Список типов соответствия требованиям (версия 2) |  |
| `POST` /v2/product/certification/list | Список сертифицируемых категорий |  |

### ChatAPI — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/chat/send/file | Отправить файл |  |
| `POST` /v2/chat/list | Список чатов |  |
| `POST` /v3/chat/history | История чата |  |
| `POST` /v3/chat/list | Список чатов |  |

### DeliveryAPI — 5 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/delivery/check | Проверить доступность доставки для покупателя |  |
| `POST` /v1/delivery/map | Отрисовать точки на карте |  |
| `POST` /v1/delivery/point/info | Получить информацию о точке самовывоза |  |
| `POST` /v1/delivery/point/list | Получить список точек самовывоза |  |
| `POST` /v2/delivery/checkout | Получить доступные варианты доставки |  |

### DeliveryFBP — 11 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/act-from/create | Сгенерировать акт приёмки |  |
| `POST` /v1/fbp/act-from/get | Получить статус генерации акта приёмки |  |
| `POST` /v1/fbp/act-to/create | Сгенерировать транспортную накладную |  |
| `POST` /v1/fbp/act-to/get | Получить статус генерации транспортной накладной |  |
| `POST` /v1/fbp/archive/get | Получить информацию о завершённой поставке |  |
| `POST` /v1/fbp/archive/list | Получить список завершённых поставок |  |
| `POST` /v1/fbp/label/create | Cоздать задание на генерацию этикеток |  |
| `POST` /v1/fbp/label/get | Получить статус задания на генерацию этикеток |  |
| `POST` /v1/fbp/order/get | Получить информацию о конкретной поставке |  |
| `POST` /v1/fbp/order/list | Получить список поставок |  |
| `POST` /v1/posting/fbp/list | Получить список отправлений |  |

### DeliveryFBPDraft — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/draft/get | Получить информацию о черновике поставки |  |
| `POST` /v1/fbp/draft/list | Список черновиков поставки |  |
| `POST` /v1/fbp/warehouse/list | Получить список партнёрских складов |  |

### DeliveryFBS — 27 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/assembly/carriage/posting/list | Получить список отправлений в отгрузке |  |
| `POST` /v1/assembly/carriage/product/list | Получить список товаров в отгрузке |  |
| `POST` /v1/assembly/fbs/posting/list | Получить список отправлений |  |
| `POST` /v1/assembly/fbs/product/list | Получить список товаров в отправлениях |  |
| `POST` /v1/carriage/act-discrepancy/pdf | Получить акт о расхождениях по отгрузке FBS |  |
| `POST` /v1/carriage/approve | Подтверждение отгрузки |  |
| `POST` /v1/carriage/cancel | Удаление отгрузки |  |
| `POST` /v1/carriage/create | Создание отгрузки |  |
| `POST` /v1/carriage/delivery/list | Список методов доставки и отгрузок |  |
| `POST` /v1/carriage/ettn/status | Получить статус проверки электронной ТТН на прослеживаемой перевозке FBS |  |
| `POST` /v1/carriage/get | Информация о перевозке |  |
| `POST` /v1/carriage/set-postings | Изменение состава отгрузки |  |
| `POST` /v1/posting/carriage-available/list | Список доступных перевозок |  |
| `POST` /v1/posting/fbs/product/traceable/attribute | Получить список незаполненных атрибутов для прослеживаемых товаров |  |
| `POST` /v1/posting/fbs/split | Разделить заказ на отправления без сборки |  |
| `POST` /v1/posting/fbs/traceable/split | Разделить отправление с прослеживаемыми товарами |  |
| `POST` /v2/carriage/delivery/list | Список методов доставки и отгрузок |  |
| `POST` /v2/posting/fbs/act/check-status | Статус отгрузки и документов |  |
| `POST` /v2/posting/fbs/act/create | Подтвердить отгрузку и создать документы |  |
| `POST` /v2/posting/fbs/act/get-barcode | Штрихкод для отгрузки отправления |  |
| `POST` /v2/posting/fbs/act/get-barcode/text | Значение штрихкода для отгрузки отправления |  |
| `POST` /v2/posting/fbs/act/get-container-labels | Этикетки для грузового места |  |
| `POST` /v2/posting/fbs/act/get-pdf | Получить PDF c документами |  |
| `POST` /v2/posting/fbs/act/get-postings | Список отправлений в акте |  |
| `POST` /v2/posting/fbs/act/list | Список актов по отгрузкам |  |
| `POST` /v2/posting/fbs/digital/act/check-status ⚠️deprecated | Статус формирования накладной |  |
| `POST` /v2/posting/fbs/digital/act/get-pdf ⚠️deprecated | Получить лист отгрузки по перевозке |  |

### DeliveryrFBS — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/posting/cutoff/set | Уточнить дату отгрузки отправления |  |
| `POST` /v1/posting/fbs/timeslot/change-restrictions | Доступные даты для переноса доставки |  |
| `POST` /v1/posting/fbs/timeslot/set | Перенести дату доставки |  |
| `POST` /v2/fbs/posting/delivered | Изменить статус на «Доставлено» |  |
| `POST` /v2/fbs/posting/delivering | Изменить статус на «Доставляется» |  |
| `POST` /v2/fbs/posting/last-mile | Изменить статус на «Последняя миля» |  |
| `POST` /v2/fbs/posting/tracking-number/set | Добавить трек-номера |  |

### Digital — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/posting/digital/codes/upload | Загрузить коды цифровых товаров для отправления |  |
| `POST` /v1/posting/digital/list ⚠️deprecated | Получить список отправлений |  |
| `POST` /v1/product/digital/stocks/import | Обновить количество цифровых товаров |  |

### DraftDirectFBP — 10 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/draft/direct/create | Создать черновик заявки на поставку без указания способа доставки |  |
| `POST` /v1/fbp/draft/direct/delete | Удалить черновик заявки на поставку |  |
| `POST` /v1/fbp/draft/direct/product/validate | Проверить список товаров для склада партнёра |  |
| `POST` /v1/fbp/draft/direct/registrate | Перевести черновик в действующую поставку |  |
| `POST` /v1/fbp/draft/direct/seller-dlv/create | Создать черновик с доставкой силами продавца |  |
| `POST` /v1/fbp/draft/direct/seller-dlv/edit | Обновить информацию о доставке силами продавца в черновике |  |
| `POST` /v1/fbp/draft/direct/timeslot/edit | Отредактировать таймслот в черновике |  |
| `POST` /v1/fbp/draft/direct/timeslot/get | Получить список таймслотов для прямой поставки |  |
| `POST` /v1/fbp/draft/direct/tpl-dlv/create | Создать черновик заявки на доставку сторонней транспортной компанией |  |
| `POST` /v1/fbp/draft/direct/tpl-dlv/edit | Редактировать черновик поставки со способом доставки сторонней транспортной компанией |  |

### DraftDropOffFBP — 8 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/draft/drop-off/create | Создать черновик для доставки в drop-off пункт |  |
| `POST` /v1/fbp/draft/drop-off/delete | Удалить черновик для доставки в drop-off пункт |  |
| `POST` /v1/fbp/draft/drop-off/dlv/edit | Отредактировать детали доставки для drop-off черновика |  |
| `POST` /v1/fbp/draft/drop-off/point/list | Получить список drop-off пунктов в провинции |  |
| `POST` /v1/fbp/draft/drop-off/point/timetable | Получить расписание работы drop-off пункта |  |
| `POST` /v1/fbp/draft/drop-off/product/validate | Проверить список товаров, которые склад партнёра может принять |  |
| `POST` /v1/fbp/draft/drop-off/province/list | Получить список провинций |  |
| `POST` /v1/fbp/draft/drop-off/registrate | Перевести черновик в действующую поставку |  |

### DraftPickupFBP — 5 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/draft/pick-up/create | Создать черновик заявки на pick-up поставку |  |
| `POST` /v1/fbp/draft/pick-up/delete | Отменить черновик заявки на pick-up поставку |  |
| `POST` /v1/fbp/draft/pick-up/dlv/edit | Изменить черновик заявки на pick-up поставку |  |
| `POST` /v1/fbp/draft/pick-up/product/validate | Провалидировать список товаров для pick-up поставки |  |
| `POST` /v1/fbp/draft/pick-up/registrate | Перевести черновик в действующую поставку |  |

### FBO — 15 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/posting/fbo/cancel-reason/list | Причины отмены отправлений по схеме FBO |  |
| `GET` /v1/supplier/available_warehouses | Загруженность складов Ozon |  |
| `POST` /v1/supply-order/bundle | Состав поставки или заявки на поставку |  |
| `POST` /v1/supply-order/details | Получить подробную информацию о заявке на поставку |  |
| `POST` /v1/supply-order/pass/create | Указать данные о водителе и автомобиле |  |
| `POST` /v1/supply-order/pass/status | Статус ввода данных о водителе и автомобиле |  |
| `POST` /v1/supply-order/status/counter | Количество заявок по статусам |  |
| `POST` /v1/supply-order/timeslot/get | Интервалы поставки |  |
| `POST` /v1/supply-order/timeslot/status | Статус интервала поставки |  |
| `POST` /v1/supply-order/timeslot/update | Обновить интервал поставки |  |
| `POST` /v2/posting/fbo/get | Информация об отправлении |  |
| `POST` /v2/posting/fbo/list ⚠️deprecated | Список отправлений | ✅ `getFboPostings` |
| `POST` /v3/posting/fbo/list | Получить список отправлений |  |
| `POST` /v3/supply-order/get | Информация о заявке на поставку |  |
| `POST` /v3/supply-order/list | Список заявок на поставку на склад Ozon |  |

### FboPostingAPI — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/posting/cancel | Отменить отправление из заказа |  |
| `POST` /v1/posting/cancel/status | Проверить статус отмены отправления |  |
| `POST` /v1/posting/marks | Получить маркировки экземпляров из отправления |  |

### FboSupplyRequest — 30 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/cargoes-label/create | Сгенерировать этикетки для грузомест |  |
| `GET` /v1/cargoes-label/file/{file_guid} | Получить PDF с этикетками грузовых мест |  |
| `POST` /v1/cargoes-label/get | Получить идентификатор этикетки для грузомест |  |
| `POST` /v1/cargoes/create | Установка грузомест |  |
| `POST` /v1/cargoes/delete | Удалить грузоместо в заявке на поставку |  |
| `POST` /v1/cargoes/delete/status | Информация о статусе удаления грузоместа |  |
| `POST` /v1/cargoes/get | Получить информацию о грузоместах |  |
| `POST` /v1/cargoes/rules/get | Чек-лист по установке грузомест FBO |  |
| `POST` /v1/cluster/list | Информация о кластерах и их складах |  |
| `POST` /v1/draft/create | Создать черновик заявки на поставку |  |
| `POST` /v1/draft/create/info | Информация о черновике заявки на поставку |  |
| `POST` /v1/draft/crossdock/create | Создать черновик заявки на поставку кросс-докингом |  |
| `POST` /v1/draft/direct/create | Создать черновик заявки на прямую поставку |  |
| `POST` /v1/draft/multi-cluster/create | Создать черновик заявки на поставку для нескольких кластеров |  |
| `POST` /v1/draft/supply/create | Создать заявку на поставку по черновику |  |
| `POST` /v1/draft/supply/create/status | Информация о создании заявки на поставку |  |
| `POST` /v1/draft/timeslot/info | Доступные таймслоты |  |
| `POST` /v1/supply-order/cancel | Отменить заявку на поставку |  |
| `POST` /v1/supply-order/cancel/status | Получить статус отмены заявки на поставку |  |
| `POST` /v1/supply-order/content/update | Редактирование товарного состава |  |
| `POST` /v1/supply-order/content/update/status | Информация о статусе редактирования товарного состава |  |
| `POST` /v1/supply-order/content/update/validation | Проверить новый товарный состав |  |
| `POST` /v1/warehouse/fbo/list | Поиск точек для отгрузки поставки |  |
| `POST` /v1/warehouse/fbo/seller/list | Получить список складов продавца |  |
| `POST` /v2/cargoes/create/info | Получить информацию по установке грузомест |  |
| `POST` /v2/cluster/list | Получить информацию о макролокальных кластерах |  |
| `POST` /v2/draft/create/info | Получить информацию о черновике заявки на поставку |  |
| `POST` /v2/draft/supply/create | Создать заявку на поставку по черновику |  |
| `POST` /v2/draft/supply/create/status | Получить информацию о создании заявки на поставку |  |
| `POST` /v2/draft/timeslot/info | Получить список доступных таймслотов |  |

### FBOWarehouse — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/warehouse/ozon/list | Получить список складов Ozon |  |

### FBS — 23 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/posting/fbs/cancel-reason | Причины отмены отправления |  |
| `POST` /v1/posting/fbs/package-label/create | Создать задание на выгрузку этикеток |  |
| `POST` /v1/posting/fbs/package-label/get | Получить файл с этикетками |  |
| `POST` /v1/posting/fbs/pick-up-code/verify | Проверить код курьера |  |
| `POST` /v1/posting/fbs/restrictions | Получить ограничения пункта приёма |  |
| `POST` /v1/posting/global/etgb | Таможенные декларации ETGB |  |
| `POST` /v1/posting/unpaid-legal/product/list | Список неоплаченных товаров, заказанных юридическими лицами |  |
| `POST` /v2/posting/fbs/arbitration | Открыть спор по отправлению |  |
| `POST` /v2/posting/fbs/awaiting-delivery | Передать отправление к отгрузке |  |
| `POST` /v2/posting/fbs/cancel | Отменить отправление |  |
| `POST` /v2/posting/fbs/cancel-reason/list | Причины отмены отправлений |  |
| `POST` /v2/posting/fbs/get-by-barcode | Получить информацию об отправлении по штрихкоду |  |
| `POST` /v2/posting/fbs/package-label | Напечатать этикетку |  |
| `POST` /v2/posting/fbs/package-label/create | Создать задание на формирование этикеток |  |
| `POST` /v2/posting/fbs/product/cancel | Отменить отправку некоторых товаров в отправлении |  |
| `POST` /v2/posting/fbs/product/country/list | Список доступных стран-изготовителей |  |
| `POST` /v2/posting/fbs/product/country/set | Добавить информацию о стране-изготовителе товара |  |
| `POST` /v3/posting/fbs/get | Получить информацию об отправлении по идентификатору |  |
| `POST` /v3/posting/fbs/list ⚠️deprecated | Список отправлений | ✅ `getOrders` |
| `POST` /v3/posting/fbs/unfulfilled/list ⚠️deprecated | Список необработанных отправлений |  |
| `POST` /v3/posting/multiboxqty/set | Указать количество коробок для многокоробочных отправлений |  |
| `POST` /v4/posting/fbs/list | Получить список отправлений |  |
| `POST` /v4/posting/fbs/unfulfilled/list | Получить список необработанных отправлений |  |

### FBS&rFBSMarks — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbs/posting/product/exemplar/update | Обновить данные экземпляров |  |
| `POST` /v4/posting/fbs/ship | Собрать заказ (версия 4) |  |
| `POST` /v4/posting/fbs/ship/package | Частичная сборка отправления (версия 4) |  |
| `POST` /v5/fbs/posting/product/exemplar/status | Получить статус добавления экземпляров |  |
| `POST` /v5/fbs/posting/product/exemplar/validate | Валидация кодов маркировки |  |
| `POST` /v6/fbs/posting/product/exemplar/create-or-get | Получить данные созданных экземпляров |  |
| `POST` /v6/fbs/posting/product/exemplar/set | Проверить и сохранить данные экземпляров |  |

### FBSWarehouseSetup — 17 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/warehouse/fbs/create | Создать склад |  |
| `POST` /v1/warehouse/fbs/create/drop-off/list | Получить список drop-off пунктов для создания склада |  |
| `POST` /v1/warehouse/fbs/create/drop-off/timeslot/list | Получить список таймслотов для создания склада с отгрузкой drop-off |  |
| `POST` /v1/warehouse/fbs/create/pick-up/timeslot/list | Получить список таймслотов для создания склада с отгрузкой pick-up |  |
| `POST` /v1/warehouse/fbs/create/return-point/list | Получить список пунктов возврата для создания склада |  |
| `POST` /v1/warehouse/fbs/first-mile/update | Обновить первую милю |  |
| `POST` /v1/warehouse/fbs/pickup/courier/cancel | Отменить вызов курьера на забор отгрузки pick-up |  |
| `POST` /v1/warehouse/fbs/pickup/courier/create | Создать вызов курьера на забор отгрузки pick-up |  |
| `POST` /v1/warehouse/fbs/pickup/history/list | Получить историю отгрузок курьерам |  |
| `POST` /v1/warehouse/fbs/pickup/planning/list | Получить список складов для планирования отгрузок курьеру |  |
| `POST` /v1/warehouse/fbs/return-mile/check | Проверить необходимость установки возвратной мили на склад |  |
| `POST` /v1/warehouse/fbs/return-mile/info | Получить информацию о возвратной миле |  |
| `POST` /v1/warehouse/fbs/update | Обновить склад |  |
| `POST` /v1/warehouse/fbs/update/drop-off/list | Получить список drop-off пунктов для изменения информации склада |  |
| `POST` /v1/warehouse/fbs/update/drop-off/timeslot/list | Получить список таймслотов для обновления склада с отгрузкой drop-off |  |
| `POST` /v1/warehouse/fbs/update/pick-up/timeslot/list | Получить список таймслотов для обновления склада с отгрузкой pick-up |  |
| `POST` /v1/warehouse/fbs/update/return-point/list | Получить список пунктов возврата для обновления склада |  |

### FinanceAPI — 10 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/finance/compensation | Отчёт о компенсациях |  |
| `POST` /v1/finance/decompensation | Отчёт о декомпенсациях |  |
| `POST` /v1/finance/document-b2b-sales | Реестр продаж юридическим лицам |  |
| `POST` /v1/finance/document-b2b-sales/json | Реестр продаж юридическим лицам в JSON-формате |  |
| `POST` /v1/finance/mutual-settlement | Отчёт о взаиморасчётах |  |
| `POST` /v1/finance/products/buyout | Отчёт о выкупленных товарах |  |
| `POST` /v1/finance/realization/posting | Позаказный отчёт о реализации товаров |  |
| `POST` /v2/finance/realization | Отчёт о реализации товаров (версия 2) | ✅ `getRealization` |
| `POST` /v3/finance/transaction/list | Список транзакций | ✅ `getTransactions` |
| `POST` /v3/finance/transaction/totals | Суммы транзакций |  |

### Notification — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/notification/check | Проверить URL-адрес для уведомлений |  |
| `POST` /v1/notification/delete | Удалить URL-адрес для уведомлений |  |
| `POST` /v1/notification/enable | Включить или выключить уведомления на URL-адрес |  |
| `POST` /v1/notification/list | Получить информацию по подключённым URL-адресам |  |
| `POST` /v1/notification/push-type/list | Получить типы пуш-уведомлений |  |
| `POST` /v1/notification/set | Подключить URL-адрес для уведомлений |  |
| `POST` /v1/notification/update | Изменить URL-адрес для уведомлений |  |

### OrderAPI — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/order/cancel | Отменить заказ |  |
| `POST` /v1/order/cancel/check | Проверить возможность отмены заказа |  |
| `POST` /v1/order/cancel/status | Получить статус отмены заказа |  |
| `POST` /v2/order/create | Создать заказ |  |

### OrderDirectFBP — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/order/direct/cancel | Отменить поставку |  |
| `POST` /v1/fbp/order/direct/seller-dlv/edit | Обновить информацию о доставке силами продавца |  |
| `POST` /v1/fbp/order/direct/timeslot/edit | Отредактировать таймслот в заявке на поставку |  |
| `POST` /v1/fbp/order/direct/timeslot/list | Получить список таймслотов для поставки |  |

### OrderDropOffFBP — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/order/drop-off/cancel | Отменить поставку drop-off |  |
| `POST` /v1/fbp/order/drop-off/dlv/edit | Отредактировать информацию о поставке на drop-off пункт |  |
| `POST` /v1/fbp/order/drop-off/timetable | Получить график работы drop-off пункта |  |

### OrderPickupFBP — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/fbp/order/pick-up/cancel | Отменить pick-up поставку |  |
| `POST` /v1/fbp/order/pick-up/dlv/edit | Изменить данные о точке забора |  |

### Pass — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/carriage/pass/create | Создать пропуск |  |
| `POST` /v1/carriage/pass/delete | Удалить пропуск |  |
| `POST` /v1/carriage/pass/update | Обновить пропуск |  |
| `POST` /v1/pass/list | Список пропусков |  |
| `POST` /v1/return/pass/create | Создать пропуск для возврата |  |
| `POST` /v1/return/pass/delete | Удалить пропуск для возврата |  |
| `POST` /v1/return/pass/update | Обновить пропуск для возврата |  |

### PolygonAPI — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/polygon/bind | Свяжите метод доставки с полигоном доставки |  |
| `POST` /v1/polygon/create | Создайте полигон доставки |  |
| `POST` /v1/polygon/delete | Удалить полигон из области доставки |  |
| `POST` /v1/polygon/list | Получить список установленных полигонов на метод доставки |  |
| `POST` /v1/polygon/time/coordinates/update | Обновить координаты полигона доставки |  |
| `POST` /v1/polygon/time/set | Установить новое время доставки в полигоне |  |
| `POST` /v2/polygon/bind | Связать метод доставки с полигоном |  |

### Premium — 10 (используем 5)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/analytics/data | Данные аналитики | ✅ `getAnalyticsData` |
| `POST` /v1/analytics/product-queries | Получить информацию о запросах моих товаров | ✅ `getProductQueries` |
| `POST` /v1/analytics/product-queries/details | Получить детализацию запросов по товару | ✅ `getProductQueriesDetails` |
| `POST` /v1/chat/send/message | Отправить сообщение |  |
| `POST` /v1/chat/start | Создать новый чат |  |
| `POST` /v1/finance/realization/by-day | Отчёт о реализации товаров за день |  |
| `POST` /v1/product/prices/details | Получить подробную информацию о ценах товаров |  |
| `POST` /v1/search-queries/text | Получить список поисковых запросов по тексту | ✅ `getSearchQueriesByText` |
| `POST` /v1/search-queries/top | Получить список популярных поисковых запросов | ✅ `getSearchQueriesTop` |
| `POST` /v2/chat/read | Отметить сообщения как прочитанные |  |

### Prices&StocksAPI — 11 (используем 3)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/product/action/timer/status | Получить статус установленного таймера |  |
| `POST` /v1/product/action/timer/update | Обновление таймера актуальности минимальной цены |  |
| `POST` /v1/product/import/prices | Обновить цену | ✅ `updatePrices` |
| `POST` /v1/product/info/discounted | Узнать информацию об уценке и основном товаре по SKU уценённого товара |  |
| `POST` /v1/product/info/stocks-by-warehouse/fbs | Информация об остатках на складах продавца (FBS и rFBS) |  |
| `POST` /v1/product/info/warehouse/stocks | Получить информацию по остаткам на складе FBS и rFBS |  |
| `POST` /v1/product/update/discount | Установить скидку на уценённый товар |  |
| `POST` /v2/product/info/stocks-by-warehouse/fbs | Получить информацию об остатках на складах продавца |  |
| `POST` /v2/products/stocks | Обновить количество товаров на складах | ✅ `updateStocks` |
| `POST` /v4/product/info/stocks | Информация о количестве товаров | ✅ `getStocks` |
| `POST` /v5/product/info/prices | Получить информацию о цене товара |  |

### PricingStrategyAPI — 12 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/pricing-strategy/competitors/list | Список конкурентов | ✅ `getCompetitorsList` |
| `POST` /v1/pricing-strategy/create | Создать стратегию |  |
| `POST` /v1/pricing-strategy/delete | Удалить стратегию |  |
| `POST` /v1/pricing-strategy/info | Информация о стратегии |  |
| `POST` /v1/pricing-strategy/list | Список стратегий |  |
| `POST` /v1/pricing-strategy/product/info | Цена товара у конкурента | ✅ `getCompetitorProductInfo` |
| `POST` /v1/pricing-strategy/products/add | Добавить товары в стратегию |  |
| `POST` /v1/pricing-strategy/products/delete | Удалить товары из стратегии |  |
| `POST` /v1/pricing-strategy/products/list | Список товаров в стратегии |  |
| `POST` /v1/pricing-strategy/status | Изменить статус стратегии |  |
| `POST` /v1/pricing-strategy/strategy-ids-by-product-ids | Список идентификаторов стратегий |  |
| `POST` /v1/pricing-strategy/update | Обновить стратегию |  |

### ProductAPI — 20 (используем 4)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/product/archive | Перенести товар в архив | ✅ `archiveProducts` |
| `POST` /v1/product/attributes/update | Обновить характеристики товара |  |
| `POST` /v1/product/import-by-sku | Создать товар по SKU |  |
| `POST` /v1/product/import/info | Узнать статус добавления или обновления товара |  |
| `POST` /v1/product/info/description | Получить описание товара |  |
| `POST` /v1/product/info/subscription | Количество подписавшихся на товар пользователей |  |
| `POST` /v1/product/info/wrong-volume | Список товаров с некорректными ОВХ |  |
| `POST` /v1/product/pictures/import | Загрузить или обновить изображения товара |  |
| `POST` /v1/product/placement-zone/info | Получить зоны размещения товаров по SKU перед поставкой |  |
| `POST` /v1/product/rating-by-sku | Получить контент-рейтинг товаров по SKU |  |
| `POST` /v1/product/related-sku/get | Получить связанные SKU |  |
| `POST` /v1/product/unarchive | Вернуть товар из архива |  |
| `POST` /v1/product/update/offer-id | Изменить артикулы товаров из системы продавца |  |
| `POST` /v2/product/pictures/info | Получить изображения товаров |  |
| `POST` /v2/products/delete | Удалить товар без SKU из архива |  |
| `POST` /v3/product/import | Создать или обновить товар |  |
| `POST` /v3/product/info/list | Получить информацию о товарах по идентификаторам | ✅ `getProductDetails` |
| `POST` /v3/product/list | Список товаров | ✅ `getProducts` |
| `POST` /v4/product/info/attributes | Получить описание характеристик товара |  |
| `POST` /v4/product/info/limit | Лимиты на ассортимент, создание и обновление товаров | ✅ `validateKey` |

### Promos — 8 (используем 3)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v1/actions | Список акций | ✅ `getPromotions` |
| `POST` /v1/actions/candidates | Список доступных для акции товаров | ✅ `getPromotionCandidates` |
| `POST` /v1/actions/discounts-task/approve | Согласовать заявку на скидку |  |
| `POST` /v1/actions/discounts-task/decline | Отклонить заявку на скидку |  |
| `POST` /v1/actions/discounts-task/list | Список заявок на скидку |  |
| `POST` /v1/actions/products | Список участвующих в акции товаров | ✅ `getPromotionProducts` |
| `POST` /v1/actions/products/activate | Добавить товар в акцию |  |
| `POST` /v1/actions/products/deactivate | Удалить товары из акции |  |

### PromosBeta — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/actions/auto-add/products/candidates | Получить список доступных товаров для автодобавления в акцию |  |
| `POST` /v1/actions/auto-add/products/delete | Удалить товары из автодобавления в акцию |  |
| `POST` /v1/actions/auto-add/products/list | Получить список товаров из автодобавления в акцию |  |
| `POST` /v1/actions/auto-add/products/update | Добавить или обновить товары в автодобавлении в акцию |  |

### Quants — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/product/quant/info | Информация об эконом-товаре |  |
| `POST` /v1/product/quant/list | Список эконом-товаров |  |

### Questions&Answers — 8 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/question/answer/create | Создать ответ на вопрос |  |
| `POST` /v1/question/answer/delete | Удалить ответ на вопрос |  |
| `POST` /v1/question/answer/list | Список ответов на вопрос |  |
| `POST` /v1/question/change-status | Изменить статус вопросов |  |
| `POST` /v1/question/count | Количество вопросов по статусам |  |
| `POST` /v1/question/info | Информация о вопросе |  |
| `POST` /v1/question/list | Список вопросов | ✅ `getQuestions` |
| `POST` /v1/question/top-sku | Товары с наибольшим количеством вопросов |  |

### Receipt — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/receipts/get | Получить чек в формате PDF |  |
| `POST` /v1/receipts/seller/list | Получить список чеков продавца |  |
| `POST` /v1/receipts/upload | Загрузить чек |  |

### ReportAPI — 11 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/finance/cash-flow-statement/list | Финансовый отчёт | ✅ `getCashFlow` |
| `POST` /v1/report/discounted/create | Отчёт об уценённых товарах |  |
| `POST` /v1/report/info | Информация об отчёте |  |
| `POST` /v1/report/list | Список отчётов |  |
| `POST` /v1/report/marked-products-sales/create | Сгенерировать отчёт по продажам товаров с маркировкой |  |
| `POST` /v1/report/placement/by-products/create | Получить отчёт о стоимости размещения по товарам |  |
| `POST` /v1/report/placement/by-supplies/create | Получить отчёт о стоимости размещения по поставкам |  |
| `POST` /v1/report/postings/create | Отчёт об отправлениях |  |
| `POST` /v1/report/products/create | Отчёт по товарам |  |
| `POST` /v1/report/warehouse/stock | Отчёт об остатках на FBS-складе |  |
| `POST` /v2/report/returns/create | Отчёт о возвратах |  |

### ReturnAPI — 8 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/return/giveout/barcode | Значение штрихкода для возвратных отгрузок |  |
| `POST` /v1/return/giveout/barcode-reset | Сгенерировать новый штрихкод |  |
| `POST` /v1/return/giveout/get-pdf | Штрихкод для получения возвратной отгрузки в формате PDF |  |
| `POST` /v1/return/giveout/get-png | Штрихкод для получения возвратной отгрузки в формате PNG |  |
| `POST` /v1/return/giveout/info | Информация о возвратной отгрузке |  |
| `POST` /v1/return/giveout/is-enabled | Проверить возможность получения возвратных отгрузок по штрихкоду |  |
| `POST` /v1/return/giveout/list | Список возвратных отгрузок |  |
| `POST` /v1/returns/company/fbs/info | Количество возвратов FBS |  |

### ReturnsAPI — 4 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/returns/list | Информация о возвратах FBO и FBS | ✅ `getReturns` |
| `POST` /v1/returns/settings/utilization/history | Получить историю изменений автоутилизации |  |
| `POST` /v1/returns/settings/utilization/info | Получить настройки автоутилизации |  |
| `POST` /v1/returns/settings/utilization/update | Обновить настройки автоутилизации |  |

### ReviewAPI — 12 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/review/change-status ⚠️deprecated | Изменить статус отзывов |  |
| `POST` /v1/review/comment/create | Оставить комментарий на отзыв | ✅ `answerReview` |
| `POST` /v1/review/comment/delete ⚠️deprecated | Удалить комментарий на отзыв |  |
| `POST` /v1/review/comment/list | Получить список комментариев на отзыв |  |
| `POST` /v1/review/count ⚠️deprecated | Количество отзывов по статусам |  |
| `POST` /v1/review/info ⚠️deprecated | Получить информацию об отзыве |  |
| `POST` /v1/review/list ⚠️deprecated | Получить список отзывов | ✅ `getReviews` |
| `POST` /v2/review/change-status | Изменить статус отзывов |  |
| `POST` /v2/review/comment/delete | Удалить комментарий на отзыв |  |
| `POST` /v2/review/count | Получить количество отзывов по статусам |  |
| `POST` /v2/review/info | Получить информацию по отзыву |  |
| `POST` /v2/review/list | Получить список отзывов |  |

### RFBSReturnsAPI — 8 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/returns/rfbs/action/set | Передать доступные действия для rFBS возвратов |  |
| `POST` /v2/returns/rfbs/compensate | Вернуть часть стоимости товара |  |
| `POST` /v2/returns/rfbs/get | Информация о заявке на возврат |  |
| `POST` /v2/returns/rfbs/list | Список заявок на возврат |  |
| `POST` /v2/returns/rfbs/receive-return | Подтвердить получение товара на проверку |  |
| `POST` /v2/returns/rfbs/reject | Отклонить заявку на возврат |  |
| `POST` /v2/returns/rfbs/return-money | Вернуть деньги покупателю |  |
| `POST` /v2/returns/rfbs/verify | Одобрить заявку на возврат |  |

### rFBSWarehouseSetup — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/warehouse/erfbs/aggregator/create | Создать склад с методом доставки «Партнёры Ozon» |  |
| `POST` /v1/warehouse/erfbs/aggregator/delivery-method/update | Обновить метод доставки «Партнёры Ozon» |  |
| `POST` /v1/warehouse/erfbs/non-integrated/create | Создать склад с методом доставки «Вы или сторонняя служба» |  |
| `POST` /v1/warehouse/erfbs/non-integrated/delivery-method/update | Обновить метод доставки «Вы или сторонняя служба» |  |
| `POST` /v1/warehouse/erfbs/update | Обновить склад |  |
| `POST` /v1/warehouse/rfbs/pause | Поставить rFBS-склад на паузу |  |
| `POST` /v1/warehouse/rfbs/unpause | Снять rFBS-склад с паузы |  |

### SellerActions — 18 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/seller-actions/archive | Перенести акцию в архив |  |
| `POST` /v1/seller-actions/change-activity | Включить или выключить акцию |  |
| `POST` /v1/seller-actions/create/discount | Создать акцию с механикой «Скидка» |  |
| `POST` /v1/seller-actions/create/discount-with-condition | Создать акцию с механикой «Скидка от суммы заказа» |  |
| `POST` /v1/seller-actions/create/installment | Создать акцию с механикой «Беспроцентная рассрочка» |  |
| `POST` /v1/seller-actions/create/multi-level-discount | Создать акцию с механикой «Многоуровневая скидка от суммы» |  |
| `POST` /v1/seller-actions/create/voucher | Создать акцию с механикой «Скидка по промокоду» |  |
| `POST` /v1/seller-actions/list | Получить список акций |  |
| `POST` /v1/seller-actions/products/add | Добавить товары в акцию |  |
| `POST` /v1/seller-actions/products/candidates | Получить список доступных для акции товаров |  |
| `POST` /v1/seller-actions/products/delete | Удалить товары из акции |  |
| `POST` /v1/seller-actions/products/list | Получить список участвующих в акции товаров |  |
| `POST` /v1/seller-actions/update/discount | Обновить акцию с механикой «Скидка» |  |
| `POST` /v1/seller-actions/update/discount-with-condition | Обновить акцию с механикой «Скидка от суммы заказа» |  |
| `POST` /v1/seller-actions/update/installment | Обновить акцию с механикой «Беспроцентная рассрочка» |  |
| `POST` /v1/seller-actions/update/multi-level-discount | Обновить акцию с механикой «Многоуровневая скидка от суммы» |  |
| `POST` /v1/seller-actions/update/voucher | Обновить акцию с механикой «Скидка по промокоду» |  |
| `POST` /v1/seller-actions/voucher/get | Получить файл с промокодами в формате CSV |  |

### SellerInfo — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/seller/info | Информация о кабинете продавца |  |
| `POST` /v1/seller/ozon-logistics/info | Информация о подключении Ozon Доставки |  |

### SellerRating — 4 (используем 4)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/rating/history | Получить информацию о рейтингах продавца за период | ✅ `getRatingHistory` |
| `POST` /v1/rating/index/fbs/info | Получить индекс ошибок FBS и rFBS | ✅ `getSearchQueriesTop` |
| `POST` /v1/rating/index/fbs/posting/list | Список отправлений, которые повлияли на индекс ошибок FBS и rFBS | ✅ `getFbsRatingIndex` |
| `POST` /v1/rating/summary | Получить информацию о текущих рейтингах продавца | ✅ `getSellerRating` |

### SupplierAPI — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/invoice/delete | Удалить ссылку на счёт-фактуру |  |
| `POST` /v1/invoice/file/upload | Загрузка счёта-фактуры |  |
| `POST` /v2/invoice/create-or-update | Создать или изменить счёт-фактуру |  |
| `POST` /v2/invoice/get | Получить информацию о счёте-фактуре |  |

### WarehouseAPI — 10 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/delivery-method/list | Список методов доставки склада |  |
| `POST` /v1/delivery-method/return/settings/get | Получить информацию по возвратным настройкам rFBS и rFBS Express |  |
| `POST` /v1/warehouse/archive | Перенести склад в архив |  |
| `POST` /v1/warehouse/invalid-products/get | Получить список товаров с ограничениями по доставке |  |
| `POST` /v1/warehouse/list | Список складов | ✅ `getWarehouses` |
| `POST` /v1/warehouse/operation/status | Получить статус операции |  |
| `POST` /v1/warehouse/unarchive | Перенести склад из архива |  |
| `POST` /v1/warehouse/warehouses-with-invalid-products | Получить список складов с ограниченными для доставки товарами |  |
| `POST` /v2/delivery-method/list | Список методов доставки realFBS-склада |  |
| `POST` /v2/warehouse/list | Список складов |  |


---

# Yandex Market — 152 эндпоинтов (по разделам)

### auth — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/auth/token | Получение информации о токене авторизации |  |

### bids — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `PUT` /v2/businesses/{businessId}/bids | Включение буста продаж и установка ставок |  |
| `POST` /v2/businesses/{businessId}/bids/info | Информация об установленных ставках |  |
| `POST` /v2/businesses/{businessId}/bids/recommendations | Рекомендованные ставки для заданных товаров |  |
| `PUT` /v2/campaigns/{campaignId}/bids | Включение буста продаж и установка ставок для магазина |  |

### business-offer-mappings — 7 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/businesses/{businessId}/offer-mappings/barcodes/generate | Генерация штрихкодов |  |
| `POST` /v2/businesses/{businessId}/offer-mappings | Информация о товарах в каталоге | ✅ `getAllProducts` |
| `POST` /v2/businesses/{businessId}/offer-mappings/archive | Добавление товаров в архив |  |
| `POST` /v2/businesses/{businessId}/offer-mappings/delete | Удаление товаров из каталога |  |
| `POST` /v2/businesses/{businessId}/offer-mappings/suggestions ⚠️deprecated | Просмотр карточек на Маркете, которые подходят вашим товарам |  |
| `POST` /v2/businesses/{businessId}/offer-mappings/unarchive | Удаление товаров из архива |  |
| `POST` /v2/businesses/{businessId}/offer-mappings/update | Добавление товаров в каталог и изменение информации о них | ✅ `createProduct` |

### businesses — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/settings | Настройки кабинета |  |

### campaigns — 3 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns | Список магазинов пользователя | ✅ `validateKey` |
| `GET` /v2/campaigns/{campaignId} | Информация о магазине | ✅ `validateKey` |
| `GET` /v2/campaigns/{campaignId}/settings | Настройки магазина |  |

### categories — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/categories/max-sale-quantum ⚠️deprecated | Лимит на установку кванта продажи и минимального количества товаров в заказе |  |
| `POST` /v2/categories/tree | Дерево категорий |  |

### chats — 7 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/businesses/{businessId}/chat | Получение чата по идентификатору |  |
| `POST` /v2/businesses/{businessId}/chats | Получение доступных чатов |  |
| `POST` /v2/businesses/{businessId}/chats/file/send | Отправка файла в чат |  |
| `POST` /v2/businesses/{businessId}/chats/history | Получение истории сообщений в чате |  |
| `GET` /v2/businesses/{businessId}/chats/message | Получение сообщения в чате |  |
| `POST` /v2/businesses/{businessId}/chats/message | Отправка сообщения в чат |  |
| `POST` /v2/businesses/{businessId}/chats/new | Создание нового чата с покупателем |  |

### content — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/offer-cards | Получение информации о заполненности карточек магазина |  |
| `POST` /v2/businesses/{businessId}/offer-cards/update | Редактирование категорийных характеристик товара |  |
| `POST` /v2/category/{categoryId}/parameters | Списки характеристик товаров по категориям |  |

### delivery-services — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/delivery/services | Справочник служб доставки |  |

### goods-feedback — 5 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/goods-feedback | Получение отзывов о товарах продавца | ✅ `getGoodsFeedback` |
| `POST` /v2/businesses/{businessId}/goods-feedback/comments | Получение комментариев к отзыву |  |
| `POST` /v2/businesses/{businessId}/goods-feedback/comments/delete | Удаление комментария к отзыву |  |
| `POST` /v2/businesses/{businessId}/goods-feedback/comments/update | Добавление нового или изменение созданного комментария |  |
| `POST` /v2/businesses/{businessId}/goods-feedback/skip-reaction | Пропуск реакции на отзывы |  |

### goods-questions — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/businesses/{businessId}/goods-questions | Получение вопросов о товарах продавца |  |
| `POST` /v1/businesses/{businessId}/goods-questions/answers | Получение ответов на вопрос |  |
| `POST` /v1/businesses/{businessId}/goods-questions/update | Создание, изменение и удаление ответа или комментария |  |

### goods-stats — 1 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/campaigns/{campaignId}/stats/skus | Отчет по товарам | ✅ `getSkuAnalytics` |

### hidden-offers — 3 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/hidden-offers | Информация о скрытых вами товарах | ✅ `getHiddenOffers` |
| `POST` /v2/campaigns/{campaignId}/hidden-offers | Скрытие товаров и настройки скрытия | ✅ `getHiddenOffers` |
| `POST` /v2/campaigns/{campaignId}/hidden-offers/delete | Возобновление показа товаров |  |

### offer-mappings — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/offer-mapping-entries ⚠️deprecated | Список товаров в каталоге |  |
| `POST` /v2/campaigns/{campaignId}/offer-mapping-entries/suggestions ⚠️deprecated | Рекомендованные карточки для товаров |  |
| `POST` /v2/campaigns/{campaignId}/offer-mapping-entries/updates ⚠️deprecated | Добавление и редактирование товаров в каталоге |  |

### offers — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/offers/recommendations | Рекомендации Маркета, касающиеся цен |  |
| `POST` /v2/campaigns/{campaignId}/offers | Информация о товарах, которые размещены в заданном магазине |  |
| `POST` /v2/campaigns/{campaignId}/offers/delete | Удаление товаров из ассортимента магазина |  |
| `POST` /v2/campaigns/{campaignId}/offers/update | Изменение условий продажи товаров в магазине |  |

### order-business-information — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/business-buyer | Информация о покупателе — юридическом лице |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/documents | Информация о документах |  |

### order-delivery — 5 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/buyer | Информация о покупателе — физическом лице |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/date | Изменение даты доставки заказа |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/storage-limit | Продление срока хранения заказа |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/track | Передача трек‑номера посылки |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/verifyEac | Передача кода подтверждения |  |

### order-labels — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/labels | Готовые ярлыки‑наклейки на все коробки в одном заказе |  |
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/labels/data | Данные для самостоятельного изготовления ярлыков |  |
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/shipments/{shipmentId}/boxes/{boxId}/label | Готовый ярлык‑наклейка для коробки в заказе |  |

### orders — 13 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/businesses/{businessId}/orders | Информация о заказах в кабинете |  |
| `GET` /v2/campaigns/{campaignId}/orders ⚠️deprecated | Информация о заказах в магазине | ✅ `getOrders` |
| `GET` /v2/campaigns/{campaignId}/orders/{orderId} ⚠️deprecated | Информация об одном заказе в магазине | ✅ `getOrders` |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/boxes | Подготовка заказа |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/cancellation/accept | Отмена заказа покупателем |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/deliverDigitalGoods | Передача ключей цифровых товаров |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/delivery/shipments/{shipmentId}/boxes ⚠️deprecated | Передача количества грузовых мест в заказе |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/external-id | Передача внешнего идентификатора заказа |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/identifiers | Передача кодов маркировки единиц товара |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/identifiers/status | Статусы проверки кодов маркировки |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/items | Удаление товаров из заказа или уменьшение их числа |  |
| `PUT` /v2/campaigns/{campaignId}/orders/{orderId}/status | Изменение статуса одного заказа |  |
| `POST` /v2/campaigns/{campaignId}/orders/status-update | Изменение статусов нескольких заказов |  |

### orders-stats — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/campaigns/{campaignId}/stats/orders | Детальная информация по заказам |  |

### outlet-licenses — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/outlets/licenses | Информация о лицензиях для точек продаж |  |
| `POST` /v2/campaigns/{campaignId}/outlets/licenses | Создание и изменение лицензий для точек продаж |  |
| `DELETE` /v2/campaigns/{campaignId}/outlets/licenses | Удаление лицензий для точек продаж |  |

### outlets — 5 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/outlets | Информация о нескольких точках продаж |  |
| `POST` /v2/campaigns/{campaignId}/outlets | Создание точки продаж |  |
| `GET` /v2/campaigns/{campaignId}/outlets/{outletId} | Информация об одной точке продаж |  |
| `PUT` /v2/campaigns/{campaignId}/outlets/{outletId} | Изменение информации о точке продаж |  |
| `DELETE` /v2/campaigns/{campaignId}/outlets/{outletId} | Удаление точки продаж |  |

### price-quarantine — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/price-quarantine | Список товаров, находящихся в карантине по цене в кабинете |  |
| `POST` /v2/businesses/{businessId}/price-quarantine/confirm | Удаление товара из карантина по цене в кабинете |  |
| `POST` /v2/campaigns/{campaignId}/price-quarantine | Список товаров, находящихся в карантине по цене в магазине |  |
| `POST` /v2/campaigns/{campaignId}/price-quarantine/confirm | Удаление товара из карантина по цене в магазине |  |

### prices — 5 (используем 3)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/offer-prices | Просмотр цен на указанные товары во всех магазинах |  |
| `POST` /v2/businesses/{businessId}/offer-prices/updates | Установка цен на товары для всех магазинов |  |
| `GET` /v2/campaigns/{campaignId}/offer-prices ⚠️deprecated | Список цен | ✅ `getAllPrices` |
| `POST` /v2/campaigns/{campaignId}/offer-prices | Просмотр цен на указанные товары в конкретном магазине | ✅ `getAllPrices` |
| `POST` /v2/campaigns/{campaignId}/offer-prices/updates | Установка цен на товары в конкретном магазине | ✅ `getAllPrices` |

### promos — 4 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/promos | Получение списка акций | ✅ `getPromotions` |
| `POST` /v2/businesses/{businessId}/promos/offers | Получение списка товаров, которые участвуют или могут участвовать в акции | ✅ `getPromotionOffers` |
| `POST` /v2/businesses/{businessId}/promos/offers/delete | Удаление товаров из акции |  |
| `POST` /v2/businesses/{businessId}/promos/offers/update | Добавление товаров в акцию или изменение их цен |  |

### ratings — 2 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/businesses/{businessId}/ratings/quality | Индекс качества магазинов |  |
| `POST` /v2/campaigns/{campaignId}/ratings/quality/details | Заказы, которые повлияли на индекс качества |  |

### regions — 4 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/regions | Поиск регионов по их имени |  |
| `GET` /v2/regions/{regionId} | Информация о регионе |  |
| `GET` /v2/regions/{regionId}/children | Информация о дочерних регионах |  |
| `POST` /v2/regions/countries | Список допустимых кодов стран |  |

### reports — 25 (используем 4)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v1/reports/documents/barcodes/generate | Получение файла со штрихкодами |  |
| `POST` /v2/reports/banners-statistics/generate | Отчет по охватному продвижению |  |
| `POST` /v2/reports/boost-consolidated/generate | Отчет по бусту продаж |  |
| `POST` /v2/reports/closure-documents/detalization/generate | Отчет по схождению с закрывающими документами |  |
| `POST` /v2/reports/closure-documents/generate | Закрывающие документы |  |
| `POST` /v2/reports/competitors-position/generate | Отчет «Конкурентная позиция» | ✅ `getOfferRecommendations` |
| `POST` /v2/reports/documents/labels/generate | Готовые ярлыки‑наклейки на все коробки в нескольких заказах |  |
| `POST` /v2/reports/documents/shipment-list/generate | Получение листа сборки |  |
| `POST` /v2/reports/goods-feedback/generate | Отчет по отзывам о товарах |  |
| `POST` /v2/reports/goods-movement/generate | Отчет по движению товаров |  |
| `POST` /v2/reports/goods-prices/generate | Отчет «Цены» |  |
| `POST` /v2/reports/goods-realization/generate | Отчет по реализации |  |
| `POST` /v2/reports/goods-turnover/generate | Отчет по оборачиваемости | ✅ `getReportInfo` |
| `GET` /v2/reports/info/{reportId} | Получение заданного отчета или документа | ✅ `getReportStatus` |
| `POST` /v2/reports/jewelry-fiscal/generate | Отчет по заказам с ювелирными изделиями |  |
| `POST` /v2/reports/key-indicators/generate | Отчет по ключевым показателям |  |
| `POST` /v2/reports/sales-geography/generate | Отчет по географии продаж |  |
| `POST` /v2/reports/shelf-statistics/generate | Отчет по полкам |  |
| `POST` /v2/reports/shows-boost/generate | Отчет по бусту показов |  |
| `POST` /v2/reports/shows-sales/generate | Отчет «Аналитика продаж» |  |
| `POST` /v2/reports/stocks-on-warehouses/generate | Отчет по остаткам на складах | ✅ `generateGoodsTurnoverReport` |
| `POST` /v2/reports/united-marketplace-services/generate | Отчет по стоимости услуг |  |
| `POST` /v2/reports/united-netting/generate | Отчет по платежам |  |
| `POST` /v2/reports/united-orders/generate | Отчет по заказам |  |
| `POST` /v2/reports/united-returns/generate | Отчет по невыкупам и возвратам |  |

### returns — 6 (используем 1)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/returns/{returnId} | Информация о невыкупе или возврате |  |
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/returns/{returnId}/application | Получение заявления на возврат |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/returns/{returnId}/decision ⚠️deprecated | Принятие или изменение решения по возврату |  |
| `GET` /v2/campaigns/{campaignId}/orders/{orderId}/returns/{returnId}/decision/{itemId}/image/{imageHash} | Получение фотографий товаров в возврате |  |
| `POST` /v2/campaigns/{campaignId}/orders/{orderId}/returns/{returnId}/decision/submit | Передача и подтверждение решения по возврату |  |
| `GET` /v2/campaigns/{campaignId}/returns | Список невыкупов и возвратов | ✅ `getReturns` |

### shipments — 12 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `PUT` /v2/campaigns/{campaignId}/first-mile/shipments | Получение информации о нескольких отгрузках |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId} | Получение информации об одной отгрузке |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/act | Получение акта приема-передачи |  |
| `POST` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/confirm | Подтверждение отгрузки |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/discrepancy-act | Получение акта расхождений |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/inbound-act | Получение фактического акта приема-передачи |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/orders/info | Получение информации о возможности печати ярлыков |  |
| `POST` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/orders/transfer | Перенос заказов в следующую отгрузку |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/pallet/labels | Ярлыки для доверительной приемки |  |
| `PUT` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/pallets | Передача количества упаковок для доверительной приемки |  |
| `GET` /v2/campaigns/{campaignId}/first-mile/shipments/{shipmentId}/transportation-waybill | Получение транспортной накладной |  |
| `GET` /v2/campaigns/{campaignId}/shipments/reception-transfer-act | Подтверждение ближайшей отгрузки и получение акта приема-передачи для нее |  |

### stocks — 2 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/campaigns/{campaignId}/offers/stocks | Информация об остатках и оборачиваемости | ✅ `updatePrices` |
| `PUT` /v2/campaigns/{campaignId}/offers/stocks | Передача информации об остатках | ✅ `updatePrices` |

### supply-requests — 3 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/campaigns/{campaignId}/supply-requests | Получение информации о заявках на поставку, вывоз и утилизацию |  |
| `POST` /v2/campaigns/{campaignId}/supply-requests/documents | Получение документов по заявке на поставку, вывоз или утилизацию |  |
| `POST` /v2/campaigns/{campaignId}/supply-requests/items | Получение товаров в заявке на поставку, вывоз или утилизацию |  |

### tariffs — 1 (используем 0)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `POST` /v2/tariffs/calculate | Калькулятор стоимости услуг |  |

### warehouses — 4 (используем 2)

| Метод · путь | Что делает | Исп. |
|---|---|---|
| `GET` /v2/businesses/{businessId}/warehouses ⚠️deprecated | Список складов и групп складов | ✅ `getWarehouses` |
| `POST` /v2/businesses/{businessId}/warehouses | Список складов | ✅ `getWarehouses` |
| `POST` /v2/campaigns/{campaignId}/warehouse/status | Изменение статуса склада |  |
| `GET` /v2/warehouses | Идентификаторы складов Маркета |  |


---

## ❌ Вызываем, но не нашлось в спеке (проверить)

- **WB** `getIncomes` (`wildberries.ts:879`) → sig `api/v1/supplier/incomes`
- **Ozon** `createProduct` (`ozon.ts:935`) → sig `v2/product/import`
- **Ozon** `getHotSales` (`ozon.ts:1112`) → sig `v1/actions/hotsales/list`
- **YM** `generateReport` (`yandex.ts:635`) → sig `reports/generate`
- **YM** `getQualityRatings` (`yandex.ts:682`) → sig `campaigns/ratings/quality`
- **YM** `calculateTariffs` (`yandex.ts:824`) → sig `campaigns/tariffs/calculate`
- **YM** `getOfferRecommendations` (`yandex.ts:859`) → sig `businesses/offer-recommendations`
- **YM** `getContentQuality` (`yandex.ts:998`) → sig `businesses/offer-cards/content-quality`

> ❌ = (а) эндпоинт устарел/удалён, (б) спека неполная, или (в) промах нормализации. Проверять вручную.
