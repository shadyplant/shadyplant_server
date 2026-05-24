const { ProductStockAdjustmentLog } = require("../models/product-stock-adjustment-log.model");

const mapLog = (entry) => {
  if (!entry) {
    return null;
  }

  return {
    id: String(entry._id || ""),
    productId: String(entry.productId || "").trim(),
    productReference: String(entry.productReference || "").trim(),
    productName: String(entry.productName || "").trim(),
    operation: String(entry.operation || "").trim(),
    quantity: Number(entry.quantity || 0),
    delta: Number(entry.delta || 0),
    reason: String(entry.reason || "").trim(),
    note: String(entry.note || "").trim(),
    previousStock: Number(entry.previousStock || 0),
    currentStock: Number(entry.currentStock || 0),
    actor: {
      staffAccountId: String(entry.actor?.staffAccountId || "").trim(),
      email: String(entry.actor?.email || "").trim(),
      role: String(entry.actor?.role || "").trim(),
    },
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
  };
};

const createProductStockAdjustmentLog = async (payload = {}) => {
  const createdLog = await ProductStockAdjustmentLog.create({
    productId: String(payload.productId || "").trim(),
    productReference: String(payload.productReference || "").trim(),
    productName: String(payload.productName || "").trim(),
    operation: String(payload.operation || "").trim(),
    quantity: Number(payload.quantity || 0),
    delta: Number(payload.delta || 0),
    reason: String(payload.reason || "").trim() || "manual_correction",
    note: String(payload.note || "").trim(),
    previousStock: Number(payload.previousStock || 0),
    currentStock: Number(payload.currentStock || 0),
    actor: {
      staffAccountId: String(payload.actor?.staffAccountId || "").trim(),
      email: String(payload.actor?.email || "").trim(),
      role: String(payload.actor?.role || "").trim(),
    },
  });

  return mapLog(createdLog.toObject());
};

const listProductStockAdjustmentLogs = async (productLookupId, limit = 20) => {
  const normalizedLookupId = String(productLookupId || "").trim();

  if (!normalizedLookupId) {
    return [];
  }

  const logs = await ProductStockAdjustmentLog.find({
    $or: [
      { productId: normalizedLookupId },
      { productReference: normalizedLookupId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Math.floor(Number(limit || 20)))))
    .lean();

  return logs.map(mapLog).filter(Boolean);
};

module.exports = {
  createProductStockAdjustmentLog,
  listProductStockAdjustmentLogs,
};
