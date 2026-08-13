const mongoose = require("mongoose");
const { env } = require("../config/env");
const { Product } = require("../models/product.model");
const { ProductSyncLog } = require("../models/product-sync-log.model");
const {
  buildProductIdentifier,
  buildProductSkuId,
} = require("../repositories/product.repository");
const { ApiError } = require("../utils/apiError");
const { createSha256Hash } = require("../utils/crypto");

const PRODUCT_SYNC_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const DEFAULT_PRODUCT_UNIT = "per plant";
const DEFAULT_PACK_LABEL = "Pack of 1";
const DEFAULT_BADGE = "Sheet Sync";
const DEFAULT_WEIGHT = 1;

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeString = (value) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return sanitizeString(value);
};

const toPositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const toNonNegativeInteger = (value) => {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeStatus = (value) => {
  const normalizedValue = sanitizeString(value).toLowerCase();

  if (normalizedValue === PRODUCT_SYNC_STATUS.ACTIVE) {
    return PRODUCT_SYNC_STATUS.ACTIVE;
  }

  if (normalizedValue === PRODUCT_SYNC_STATUS.INACTIVE) {
    return PRODUCT_SYNC_STATUS.INACTIVE;
  }

  return "";
};

const isValidImageUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value.map((entry) => sanitizeOptionalString(entry)).filter(Boolean),
    )];
  }

  return [...new Set(
    sanitizeOptionalString(value)
      .split(",")
      .map((entry) => sanitizeOptionalString(entry))
      .filter(Boolean),
  )];
};

const buildSheetRowError = (rowNumber, sku, message, code = "validation_error") => ({
  rowNumber,
  sku: sanitizeOptionalString(sku),
  message,
  code,
});

const buildSchemaValidationErrors = (rowNumber, sku, validationError) =>
  Object.values(validationError.errors || {}).map((entry) =>
    buildSheetRowError(
      rowNumber,
      sku,
      entry.message || "Product schema validation failed.",
      "product_schema_validation_failed",
    ),
  );

const createProductDefaults = (normalizedRow) => {
  const id =
    slugifyValue(`${normalizedRow.sku}-${normalizedRow.productName}`) ||
    createSha256Hash(`${normalizedRow.sku}-${normalizedRow.productName}`).slice(0, 16);
  const price =
    normalizedRow.discountPrice !== null
      ? normalizedRow.discountPrice
      : normalizedRow.price;

  return {
    id,
    productId: buildProductIdentifier({ id }),
    sku: normalizedRow.sku,
    skuId: buildProductSkuId({ id, sku: normalizedRow.sku }),
    name: normalizedRow.productName,
    category: normalizedRow.category || "Uncategorized",
    brand: normalizedRow.brand || "",
    price,
    mrp: normalizedRow.price,
    weight: normalizedRow.weight !== null ? normalizedRow.weight : DEFAULT_WEIGHT,
    offer:
      normalizedRow.discountPrice !== null &&
      normalizedRow.price > 0 &&
      normalizedRow.discountPrice < normalizedRow.price
        ? `${Math.max(
            0,
            Math.round(
              ((normalizedRow.price - normalizedRow.discountPrice) /
                normalizedRow.price) *
                100,
            ),
          )}% off`
        : "",
    minOrderQuantity: 1,
    maxPurchaseQuantity: null,
    stock: normalizedRow.stockQuantity,
    isOnTrend: false,
    isFeaturedLatest: false,
    packLabel: normalizedRow.variant || DEFAULT_PACK_LABEL,
    variant: normalizedRow.variant || "",
    unit: DEFAULT_PRODUCT_UNIT,
    badge: normalizedRow.brand || normalizedRow.category || DEFAULT_BADGE,
    description: normalizedRow.description || normalizedRow.productName,
    image: normalizedRow.imageUrl || "",
    images: normalizedRow.imageUrl ? [normalizedRow.imageUrl] : [],
    tags: normalizedRow.tags,
    status: normalizedRow.status,
  };
};

