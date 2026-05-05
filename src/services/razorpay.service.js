const crypto = require("crypto");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

const ensureRazorpayCheckoutConfigured = () => {
  if (!env.razorpay.isCheckoutConfigured) {
    throw new ApiError(
      503,
      "Online payment is not configured on the server yet. Add the Razorpay key ID and key secret first.",
    );
  }
};

const ensureRazorpayWebhookConfigured = () => {
  if (!env.razorpay.isWebhookConfigured) {
    throw new ApiError(
      503,
      "Razorpay webhook is not configured on the server yet. Add the webhook secret first.",
    );
  }
};

const buildAuthorizationHeader = () =>
  `Basic ${Buffer.from(
    `${env.razorpay.keyId}:${env.razorpay.keySecret}`,
    "utf8",
  ).toString("base64")}`;

const createRemoteRazorpayOrder = async (input) => {
  const response = await fetch(`${RAZORPAY_API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      502,
      payload?.error?.description || "Unable to create the Razorpay order.",
    );
  }

  return payload;
};

const verifyWebhookSignature = (signature, rawBody) => {
  if (!rawBody?.length) {
    throw new ApiError(400, "Webhook body is missing.");
  }

  const receivedSignature = String(signature || "");
  const expectedSignature = crypto
    .createHmac("sha256", env.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid Razorpay webhook signature.");
  }
};

module.exports = {
  createRemoteRazorpayOrder,
  ensureRazorpayCheckoutConfigured,
  ensureRazorpayWebhookConfigured,
  verifyWebhookSignature,
};
