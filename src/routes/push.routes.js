const express = require("express");
const { registerDevicePushToken } = require("../controllers/push.controller");
const { pushTokenLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/devices/register", pushTokenLimiter, registerDevicePushToken);

module.exports = router;