const normalizeIncomingRow = (row = {}, rowIndex = 0) => {
  const rowNumber = rowIndex + 1;
  const normalizedRow = {
    rowNumber,
    sku: sanitizeOptionalString(row.sku),
    productName: sanitizeOptionalString(row.productName),
    category: sanitizeOptionalString(row.category),
    brand: sanitizeOptionalString(row.brand),
    description: sanitizeOptionalString(row.description),
    price: toPositiveNumber(row.price),
    discountPrice:
      row.discountPrice === undefined || row.discountPrice === null || row.discountPrice === ""
        ? null
        : toPositiveNumber(row.discountPrice),
    stockQuantity: toNonNegativeInteger(row.stockQuantity),
    status: normalizeStatus(row.status || "Active"),
    imageUrl: sanitizeOptionalString(row.imageUrl),
    variant: sanitizeOptionalString(row.variant),
    weight:
      row.weight === undefined || row.weight === null || row.weight === ""
        ? null
        : toPositiveNumber(row.weight),
    tags: normalizeTags(row.tags),
  };
  const errors = [];

  if (!normalizedRow.sku) {
    errors.push(buildSheetRowError(rowNumber, "", "SKU is required.", "missing_sku"));
  }

  if (!normalizedRow.productName) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Product name is required.",
        "missing_product_name",
      ),
    );
  }

  if (normalizedRow.price === null || normalizedRow.price <= 0) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Price must be a positive number.",
        "invalid_price",
      ),
    );
  }

  if (
    normalizedRow.discountPrice !== null &&
    (normalizedRow.discountPrice < 0 ||
      (normalizedRow.price !== null &&
        normalizedRow.discountPrice > normalizedRow.price))
  ) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Discount price cannot exceed price.",
        "invalid_discount_price",
      ),
    );
  }

  if (normalizedRow.stockQuantity === null || normalizedRow.stockQuantity < 0) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Stock cannot be negative.",
        "invalid_stock_quantity",
      ),
    );
  }

  if (!normalizedRow.status) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Status must be either Active or Inactive.",
        "invalid_status",
      ),
    );
  }

  if (!isValidImageUrl(normalizedRow.imageUrl)) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Image URL format is invalid.",
        "invalid_image_url",
      ),
    );
  }

  if (normalizedRow.weight !== null && normalizedRow.weight <= 0) {
    errors.push(
      buildSheetRowError(
        rowNumber,
        normalizedRow.sku,
        "Weight must be greater than zero when provided.",
        "invalid_weight",
      ),
    );
  }

  return {
    normalizedRow,
    errors,
  };
};

