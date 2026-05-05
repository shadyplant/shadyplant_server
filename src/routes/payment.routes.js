const express = require("express");
const {
  createCheckout,
  getPaymentAttempt,
  handleWebhook,
  simulateWebhook,
} = require("../controllers/payment.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/razorpay/webhook", handleWebhook);
router.post("/razorpay/create-order", requireAuth, createCheckout);
router.post(
  "/razorpay/test-webhook/:paymentAttemptId",
  requireAuth,
  simulateWebhook,
);
router.get("/razorpay/attempts/:paymentAttemptId", requireAuth, getPaymentAttempt);

module.exports = router;
