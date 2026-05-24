const mongoose = require("mongoose");

const productSyncErrorSchema = new mongoose.Schema(
  {
    rowNumber: {
      type: Number,
      min: 0,
      required: true,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
    id: false,
  },
);

const productSyncLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    payloadHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: "google_sheets",
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed", "dry_run"],
      default: "in_progress",
      index: true,
    },
    dryRun: {
      type: Boolean,
      default: false,
    },
    totalRows: {
      type: Number,
      min: 0,
      default: 0,
    },
    successCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    updatedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    failedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    executionTimeMs: {
      type: Number,
      min: 0,
      default: 0,
    },
    errorDetails: {
      type: [productSyncErrorSchema],
      default: undefined,
    },
    requestMeta: {
      ip: {
        type: String,
        trim: true,
        default: "",
      },
      userAgent: {
        type: String,
        trim: true,
        default: "",
      },
    },
    audit: {
      actor: {
        type: String,
        trim: true,
        default: "google-sheets",
      },
      authType: {
        type: String,
        trim: true,
        default: "bearer",
      },
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const ProductSyncLog =
  mongoose.models.ProductSyncLog ||
  mongoose.model("ProductSyncLog", productSyncLogSchema);

module.exports = { ProductSyncLog };
