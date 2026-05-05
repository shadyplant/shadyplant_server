const {
  createRazorpayCheckout,
  getPaymentAttemptStatus,
  processRazorpayWebhook,
  simulateSuccessfulWebhook,
} = require("../services/payment.service");
const { asyncHandler } = require("../utils/asyncHandler");

const createCheckout = asyncHandler(async (req, res) => {
  const checkout = await createRazorpayCheckout(req.auth.userId, req.body);

  res.status(201).json({
    message: "Razorpay checkout created successfully.",
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
  const result = await processRazorpayWebhook({
    signature: req.headers["x-razorpay-signature"],
    rawBody: req.rawBody,
    event: req.body,
  });

  res.status(200).json({
    message: result.ignored ? "Webhook ignored." : "Webhook processed successfully.",
    data: result,
  });
});

const simulateWebhook = asyncHandler(async (req, res) => {
  const paymentAttempt = await simulateSuccessfulWebhook(
    req.auth.userId,
    req.params.paymentAttemptId,
  );

  res.status(200).json({
    message: "Test webhook processed successfully.",
    data: { paymentAttempt },
  });
});

module.exports = {
  createCheckout,
  getPaymentAttempt,
  handleWebhook,
  simulateWebhook,
};
