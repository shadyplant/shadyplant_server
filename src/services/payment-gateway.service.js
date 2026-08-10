const crypto = require("crypto");
const QRCode = require("qrcode");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");
const {
  assertPaymentGatewayProviderConfigured,
  resolveActivePaymentGatewayProvider,
} = require("./payment-gateway-settings.service");

const PHONEPE_API_BASE_URLS = {
  sandbox: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  production: "https://api.phonepe.com/apis/pg",
};

const PHONEPE_AUTH_URLS = {
  sandbox: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
  production: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
};

const CASHFREE_API_BASE_URLS = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

let phonePeAccessTokenCache = {
  token: "",
  expiresAtMs: 0,
};

const normalizeString = (value) => String(value || "").trim();

const normalizeProvider = (value) => normalizeString(value).toLowerCase();

const toUtf8Buffer = (value) => Buffer.from(String(value || ""), "utf8");

const isTimingSafeEqual = (left, right) => {
  const leftBuffer = toUtf8Buffer(left);
  const rightBuffer = toUtf8Buffer(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const parseJsonSafely = async (response) => response.json().catch(() => null);

const buildGatewayErrorMessage = (payload, fallbackMessage) => {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.code === "string" && payload.code.trim()) {
    return payload.code.trim();
  }

  if (typeof payload?.type === "string" && payload.type.trim()) {
    return payload.type.trim();
  }

  return fallbackMessage;
};

const resolveProvider = async (explicitProvider) => {
  const provider = normalizeProvider(
    explicitProvider || (await resolveActivePaymentGatewayProvider()),
  );

  if (!provider) {
    throw new ApiError(503, "No payment gateway provider is active right now.");
  }

  return provider;
};

const ensurePaymentGatewayCheckoutConfigured = async (explicitProvider) => {
  const provider = await resolveProvider(explicitProvider);
  assertPaymentGatewayProviderConfigured(provider);
  return provider;
};

const ensurePaymentGatewayWebhookConfigured = async (explicitProvider) => {
  const provider = await resolveProvider(explicitProvider);
  assertPaymentGatewayProviderConfigured(provider);

  if (
    provider === "phonepe" &&
    !env.paymentGateway.phonepe.isWebhookConfigured
  ) {
    throw new ApiError(
      503,
      "PhonePe webhook is not configured on the server yet. Add the webhook credentials first.",
    );
  }

  if (
    provider === "cashfree" &&
    !env.paymentGateway.cashfree.isWebhookConfigured
  ) {
    throw new ApiError(
      503,
      "Cashfree webhook is not configured on the server yet. Add the webhook credentials first.",
    );
  }

  return provider;
};

const getPhonePeApiBaseUrl = () =>
  PHONEPE_API_BASE_URLS[env.paymentGateway.mode] || PHONEPE_API_BASE_URLS.sandbox;

const getPhonePeAuthUrl = () =>
  PHONEPE_AUTH_URLS[env.paymentGateway.mode] || PHONEPE_AUTH_URLS.sandbox;

const getCashfreeApiBaseUrl = () =>
  CASHFREE_API_BASE_URLS[env.paymentGateway.mode] || CASHFREE_API_BASE_URLS.sandbox;

const fetchPhonePeAccessToken = async () => {
  await ensurePaymentGatewayCheckoutConfigured("phonepe");

  const now = Date.now();
  if (
    phonePeAccessTokenCache.token &&
    phonePeAccessTokenCache.expiresAtMs - now > 60 * 1000
  ) {
    return phonePeAccessTokenCache.token;
  }

  const requestBody = new URLSearchParams({
    client_id: env.paymentGateway.phonepe.clientId,
    client_version: env.paymentGateway.phonepe.clientVersion,
    client_secret: env.paymentGateway.phonepe.clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(getPhonePeAuthUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody.toString(),
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok || !payload?.access_token) {
    throw new ApiError(
      502,
      buildGatewayErrorMessage(
        payload,
        "Unable to authorize with PhonePe.",
      ),
    );
  }

  const expiresAtSeconds = Number(payload.expires_at || 0);
  phonePeAccessTokenCache = {
    token: String(payload.access_token),
    expiresAtMs: expiresAtSeconds > 0 ? expiresAtSeconds * 1000 : now + 10 * 60 * 1000,
  };

  return phonePeAccessTokenCache.token;
};

const requestPhonePeJson = async (
  pathname,
  { method = "GET", body, searchParams } = {},
) => {
  await ensurePaymentGatewayCheckoutConfigured("phonepe");

  const accessToken = await fetchPhonePeAccessToken();
  const url = new URL(`${getPhonePeApiBaseUrl()}${pathname}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${accessToken}`,
      "X-REQUEST-ID": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new ApiError(
      502,
      buildGatewayErrorMessage(
        payload,
        "Unable to complete the PhonePe request.",
      ),
    );
  }

  return payload;
};

const requestCashfreeJson = async (
  pathname,
  { method = "GET", body, searchParams } = {},
) => {
  await ensurePaymentGatewayCheckoutConfigured("cashfree");

  const url = new URL(`${getCashfreeApiBaseUrl()}${pathname}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-client-id": env.paymentGateway.cashfree.clientId,
      "x-client-secret": env.paymentGateway.cashfree.clientSecret,
      "x-api-version": env.paymentGateway.cashfree.apiVersion,
      "x-request-id": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new ApiError(
      502,
      buildGatewayErrorMessage(
        payload,
        "Unable to complete the Cashfree request.",
      ),
    );
  }

  return payload;
};

const toCashfreeAmountRupees = (amountPaisa) =>
  Number((Number(amountPaisa || 0) / 100).toFixed(2));

const toPaisaAmount = (amountRupees) =>
  Math.round(Number(amountRupees || 0) * 100);

const buildQrCodeDataUrl = async (value) => {
  const paymentUrl = normalizeString(value);

  if (!paymentUrl) {
    return "";
  }

  return QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
  });
};

const buildPaymentWebhookUrl = () => {
  const baseUrl = normalizeString(env.server.publicBaseUrl).replace(/\/+$/, "");

  if (!baseUrl) {
    return "";
  }

  return `${baseUrl}/api/v1/payments/webhook`;
};

const createPhonePeOrder = async (input) => {
  const payload = await requestPhonePeJson("/checkout/v2/pay", {
    method: "POST",
    body: input,
  });

  return {
    provider: "phonepe",
    merchantOrderId: input.merchantOrderId,
    orderId: payload.orderId,
    redirectUrl: payload.redirectUrl,
    paymentSessionId: "",
    amount: payload.amount,
    state: payload.state,
    expireAt: payload.expireAt || null,
    raw: payload,
  };
};

const createCashfreeOrder = async (input) => {
  const payload = {
    customer_details: {
      customer_email: normalizeString(input.customerEmail || ""),
      customer_name: normalizeString(input.customerName || ""),
      customer_phone: normalizeString(
        input.customerPhone ||
          input.prefillUserLoginDetails?.phoneNumber ||
          "",
      ),
    },
    link_amount: toCashfreeAmountRupees(input.amount),
    link_auto_reminders: true,
    link_currency: normalizeString(input.currency || "INR") || "INR",
    link_expiry_time:
      Number(input.expireAfter || 0) > 0
        ? new Date(Date.now() + Number(input.expireAfter) * 1000).toISOString()
        : undefined,
    link_id: input.merchantOrderId,
    link_meta: {
      notify_url: buildPaymentWebhookUrl() || undefined,
      return_url: normalizeString(input.returnUrl),
      upi_intent: false,
    },
    link_notes: {
      payment_attempt_id: normalizeString(input.merchantOrderId),
      description: normalizeString(input.description || input.paymentFlow?.message),
    },
    link_notify: {
      send_email: true,
      send_sms: false,
      send_whatsapp: false,
    },
    link_partial_payments: false,
    link_purpose: normalizeString(input.description || input.paymentFlow?.message),
    enable_invoice: false,
  };

  const response = await requestCashfreeJson("/links", {
    method: "POST",
    body: payload,
  });

  const paymentLinkUrl = normalizeString(response.link_url);

  return {
    provider: "cashfree",
    merchantOrderId: input.merchantOrderId,
    orderId: response.link_id || response.cf_link_id || input.merchantOrderId,
    redirectUrl: paymentLinkUrl,
    paymentSessionId: "",
    qrCodeDataUrl: await buildQrCodeDataUrl(paymentLinkUrl),
    amount: toPaisaAmount(response.link_amount || payload.link_amount),
    state: response.link_status || "ACTIVE",
    expireAt: response.link_expiry_time || null,
    raw: response,
  };
};

const createRemotePaymentOrder = async (input, options = {}) => {
  const provider = await ensurePaymentGatewayCheckoutConfigured(options.provider);

  if (provider === "cashfree") {
    return createCashfreeOrder(input);
  }

  return createPhonePeOrder(input);
};

const getPhonePeRemoteOrderStatus = async (
  merchantOrderId,
  { details = false, errorContext = true } = {},
) =>
  requestPhonePeJson(
    `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
    {
      searchParams: {
        details,
        errorContext,
      },
    },
  );

const normalizeCashfreeOrderState = (value) => {
  const status = normalizeString(value).toUpperCase();

  if (status === "PAID") {
    return "COMPLETED";
  }

  if (["EXPIRED", "TERMINATED", "CANCELLED"].includes(status)) {
    return "FAILED";
  }

  return status || "ACTIVE";
};

const getCashfreeRemoteOrderStatus = async (merchantOrderId) => {
  const link = await requestCashfreeJson(
    `/links/${encodeURIComponent(merchantOrderId)}`,
  );

  let orders = [];
  try {
    const orderList = await requestCashfreeJson(
      `/links/${encodeURIComponent(merchantOrderId)}/orders`,
      {
        searchParams: {
          status: "PAID",
        },
      },
    );

    orders = Array.isArray(orderList)
      ? orderList
      : Array.isArray(orderList?.orders)
        ? orderList.orders
        : [];
  } catch {
    orders = [];
  }

  const successfulOrder =
    orders.find((order) => normalizeString(order?.order_status).toUpperCase() === "PAID") ||
    orders[0] ||
    null;
  const derivedState =
    normalizeCashfreeOrderState(successfulOrder?.order_status) ||
    normalizeCashfreeOrderState(link.link_status);

  return {
    merchantOrderId: link.link_id || merchantOrderId,
    orderId:
      successfulOrder?.cf_order_id ||
      successfulOrder?.order_id ||
      link.cf_link_id ||
      link.link_id ||
      merchantOrderId,
    state: derivedState,
    amount: toPaisaAmount(link.link_amount),
    paymentDetails: successfulOrder
      ? [
          {
            transactionId: normalizeString(
              successfulOrder.payment_session_id || successfulOrder.cf_order_id,
            ),
            paymentMode: normalizeString(
              successfulOrder.payment_method || successfulOrder.payment_group,
            ),
            state: normalizeString(successfulOrder.order_status || "PAID"),
            amount: toPaisaAmount(successfulOrder.order_amount || link.link_amount),
            errorCode: "",
            detailedErrorCode: "",
            instrument: successfulOrder.payment_method || {},
            raw: successfulOrder,
          },
        ]
      : [],
    raw: {
      link,
      orders,
    },
  };
};

const getRemotePaymentOrderStatus = async (
  merchantOrderId,
  options = {},
) => {
  const provider = await ensurePaymentGatewayCheckoutConfigured(options.provider);

  if (provider === "cashfree") {
    return getCashfreeRemoteOrderStatus(merchantOrderId);
  }

  return getPhonePeRemoteOrderStatus(merchantOrderId, options);
};

const sanitizeReturnPath = (returnPath, fallbackPath) => {
  const candidate = normalizeString(returnPath);

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallbackPath;
  }

  return candidate;
};

const buildPaymentReturnUrl = (
  returnPath,
  paymentAttemptId,
  fallbackPath = "/order-summary",
) => {
  const baseOrigin = normalizeString(env.paymentGateway.callbackOrigin).replace(/\/\/+$/, "");

  if (!baseOrigin) {
    throw new ApiError(500, "Payment callback origin is not configured for payment return URLs.");
  }

  const safePath = sanitizeReturnPath(returnPath, fallbackPath);
  const url = new URL(safePath, `${baseOrigin}/`);
  url.searchParams.set("payment_return", "1");
  url.searchParams.set("payment_attempt_id", paymentAttemptId);
  return url.toString();
};

const buildExpectedPhonePeWebhookAuthorizationValue = () => {
  const username = env.paymentGateway.phonepe.webhookUsername;
  const password = env.paymentGateway.phonepe.webhookPassword;
  const pair = `${username}:${password}`;

  return `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
};

const verifyPhonePeWebhookAuthorization = (authorizationHeader) => {
  const receivedAuthorization = normalizeString(authorizationHeader);
  if (!receivedAuthorization) {
    throw new ApiError(401, "Payment gateway webhook authorization header is missing.");
  }

  const expectedAuthorization = buildExpectedPhonePeWebhookAuthorizationValue();

  if (!isTimingSafeEqual(receivedAuthorization, expectedAuthorization)) {
    throw new ApiError(401, "Invalid payment gateway webhook authorization.");
  }
};

const verifyCashfreeWebhookSignature = ({ signature, timestamp, rawBody }) => {
  const normalizedSignature = normalizeString(signature);
  const normalizedTimestamp = normalizeString(timestamp);
  const rawPayload =
    Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");

  if (!normalizedSignature || !normalizedTimestamp || !rawPayload) {
    throw new ApiError(401, "Cashfree webhook signature headers are missing.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.paymentGateway.cashfree.webhookSecret)
    .update(`${normalizedTimestamp}${rawPayload}`, "utf8")
    .digest("base64");

  if (!isTimingSafeEqual(normalizedSignature, expectedSignature)) {
    throw new ApiError(401, "Invalid Cashfree webhook signature.");
  }
};

const inferWebhookProvider = ({ authorization, signature, event }) => {
  if (normalizeString(signature)) {
    return "cashfree";
  }

  if (normalizeString(authorization).startsWith("Basic ")) {
    return "phonepe";
  }

  const normalizedType = normalizeString(event?.type || event?.event);
  if (normalizedType.startsWith("PAYMENT_")) {
    return "cashfree";
  }

  if (event?.data?.merchantOrderId || event?.payload?.merchantOrderId) {
    return "phonepe";
  }

  return "";
};

const verifyPaymentGatewayWebhookAuthorization = async ({
  authorization,
  signature,
  timestamp,
  rawBody,
  event,
}) => {
  const provider = inferWebhookProvider({
    authorization,
    signature,
    event,
  });

  if (!provider) {
    throw new ApiError(400, "Unable to determine the payment gateway webhook provider.");
  }

  await ensurePaymentGatewayWebhookConfigured(provider);

  if (provider === "cashfree") {
    verifyCashfreeWebhookSignature({
      signature,
      timestamp,
      rawBody,
    });
    return provider;
  }

  verifyPhonePeWebhookAuthorization(authorization);
  return provider;
};

module.exports = {
  buildPaymentReturnUrl,
  createRemotePaymentOrder,
  ensurePaymentGatewayCheckoutConfigured,
  ensurePaymentGatewayWebhookConfigured,
  getRemotePaymentOrderStatus,
  resolveProvider,
  verifyPaymentGatewayWebhookAuthorization,
};
