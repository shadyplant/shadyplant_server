const crypto = require("crypto");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

const CASHFREE_API_BASE_URLS = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

const getCashfreeApiBaseUrl = () =>
  CASHFREE_API_BASE_URLS[env.cashfree.environment] || CASHFREE_API_BASE_URLS.sandbox;

const ensureCashfreeCheckoutConfigured = () => {
  if (!env.cashfree.isCheckoutConfigured) {
    throw new ApiError(
      503,
      "Online payment is not configured on the server yet. Add the Cashfree app ID and secret key first.",
    );
  }
};

const ensureCashfreeWebhookConfigured = () => {
  if (!env.cashfree.isWebhookConfigured) {
    throw new ApiError(
      503,
      "Cashfree webhook is not configured on the server yet. Add the webhook secret first.",
    );
  }
};

const buildCashfreeHeaders = ({ idempotencyKey = "" } = {}) => {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-version": env.cashfree.apiVersion,
    "x-client-id": env.cashfree.appId,
    "x-client-secret": env.cashfree.secretKey,
    "x-request-id": crypto.randomUUID(),
  };

  if (idempotencyKey) {
    headers["x-idempotency-key"] = idempotencyKey;
  }

  return headers;
};

const parseJsonSafely = async (response) => response.json().catch(() => null);

const buildCashfreeErrorMessage = (payload, fallbackMessage) => {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.type === "string" && payload.type.trim()) {
    return payload.type.trim();
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0];

    if (typeof firstError?.message === "string" && firstError.message.trim()) {
      return firstError.message.trim();
    }
  }

  return fallbackMessage;
};

const requestCashfreeJson = async (
  pathname,
  { method = "GET", body, idempotencyKey = "" } = {},
) => {
  ensureCashfreeCheckoutConfigured();

  const response = await fetch(`${getCashfreeApiBaseUrl()}${pathname}`, {
    method,
    headers: buildCashfreeHeaders({ idempotencyKey }),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new ApiError(
      502,
      buildCashfreeErrorMessage(payload, "Unable to complete the Cashfree request."),
    );
  }

  return payload;
};

const createRemoteCashfreeOrder = async (input) =>
  requestCashfreeJson("/orders", {
    method: "POST",
    body: input,
    idempotencyKey: String(input?.order_id || crypto.randomUUID()),
  });

const getRemoteCashfreeOrder = async (orderId) =>
  requestCashfreeJson(`/orders/${encodeURIComponent(orderId)}`);

const listRemoteCashfreePayments = async (orderId) =>
  requestCashfreeJson(`/orders/${encodeURIComponent(orderId)}/payments`);

const sanitizeReturnPath = (returnPath, fallbackPath) => {
  const candidate = String(returnPath || "").trim();

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallbackPath;
  }

  return candidate;
};

const buildCashfreeReturnUrl = (returnPath, paymentAttemptId, fallbackPath = "/order-summary") => {
  const baseOrigin = String(env.clientOrigins[0] || "").trim().replace(/\/+$/, "");

  if (!baseOrigin) {
    throw new ApiError(500, "Client origin is not configured for Cashfree return URLs.");
  }

  const safePath = sanitizeReturnPath(returnPath, fallbackPath);
  const url = new URL(safePath, `${baseOrigin}/`);
  url.searchParams.set("cashfree_return", "1");
  url.searchParams.set("payment_attempt_id", paymentAttemptId);
  return url.toString();
};

const verifyCashfreeWebhookSignature = (signature, timestamp, rawBody) => {
  ensureCashfreeWebhookConfigured();

  const rawPayload = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody || "");

  if (!rawPayload) {
    throw new ApiError(400, "Webhook body is missing.");
  }

  const receivedSignature = String(signature || "").trim();
  const receivedTimestamp = String(timestamp || "").trim();

  if (!receivedSignature || !receivedTimestamp) {
    throw new ApiError(400, "Cashfree webhook signature headers are missing.");
  }

  const timestampMs = Number(receivedTimestamp);

  if (!Number.isFinite(timestampMs)) {
    throw new ApiError(400, "Cashfree webhook timestamp is invalid.");
  }

  const toleranceMs = Math.max(0, env.cashfree.webhookToleranceSeconds) * 1000;
  if (toleranceMs > 0 && Math.abs(Date.now() - timestampMs) > toleranceMs) {
    throw new ApiError(401, "Cashfree webhook timestamp is outside the allowed window.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.cashfree.webhookSecret)
    .update(receivedTimestamp + rawPayload, "utf8")
    .digest("base64");

  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid Cashfree webhook signature.");
  }
};

module.exports = {
  buildCashfreeReturnUrl,
  createRemoteCashfreeOrder,
  ensureCashfreeCheckoutConfigured,
  ensureCashfreeWebhookConfigured,
  getRemoteCashfreeOrder,
  listRemoteCashfreePayments,
  verifyCashfreeWebhookSignature,
};
