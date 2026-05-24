const express = require("express");
const {
  createCheckout,
  getPaymentAttempt,
  handleWebhook,
  verifyPaymentAttempt,
} = require("../controllers/payment.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/webhook", handleWebhook);
router.post("/checkout", requireAuth, createCheckout);
router.get("/attempts/:paymentAttemptId", requireAuth, getPaymentAttempt);
router.post("/attempts/:paymentAttemptId/verify", requireAuth, verifyPaymentAttempt);

module.exports = router;
