const { asyncHandler } = require("../utils/asyncHandler");
const {
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  removeUserNotification,
} = require("../services/notification.service");

const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await getUserNotifications(req.auth.userId, req.query);

  res.status(200).json({
    message: "Notifications fetched successfully.",
    data: notifications,
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  await markUserNotificationRead(
    req.auth.userId,
    req.params.notificationId,
  );
  const notifications = await getUserNotifications(req.auth.userId, req.query);

  res.status(200).json({
    message: "Notification marked as read successfully.",
    data: notifications,
  });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllUserNotificationsRead(req.auth.userId);
  const notifications = await getUserNotifications(req.auth.userId, req.query);

  res.status(200).json({
    message: "Notifications marked as read successfully.",
    data: notifications,
  });
});

const deleteNotification = asyncHandler(async (req, res) => {
  await removeUserNotification(
    req.auth.userId,
    req.params.notificationId,
  );
  const notifications = await getUserNotifications(req.auth.userId, req.query);

  res.status(200).json({
    message: "Notification deleted successfully.",
    data: notifications,
  });
});

module.exports = {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
};
