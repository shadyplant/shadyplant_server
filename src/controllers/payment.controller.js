const {
  createPaymentCheckout,
  getPaymentAttemptStatus,
  processPaymentWebhook,
  verifyPaymentAttempt: verifyStoredPaymentAttempt,
} = require("../services/payment.service");
const { asyncHandler } = require("../utils/asyncHandler");

const createCheckout = asyncHandler(async (req, res) => {
  const checkout = await createPaymentCheckout(req.auth.userId, req.body);

  res.status(201).json({
    message: "Payment checkout created successfully.",
    data: { checkout },
  });
});

const getPaymentAttempt = asyncHandler(async (req, res) => {
  const paymentAttempt = await getPaymentAttemptStatus(
    req.auth.userId,
    req.params.paymentAttemptId,
  );

  res.status(200).json({
    message: "Payment attempt fetched successfully.",
    data: { paymentAttempt },
  });
});

const handleWebhook = asyncHandler(async (req, res) => {
  const result = await processPaymentWebhook({
    authorization: req.headers.authorization,
    signature:
      req.headers["x-webhook-signature"] || req.headers["x-cashfree-signature"],
    timestamp:
      req.headers["x-webhook-timestamp"] || req.headers["x-cashfree-timestamp"],
    rawBody: req.rawBody,
    event: req.body,
  });

  res.status(200).json({
    message: result.ignored ? "Webhook ignored." : "Webhook processed successfully.",
    data: result,
  });
});

const verifyPaymentAttempt = asyncHandler(async (req, res) => {
  const paymentAttempt = await verifyStoredPaymentAttempt(
    req.auth.userId,
    req.params.paymentAttemptId,
  );

  res.status(200).json({
    message: "Payment attempt verified successfully.",
    data: { paymentAttempt },
  });
});

module.exports = {
  createCheckout,
  getPaymentAttempt,
  handleWebhook,
  verifyPaymentAttempt,
};
