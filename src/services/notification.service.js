const {
  countUnreadNotificationsByUserId,
  createNotification,
  deleteNotification,
  listNotificationsByUserId,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} = require("../repositories/notification.repository");
const { ApiError } = require("../utils/apiError");
const {
  getTransactionNotificationTemplate,
} = require("../templates/transaction-notification.template");

function normalizeString(value) {
  return String(value || "").trim();
}

async function createOrderStatusNotification(order, status = "") {
  const userId = normalizeString(order?.userId);

  if (!userId) {
    return null;
  }

  const template = getTransactionNotificationTemplate(order, status);

  return createNotification({
    userId,
    orderId: normalizeString(order?.id),
    ...template,
  });
}

async function getUserNotifications(userId, payload = {}) {
  const notifications = await listNotificationsByUserId(userId, payload);
  const unreadCount = await countUnreadNotificationsByUserId(userId);

  return {
    notifications,
    unreadCount,
  };
}

async function createUserNotification(userId, payload = {}) {
  if (!normalizeString(userId)) {
    throw new ApiError(400, "Notification user id is required.");
  }

  if (!normalizeString(payload.title) || !normalizeString(payload.message)) {
    throw new ApiError(400, "Notification title and message are required.");
  }

  return createNotification({
    ...payload,
    userId,
  });
}

async function markUserNotificationRead(userId, notificationId) {
  const notification = await markNotificationAsRead(userId, notificationId);

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  return notification;
}

async function markAllUserNotificationsRead(userId) {
  return markAllNotificationsAsRead(userId);
}

async function removeUserNotification(userId, notificationId) {
  const notification = await deleteNotification(userId, notificationId);

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  return notification;
}

module.exports = {
  createOrderStatusNotification,
  createUserNotification,
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  removeUserNotification,
};
