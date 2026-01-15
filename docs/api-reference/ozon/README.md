# Ozon Seller API Documentation

> LLM-friendly reference for Ozon marketplace API

**Generated:** 2024-12-28
**Source:** [Ozon API PyPI Client](https://pypi.org/project/ozon-api-client/)
**Base URL:** `https://api-seller.ozon.ru`
**API Version:** 2.1

---

## Overview

Ozon Seller API provides programmatic access to manage products, orders, deliveries, analytics, and other seller operations on the Ozon marketplace.

### Authentication

All requests require:
- **Client-ID** (`client_id` header)
- **API-Key** (`api_key` header)

Generate credentials in your Ozon Seller account: https://seller.ozon.ru/app/settings/api-keys

### Rate Limits

- Standard tier: **300 requests per 60 seconds**
- Check response headers for current limits

### Models (FBO/FBS/realFBS)

- **FBO** (Fulfillment by Ozon) - Ozon manages storage and delivery
- **FBS** (Fulfillment by Seller) - Seller manages storage, Ozon manages delivery
- **realFBS** (real FBS) - Seller manages both storage and delivery

---

## API Categories (34 total)

### Products & Catalog

| Category | Description | File |
|----------|-------------|------|
| **ProductAPIApi** | Create, update, archive products; manage attributes, images, descriptions | [products.md](./products.md) |
| **CategoryAPIApi** | Category tree, attributes, characteristics dictionaries | [categories.md](./categories.md) |
| **CertificationAPIApi** | Product certifications, compliance documents | [certification.md](./certification.md) |
| **BarcodeAPIApi** | Generate and bind barcodes to products | [barcodes.md](./barcodes.md) |
| **BrandAPIApi** | Brand certification lists | [brands.md](./brands.md) |

### Pricing & Inventory

| Category | Description | File |
|----------|-------------|------|
| **PricesStocksAPIApi** | Update prices, stocks, discounts; get inventory info | [prices-stocks.md](./prices-stocks.md) |
| **PricingStrategyAPIApi** | Automated pricing strategies, competitor monitoring | [pricing-strategy.md](./pricing-strategy.md) |

### Orders & Shipments - FBO

| Category | Description | File |
|----------|-------------|------|
| **FBOApi** | FBO order management, warehouse availability, supply orders | [fbo.md](./fbo.md) |
| **FboSupplyRequestApi** | Create and manage FBO supply requests, timeslots, drafts | [fbo-supply.md](./fbo-supply.md) |

### Orders & Shipments - FBS

| Category | Description | File |
|----------|-------------|------|
| **FBSApi** | FBS order management, labels, cancellations, tracking | [fbs.md](./fbs.md) |
| **DeliveryFBSApi** | FBS delivery acts, documents, barcodes, shipments | [delivery-fbs.md](./delivery-fbs.md) |
| **DeliveryrFBSApi** | rFBS status updates, tracking numbers, timeslots | [delivery-rfbs.md](./delivery-rfbs.md) |
| **FBSrFBSMarksApi** | Product marking/serialization for FBS/rFBS | [fbs-marks.md](./fbs-marks.md) |

### Returns & Cancellations

| Category | Description | File |
|----------|-------------|------|
| **ReturnAPIApi** | Return shipments, barcodes, giveout management | [returns.md](./returns.md) |
| **ReturnsAPIApi** | FBO/FBS return information | [returns-info.md](./returns-info.md) |
| **RFBSReturnsAPIApi** | rFBS return requests, compensation, verification | [rfbs-returns.md](./rfbs-returns.md) |
| **CancellationAPIApi** | rFBS cancellation requests approval/rejection | [cancellations.md](./cancellations.md) |

### Analytics & Reports

| Category | Description | File |
|----------|-------------|------|
| **AnalyticsAPIApi** | Sales analytics, stock reports, turnover metrics | [analytics.md](./analytics.md) |
| **ReportAPIApi** | Generate reports: postings, products, discounted, returns, finance | [reports.md](./reports.md) |
| **FinanceAPIApi** | Transactions, realization reports, B2B sales, settlements | [finance.md](./finance.md) |

### Customer Interactions

| Category | Description | File |
|----------|-------------|------|
| **ReviewAPIApi** | Reviews management, comments, status changes | [reviews.md](./reviews.md) |
| **QuestionsAnswersApi** | Customer questions, answers, statistics | [questions.md](./questions.md) |
| **ChatAPIApi** | Customer chat: messages, files, history | [chat.md](./chat.md) |
| **SellerRatingApi** | Seller rating history and current metrics | [seller-rating.md](./seller-rating.md) |

### Promotions & Marketing

| Category | Description | File |
|----------|-------------|------|
| **PromosApi** | Promotions, Hot Sales, discount tasks, candidate products | [promos.md](./promos.md) |

### Logistics & Warehouse

| Category | Description | File |
|----------|-------------|------|
| **WarehouseAPIApi** | Warehouse list, delivery methods | [warehouses.md](./warehouses.md) |
| **CargoesAPIApi** | Cargo management, labels for shipments | [cargoes.md](./cargoes.md) |
| **PassApi** | Entry passes for deliveries and returns | [passes.md](./passes.md) |
| **PolygonAPIApi** | Delivery polygons binding | [polygons.md](./polygons.md) |
| **SupplyOrderAPIApi** | Supply order cancellations | [supply-orders.md](./supply-orders.md) |

### Special Categories

| Category | Description | File |
|----------|-------------|------|
| **QuantsApi** | Economy shipping (quants) management | [quants.md](./quants.md) |
| **ExamplesApi** | Product exemplars/serialization (v6) | [examples.md](./examples.md) |
| **SupplierAPIApi** | Invoices management | [supplier.md](./supplier.md) |

### Beta & Testing

| Category | Description | File |
|----------|-------------|------|
| **BetaMethodApi** | Beta/experimental methods | [beta.md](./beta.md) |

---

## Quick Start

### Python Client

```bash
pip install ozon-api-client
```

```python
import ozon_api_client
from ozon_api_client.rest import ApiException

# Configure credentials
configuration = ozon_api_client.Configuration()
configuration.host = "https://api-seller.ozon.ru"

# Create API instance
api_instance = ozon_api_client.ProductAPIApi(
    ozon_api_client.ApiClient(configuration)
)

# Example: Get product list
body = ozon_api_client.Productv3GetProductListRequest()
client_id = "your_client_id"
api_key = "your_api_key"

try:
    api_response = api_instance.product_api_get_product_list(
        body, client_id, api_key
    )
    print(api_response)
except ApiException as e:
    print(f"Exception: {e}")
```

### Authentication Headers

All requests must include:

```http
Client-Id: your_client_id
Api-Key: your_api_key
Content-Type: application/json
```

---

## Common Patterns

### Pagination

Most list endpoints support pagination:

```json
{
  "limit": 100,
  "offset": 0
}
```

### Filtering by Date

```json
{
  "filter": {
    "since": "2024-01-01T00:00:00Z",
    "to": "2024-12-31T23:59:59Z"
  }
}
```

### Product Identification

Products can be identified by:
- `product_id` - Ozon's internal ID
- `offer_id` - Seller's SKU/article
- `sku` - Ozon's SKU (stock keeping unit)

---

## Response Format

### Success Response

```json
{
  "result": {
    // Response data
  }
}
```

### Error Response

```json
{
  "code": 1000,
  "message": "Error description",
  "details": [
    {
      "typeUrl": "type.googleapis.com/google.rpc.BadRequest",
      "value": "..."
    }
  ]
}
```

---

## Resources

- **Official Documentation:** https://docs.ozon.ru/api/seller/
- **Python Client (PyPI):** https://pypi.org/project/ozon-api-client/
- **Seller Education:** https://seller-edu.ozon.ru/
- **Developer Platform:** https://dev.ozon.ru/
- **Postman Collection:** https://www.postman.com/googlesheets/ozon-seller-api/

---

## Notes

- This documentation is generated from the Python client auto-generated by Swagger Codegen
- Ozon's official documentation may have updates not reflected here
- Always refer to official docs for the latest API changes
- Some endpoints require specific seller subscriptions or permissions
