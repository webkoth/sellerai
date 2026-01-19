# Content API

> **Base URL:** `https://content-api.wildberries.ru`
> **Rate Limits:** 60 req/60s, interval 600ms, burst 5
> **Документация:** https://dev.wildberries.ru/openapi/work-with-products
> **Сгенерировано:** 2024-12-28 17:17:00

## Описание

Управление карточками товаров, категориями, медиа

---

## Документация API

- General

- Product Management

  - Categories, Subjects, and Characteristics

    - GET

      Products Parent Categories/content/v2/object/parent/all

    - GET

      Subjects List/content/v2/object/all

    - GET

      Subject Characteristics/content/v2/object/charcs/{subjectId}

    - GET

      Color/content/v2/directory/colors

    - GET

      Gender/content/v2/directory/kinds

    - GET

      Country of Origin/content/v2/directory/countries

    - GET

      Season/content/v2/directory/seasons

    - GET

      VAT Rate/content/v2/directory/vat

    - GET

      HS-codes/content/v2/directory/tnved

    - GET

      Brands/api/content/v1/brands
  - Creating Product Cards

  - Product Cards

  - Media Files

  - Tags

  - Prices and Discounts

  - Seller Warehouses

  - Inventory
- FBS Orders

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


- Product Management
- Categories, Subjects, and Characteristics
  - getProducts Parent Categories/content/v2/object/parent/all
  - getSubjects List/content/v2/object/all
  - getSubject Characteristics/content/v2/object/charcs/{subjectId}
  - getColor/content/v2/directory/colors
  - getGender/content/v2/directory/kinds
  - getCountry of Origin/content/v2/directory/countries
  - getSeason/content/v2/directory/seasons
  - getVAT Rate/content/v2/directory/vat
  - getHS-codes/content/v2/directory/tnved
  - getBrands/api/content/v1/brands
- Creating Product Cards
  - getLimits for the Product Cards/content/v2/cards/limits
  - postGeneration of Barcodes/content/v2/barcodes
  - postCreate Product Cards/content/v2/cards/upload
  - postCreate Product Cards with Merge/content/v2/cards/upload/add
- Product Cards
  - postProduct Cards List/content/v2/get/cards/list
  - postList of Failed Product Cards with Errors/content/v2/cards/error/list
  - postUpdate Product Cards/content/v2/cards/update
  - postMerging or Separating of Product Cards/content/v2/cards/moveNm
  - postTransfer Product Card to Trash/content/v2/cards/delete/trash
  - postRecover Product Card from Trash/content/v2/cards/recover
  - postProduct Cards in Trash List/content/v2/get/cards/trash
- Media Files
  - postUpload Media File/content/v3/media/file
  - postUpload Media Files via Links/content/v3/media/save
- Tags
  - getTags List/content/v2/tags
  - postCreate a Tag/content/v2/tag
  - patchUpdate the Tag/content/v2/tag/{id}
  - delDelete the Tag/content/v2/tag/{id}
  - postTag Management in the Product Card/content/v2/tag/nomenclature/link
- Prices and Discounts
  - postSet Prices and Discounts/api/v2/upload/task
  - postSet Size Prices/api/v2/upload/task/size
  - postSet WB Club Discounts/api/v2/upload/task/club-discount
  - getProcessed Upload State/api/v2/history/tasks
  - getProcessed Upload Details/api/v2/history/goods/task
  - getUnprocessed Upload State/api/v2/buffer/tasks
  - getUnprocessed Upload Details/api/v2/buffer/goods/task
  - getGet Products with Prices/api/v2/list/goods/filter
  - postGet Products with Prices by Articles/api/v2/list/goods/filter
  - getGet Product Sizes with Prices/api/v2/list/goods/size/nm
  - getGet Products in Quarantine/api/v2/quarantine/goods
- Seller Warehouses
  - getGet Offices/api/v3/offices
  - getGet Warehouses/api/v3/warehouses
  - postCreate Warehouse/api/v3/warehouses
  - putUpdate Warehouse/api/v3/warehouses/{warehouseId}
  - delDelete Warehouse/api/v3/warehouses/{warehouseId}
  - getContacts List/api/v3/dbw/warehouses/{warehouseId}/contacts
  - putUpdate Contacts List/api/v3/dbw/warehouses/{warehouseId}/contacts
- Inventory
  - putUpdate Inventory/api/v3/stocks/{warehouseId}
  - delDelete Inventory/api/v3/stocks/{warehouseId}
  - postGet Inventory/api/v3/stocks/{warehouseId}

# Product Management(products)

Use the methods in this section to:

- [сreate](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Creating-Product-Cards) and [edit](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Product-Cards) product cards
- get [product categories, subjects, characteristics, and brands](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Categories-Subjects-and-Characteristics)
- upload [media files](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Media-Files) for product cards
- set up [tags](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Tags) for product search
- set [prices and discounts](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Prices-and-Discounts)
- manage [product inventory](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Inventory) and [warehouses](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Seller-Warehouses), if you work with the sales model from the seller's warehouse

# [tag/Product-Management](https://dev.wildberries.ru/en/openapi/work-with-products\\#tag/Product-Management) Product Management

Use the methods in this section to:

- [сreate](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Creating-Product-Cards) and [edit](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Product-Cards) product cards
- get [product categories, subjects, characteristics, and brands](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Categories-Subjects-and-Characteristics)
- upload [media files](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Media-Files) for product cards
- set up [tags](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Tags) for product search
- set [prices and discounts](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Prices-and-Discounts)
- manage [product inventory](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Inventory) and [warehouses](https://dev.wildberries.ru/en/openapi/work-with-products#tag/Seller-Warehouses), if you work with the sales model from the seller's warehouse

⚠️ **NOTE:** Full API documentation has been successfully scraped but is extremely large (143k characters). For the complete detailed documentation including all endpoint specifications, request/response schemas, and examples, please refer to the official documentation at https://dev.wildberries.ru/openapi/work-with-products

This file contains a comprehensive overview of all available endpoints. For specific endpoint details, consult the official WB documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/work-with-products