const splitIntoChunks = (items, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const createInitialSyncLog = async (context, totalRows, dryRun) =>
  ProductSyncLog.findOneAndUpdate(
    { requestId: context.requestId },
    {
      $set: {
        requestId: context.requestId,
        idempotencyKey: context.idempotencyKey,
        payloadHash: context.payloadHash,
        status: "in_progress",
        dryRun: Boolean(dryRun),
        totalRows,
        requestMeta: {
          ip: context.requestIp,
          userAgent: context.userAgent,
        },
        audit: {
          actor: "google-sheets",
          authType: "bearer",
        },
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

const finalizeSyncLog = async (requestId, payload) =>
  ProductSyncLog.findOneAndUpdate(
    { requestId },
    {
      $set: {
        ...payload,
        completedAt: new Date(),
      },
    },
    { new: true },
  );

const syncProductsFromSheet = async (payload, options = {}) => {
  if (!Array.isArray(payload)) {
    throw new ApiError(400, "Request body must be a JSON array of products.");
  }

  const rows = payload;
  const dryRun = Boolean(options.dryRun);
  const context = options.context || {};
  const startedAt = Date.now();
  await createInitialSyncLog(context, rows.length, dryRun);

  const normalizedRows = [];
  const errors = [];
  const rowNumbersBySku = new Map();

  rows.forEach((row, rowIndex) => {
    const result = normalizeIncomingRow(row, rowIndex);
    normalizedRows.push(result.normalizedRow);
    errors.push(...result.errors);

    if (result.normalizedRow.sku) {
      const existingRowNumbers = rowNumbersBySku.get(result.normalizedRow.sku) || [];
      existingRowNumbers.push(result.normalizedRow.rowNumber);
      rowNumbersBySku.set(result.normalizedRow.sku, existingRowNumbers);
    }
  });

  for (const [sku, rowNumbers] of rowNumbersBySku.entries()) {
    if (rowNumbers.length <= 1) {
      continue;
    }

    rowNumbers.forEach((rowNumber) => {
      errors.push(
        buildSheetRowError(
          rowNumber,
          sku,
          `Duplicate SKU "${sku}" found in request.`,
          "duplicate_request_sku",
        ),
      );
    });
  }

  const invalidRowNumbers = new Set(errors.map((error) => error.rowNumber));
  const validRows = normalizedRows.filter((row) => !invalidRowNumbers.has(row.rowNumber));
  const existingProducts = validRows.length
      ? await Product.find({
        sku: { $in: validRows.map((row) => row.sku) },
      })
        .select(
          "id productId sku skuId category brand description image images weight minOrderQuantity maxPurchaseQuantity packLabel unit badge variant status",
        )
        .lean()
    : [];
  const existingProductsBySku = new Map(
    existingProducts.map((product) => [String(product.sku || "").trim(), product]),
  );
  const validOperations = [];

  validRows.forEach((row) => {
    const existingProduct = existingProductsBySku.get(row.sku) || null;
    const defaults = createProductDefaults(row);
    const createData = existingProduct
      ? {
          ...defaults,
          id: existingProduct.id || defaults.id,
          productId: existingProduct.productId || defaults.productId,
          skuId: existingProduct.skuId || defaults.skuId,
          category: row.category || existingProduct.category || defaults.category,
          brand: row.brand || existingProduct.brand || defaults.brand,
          description:
            row.description || existingProduct.description || defaults.description,
          image: row.imageUrl || existingProduct.image || defaults.image,
          images:
            row.imageUrl
              ? [row.imageUrl]
              : Array.isArray(existingProduct.images)
                ? existingProduct.images
                : defaults.images,
          weight:
            row.weight !== null
              ? row.weight
              : Number(existingProduct.weight) > 0
                ? Number(existingProduct.weight)
                : defaults.weight,
          minOrderQuantity:
            row.minOrderQuantity ??
            existingProduct.minOrderQuantity ??
            defaults.minOrderQuantity,
          maxPurchaseQuantity:
            row.maxPurchaseQuantity ??
            existingProduct.maxPurchaseQuantity ??
            defaults.maxPurchaseQuantity,
          packLabel: row.variant || existingProduct.packLabel || defaults.packLabel,
          variant: row.variant || existingProduct.variant || defaults.variant,
          unit: existingProduct.unit || defaults.unit,
          badge: row.brand || existingProduct.badge || defaults.badge,
          status: row.status,
        }
      : defaults;

    const draftProduct = new Product(createData);
    const validationError = draftProduct.validateSync();

    if (validationError) {
      errors.push(
        ...buildSchemaValidationErrors(row.rowNumber, row.sku, validationError),
      );
      return;
    }

    validOperations.push({
      existingProduct,
      createData,
      update: {
        sku: createData.sku,
        skuId: createData.skuId,
        name: createData.name,
        category: createData.category,
        brand: createData.brand,
        price: createData.price,
        mrp: createData.mrp,
        weight: createData.weight,
        offer: createData.offer,
        minOrderQuantity: createData.minOrderQuantity,
        maxPurchaseQuantity: createData.maxPurchaseQuantity,
        stock: createData.stock,
        isOnTrend: createData.isOnTrend,
        isFeaturedLatest: createData.isFeaturedLatest,
        packLabel: createData.packLabel,
        variant: createData.variant,
        unit: createData.unit,
        badge: createData.badge,
        description: createData.description,
        image: createData.image,
        images: createData.images,
        tags: createData.tags,
        status: createData.status,
      },
    });
  });
  const createdCount = validOperations.filter((entry) => !entry.existingProduct).length;
  const updatedCount = validOperations.length - createdCount;

  if (!dryRun && validOperations.length) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      for (const operationChunk of splitIntoChunks(
        validOperations,
        env.productSync.bulkWriteChunkSize,
      )) {
        await Product.bulkWrite(
          operationChunk.map((entry) => ({
            updateOne: {
              filter: { sku: entry.createData.sku },
              update: {
                $set: entry.update,
                $setOnInsert: {
                  id: entry.createData.id,
                  productId: entry.createData.productId,
                },
              },
              upsert: true,
              runValidators: true,
              setDefaultsOnInsert: true,
            },
          })),
          {
            ordered: false,
            session,
          },
        );
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      const criticalError = buildSheetRowError(
        0,
        "",
        "Database sync failed and the transaction was rolled back.",
        "database_transaction_failed",
      );

      errors.push(criticalError);
      await finalizeSyncLog(context.requestId, {
        status: "failed",
        successCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: rows.length,
        executionTimeMs: Date.now() - startedAt,
        errorDetails: errors,
      });
      await session.endSession();
      throw new ApiError(500, criticalError.message, {
        cause: error.message,
      });
    }

    await session.endSession();
  }

  const successCount = validOperations.length;
  const failedCount = rows.length - successCount;
  const responsePayload = {
    success: errors.length === 0,
    requestId: context.requestId,
    dryRun,
    totalProducts: rows.length,
    created: createdCount,
    updated: updatedCount,
    failed: failedCount,
    errors,
    executionTimeMs: Date.now() - startedAt,
    syncedAt: new Date().toISOString(),
  };

  await finalizeSyncLog(context.requestId, {
    status: dryRun ? "dry_run" : "completed",
    dryRun,
    successCount,
    createdCount,
    updatedCount,
    failedCount,
    executionTimeMs: responsePayload.executionTimeMs,
    errorDetails: errors,
  });

  return responsePayload;
};

module.exports = {
  syncProductsFromSheet,
};
