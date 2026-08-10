const express = require("express");
const {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../controllers/notification.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);
router.delete("/:notificationId", deleteNotification);

module.exports = router;
