
const express = require("express");
const router = express.Router();

const {
  verifyWebhook,
  receiveWebhook,
} = require("../controllers/whatsapp.controller");

// Meta Verification
router.get("/webhook", verifyWebhook);

// Incoming Messages
router.post("/webhook", receiveWebhook);

module.exports = router;