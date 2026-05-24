# Google Sheets Product Sync

The sync endpoint is versioned and available at `POST /api/v1/admin/sync-products`.

Authentication:

- `Authorization: Bearer <SYNC_PRODUCTS_BEARER_TOKEN>`

Optional headers:

- `x-request-id`: Caller-supplied request tracking ID.
- `x-idempotency-key`: Caller-supplied retry key. If omitted, the server uses a payload hash.

Optional query params:

- `dryRun=true`: Validate and classify the payload without writing to MongoDB.

Payload example:

```json
[
  {
    "sku": "SHOE001",
    "productName": "Nike Air",
    "category": "Shoes",
    "brand": "Nike",
    "description": "Running shoe",
    "price": 4999,
    "discountPrice": 4499,
    "stockQuantity": 20,
    "status": "Active",
    "imageUrl": "https://example.com/image.jpg",
    "variant": "Black 42",
    "weight": 500,
    "tags": "running,sports"
  }
]
```

Response example:

```json
{
  "success": true,
  "requestId": "7d1b1a78-c8a6-4442-b8b1-661c87378d4a",
  "dryRun": false,
  "totalProducts": 500,
  "created": 120,
  "updated": 350,
  "failed": 30,
  "errors": [],
  "executionTimeMs": 1822,
  "syncedAt": "2026-05-15T12:00:00.000Z"
}
```

Implementation notes:

- MongoDB is the product source of truth in this codebase.
- Redis is used for concurrency locks and idempotency cache when available.
- Each sync writes a `ProductSyncLog` document for audit and execution tracking.
- The endpoint never hard-deletes products. `Inactive` rows are marked `inactive`.
- For this codebase, sheet `price` maps to product `mrp` and `discountPrice` maps to sell `price`.

Google Apps Script example:

```javascript
function syncProductsToBackend() {
  const url = 'https://your-domain.com/api/v1/admin/sync-products';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();

  const products = rows
    .filter(function(row) {
      return row.some(function(cell) {
        return String(cell || '').trim() !== '';
      });
    })
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        item[String(header || '').trim()] = row[index];
      });

      return item;
    });

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('SYNC_PRODUCTS_BEARER_TOKEN'),
      'x-request-id': Utilities.getUuid(),
      'x-idempotency-key': Utilities.getUuid()
    },
    payload: JSON.stringify(products),
    muteHttpExceptions: true
  });

  Logger.log(response.getResponseCode());
  Logger.log(response.getContentText());
}
```

Large-scale backend folder structure example:

```text
src/
  app.js
  server.js
  config/
    env.js
    mongo.js
    postgres.js
    redis.js
  controllers/
    admin.controller.js
  middleware/
    auth.middleware.js
    error.middleware.js
    product-sync.middleware.js
    rateLimiters.js
  models/
    product.model.js
    product-sync-log.model.js
  repositories/
    product.repository.js
  routes/
    admin.routes.js
    index.js
  services/
    admin.service.js
    product-sync.service.js
  utils/
    apiError.js
    asyncHandler.js
    crypto.js
docs/
  google-sheet-product-sync.md
  prisma/
    product-sync.prisma
```
