const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      default: "order_status",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    href: {
      type: String,
      trim: true,
      default: "",
    },
    actionLabel: {
      type: String,
      trim: true,
      default: "View",
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "notifications",
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
