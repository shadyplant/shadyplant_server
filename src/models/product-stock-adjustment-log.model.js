const mongoose = require("mongoose");

const productStockAdjustmentLogSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    productReference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    operation: {
      type: String,
      enum: ["add", "adjust"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    delta: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "manual_correction",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    actor: {
      staffAccountId: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      role: {
        type: String,
        trim: true,
        default: "",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

productStockAdjustmentLogSchema.index({ productId: 1, createdAt: -1 });

const ProductStockAdjustmentLog =
  mongoose.models.ProductStockAdjustmentLog ||
  mongoose.model("ProductStockAdjustmentLog", productStockAdjustmentLogSchema);

module.exports = { ProductStockAdjustmentLog };
