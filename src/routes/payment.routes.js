const express = require("express");
const {
  createCheckout,
  getPaymentAttempt,
  handleWebhook,
  simulateWebhook,
  verifyPaymentAttempt,
} = require("../controllers/payment.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/cashfree/webhook", handleWebhook);
router.post("/cashfree/create-order", requireAuth, createCheckout);
router.post(
  "/cashfree/test-webhook/:paymentAttemptId",
  requireAuth,
  simulateWebhook,
);
router.get("/cashfree/attempts/:paymentAttemptId", requireAuth, getPaymentAttempt);
router.post(
  "/cashfree/attempts/:paymentAttemptId/verify",
  requireAuth,
  verifyPaymentAttempt,
);

module.exports = router;
