const Notification = require("../models/notification.model");
const { generateId } = require("../utils/crypto");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function mapNotificationDocument(document) {
  if (!document) {
    return null;
  }

  return {
    id: document.id,
    userId: document.userId,
    orderId: document.orderId || "",
    type: document.type || "order_status",
    title: document.title || "",
    message: document.message || "",
    imageUrl: document.imageUrl || "",
    href: document.href || "",
    actionLabel: document.actionLabel || "View",
    icon: document.icon || "",
    isRead: Boolean(document.isRead),
    readAt: document.readAt ? new Date(document.readAt).toISOString() : null,
    metadata: normalizeMetadata(document.metadata),
    createdAt: document.createdAt
      ? new Date(document.createdAt).toISOString()
      : null,
    updatedAt: document.updatedAt
      ? new Date(document.updatedAt).toISOString()
      : null,
  };
}

function normalizeLimit(value, fallback = 50, max = 100) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(max, Math.floor(parsedValue));
}

async function createNotification(payload = {}) {
  const now = new Date();
  const document = await Notification.create({
    id: normalizeString(payload.id) || generateId(),
    userId: normalizeString(payload.userId),
    orderId: normalizeString(payload.orderId),
    type: normalizeString(payload.type) || "order_status",
    title: normalizeString(payload.title),
    message: normalizeString(payload.message),
    imageUrl: normalizeString(payload.imageUrl),
    href: normalizeString(payload.href),
    actionLabel: normalizeString(payload.actionLabel) || "View",
    icon: normalizeString(payload.icon),
    isRead: Boolean(payload.isRead),
    readAt: payload.readAt ? new Date(payload.readAt) : null,
    metadata: normalizeMetadata(payload.metadata),
    createdAt: payload.createdAt ? new Date(payload.createdAt) : now,
    updatedAt: now,
  });

  return mapNotificationDocument(document.toObject());
}

async function listNotificationsByUserId(userId, payload = {}) {
  const limit = normalizeLimit(payload.limit);
  const unreadOnly = Boolean(payload.unreadOnly);
  const filter = {
    userId: normalizeString(userId),
  };

  if (unreadOnly) {
    filter.isRead = false;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return notifications.map(mapNotificationDocument).filter(Boolean);
}

async function countUnreadNotificationsByUserId(userId) {
  return Notification.countDocuments({
    userId: normalizeString(userId),
    isRead: false,
  });
}

async function markNotificationAsRead(userId, notificationId) {
  const updatedNotification = await Notification.findOneAndUpdate(
    {
      userId: normalizeString(userId),
      id: normalizeString(notificationId),
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      new: true,
    },
  ).lean();

  return mapNotificationDocument(updatedNotification);
}

async function markAllNotificationsAsRead(userId) {
  await Notification.updateMany(
    {
      userId: normalizeString(userId),
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return { success: true };
}

async function deleteNotification(userId, notificationId) {
  const deletedNotification = await Notification.findOneAndDelete({
    userId: normalizeString(userId),
    id: normalizeString(notificationId),
  }).lean();

  return mapNotificationDocument(deletedNotification);
}

module.exports = {
  countUnreadNotificationsByUserId,
  createNotification,
  deleteNotification,
  listNotificationsByUserId,
  markAllNotificationsAsRead,
  markNotificationAsRead,
};
