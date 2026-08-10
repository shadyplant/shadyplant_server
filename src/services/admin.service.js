const {
  createCouponCode,
  deleteCouponCode,
  findCouponCodeByCode,
  findCouponCodeById,
  listCouponCodes,
  updateCouponCode,
} = require("../repositories/coupon.repository");
const {
  adjustProductStock,
  createProduct,
  deleteProduct,
  findProductById,
  findProductsBySkuReferences,
  findProductsBySkus,
  listProducts,
  setProductStock,
  updateProduct,
} = require("../repositories/product.repository");
const {
  countRequestedProductStockAlertsByProductIds,
  listRequestedProductStockAlertsByProductId,
} = require("../repositories/product-stock-alert.repository");
const {
  createProductStockAdjustmentLog,
  listProductStockAdjustmentLogs,
} = require("../repositories/product-stock-adjustment-log.repository");
const {
  REVIEW_STATUSES,
  deleteProductReview,
  findProductReviewById,
  listProductReviews,
  updateProductReview,
} = require("../repositories/product-review.repository");
const {
  createService,
  deleteService,
  findServiceById,
  listServicesByOrganizationId,
  updateService,
} = require("../repositories/service-catalog.repository");
const {
  countStaffAccounts,
  createOrganization,
  createStaffAccount,
  deleteStaffAccount,
  findOrganizationById,
  findOrganizationBySlug,
  findStaffAccountByEmail,
  findStaffAccountById,
  listStaffAccountsByOrganizationId,
  updateStaffAccount,
} = require("../repositories/staff.repository");
const {
  clearFailedLoginAttempts,
  getLockoutState,
  recordFailedLoginAttempt,
} = require("../repositories/login-attempt.repository");
const {
  createUser,
  findUserById,
  findUserByEmail,
  findUserByPhone,
  listUsers,
  updateUser,
} = require("../repositories/user.repository");
const {
  findOrderById,
  listAllOrders,
  updateOrder,
} = require("../repositories/order.repository");
const {
  findPaymentAttemptById,
  listAllPaymentAttempts,
} = require("../repositories/payment.repository");
const { env } = require("../config/env");
const { sendEmail, sendGreetingEmail } = require("../mailer");
const { sendPushNotificationToRecipients } = require("./push-notification.service");
const { addBrevoWelcomeContact } = require("./brevo.service");
const { ApiError } = require("../utils/apiError");
const { comparePassword, hashPassword, validatePasswordStrength } = require("../utils/password");
const { isValidEmail, isValidPhoneNumber, normalizeEmail } = require("../utils/validators");
const {
  addCartItem,
  getUserCart,
  removeCartItem,
  updateCartItemQuantity,
} = require("./cart.service");
const {
  getPaymentGatewayAdminSettings,
  updateActivePaymentGatewayProvider,
} = require("./payment-gateway-settings.service");
const {
  createCartPaymentCheckout,
  previewCartCheckout,
} = require("./checkout.service");
const {
  reconcilePaymentAttemptStatus,
} = require("./payment.service");
const {
  ORDER_CANCELLATION_REASONS,
  ORDER_STATUS_KEYS,
  REFUND_REQUEST_STATUSES,
  appendTrackingEntryToStatus,
  buildOrderRefundRequest,
  buildPaymentDetailsWithRefundRequest,
  ensureTrackingStatusEntry,
  notifyOrderPrimaryStatus,
  normalizeOrderCurrentStatus,
  normalizeStoredTrackingTimeline,
  serializeOrder,
} = require("./order.service");
const {
  createOrderStatusNotification,
} = require("./notification.service");
const { syncProductsFromSheet } = require("./product-sync.service");
const {
  CUSTOMER_CATEGORIES,
  DEFAULT_PAYMENT_ACCESS,
  normalizeUserPaymentAccess,
  PAYMENT_METHODS,
  USER_ACCOUNT_STATUSES,
  normalizeCustomerCategory,
  normalizeUserAccountStatus,
  resolveUserPaymentAccess,
  resolveEffectiveUserAccountStatus,
} = require("./user-account.service");
const {
  COUPON_STATUSES,
  COUPON_TYPES,
  COUPON_USAGE_MODES,
  calculateCouponApplication,
  generateCouponCode,
  normalizeCouponCode,
  normalizeCouponStatus,
  normalizeCouponType,
  normalizeDiscountPercent,
  normalizeWholeAmount,
  resolveCouponEffectiveStatus,
} = require("./coupon.service");
const { signStaffAccessToken } = require("./token.service");

const STAFF_ROLES = ["owner", "admin", "manager", "catalog", "operations", "support"];

const STAFF_ROLE_RANK = {
  support: 1,
  operations: 2,
  catalog: 3,
  manager: 4,
  admin: 5,
  owner: 6,
};
const PAYMENT_METHOD_LABELS = {
  cash_on_delivery: "Cash on delivery",
  online_payment: "Online payment",
  emi: "EMI",
  bank_transfer: "Bank transfer",
};
const ORDER_PAYMENT_STATUS_LABELS = {
  pay_on_delivery: "Pay on delivery",
  paid: "Paid online",
  awaiting_confirmation: "Awaiting confirmation",
};
const PAYMENT_ATTEMPT_STATUS_LABELS = {
  created: "Draft created",
  checkout_ready: "Checkout ready",
  processing: "Payment processing",
  completed: "Payment verified",
  failed: "Payment failed",
};
const SAMPLE_COUPON_PRODUCT_TOTAL = 2000;
const SAMPLE_COUPON_DELIVERY_CHARGE = 250;
const DEFAULT_ADMIN_ORDER_LIST_LIMIT = 100;
const MAX_ADMIN_ORDER_LIST_LIMIT = 200;
const STOCK_ADJUSTMENT_REASON_RULES = {
  add: new Set(["received", "audit_found", "return_restock", "manual_correction"]),
  adjust: new Set(["audit_correction", "damaged", "expired", "shrinkage", "manual_correction"]),
};

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))]
    : [];

const normalizeString = (value) => String(value || "").trim();
const normalizeOptionalInteger = (value) => {
  const parsedValue = Math.floor(Number(value));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
};

const sendWelcomeEmailBestEffort = async ({ to, customerName, source }) => {
  console.info("[Mailer] Sending native welcome email", {
    to,
    source,
  });

  try {
    const result = await sendGreetingEmail({
      to,
      customerName,
      source,
    });

    console.info("[Mailer] Native welcome email finished", {
      to,
      source,
      skipped: Boolean(result?.skipped),
      delivered: Boolean(result?.delivered),
      transport: result?.transport || env.mailer.transport,
    });

    return result;
  } catch (error) {
    console.error("[Mailer] Native welcome email failed", {
      to,
      source,
      message: error?.message || String(error),
      stack: error?.stack || null,
    });

    return null;
  }
};

const parseMailRecipients = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  return String(value || "")
    .split(/[\n,;]/)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
};

const validateMailRecipients = (recipients) => {
  const normalizedRecipients = [
    ...new Set(
      parseMailRecipients(recipients)
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean),
    ),
  ];

  if (!normalizedRecipients.length) {
    throw new ApiError(400, "At least one recipient email is required.");
  }

  const invalidRecipients = normalizedRecipients.filter(
    (recipient) => !isValidEmail(recipient),
  );

  if (invalidRecipients.length) {
    throw new ApiError(
      400,
      `Invalid recipient email address${invalidRecipients.length > 1 ? "es" : ""}: ${invalidRecipients.join(", ")}`,
    );
  }

  return normalizedRecipients;
};

const sendAdminMailMessage = async ({
  recipients,
  subject,
  html,
  text,
  source = "admin-mailer",
}) => {
  const normalizedRecipients = validateMailRecipients(recipients);
  const normalizedSubject = normalizeString(subject);
  const normalizedHtml = String(html || "").trim();
  const normalizedText = String(text || "").trim();

  if (!normalizedSubject) {
    throw new ApiError(400, "Email subject is required.");
  }

  if (!normalizedHtml && !normalizedText) {
    throw new ApiError(400, "Email body is required.");
  }

  console.info("[Mailer] Sending admin message", {
    source,
    recipients: normalizedRecipients,
    subject: normalizedSubject,
    hasHtml: Boolean(normalizedHtml),
    hasText: Boolean(normalizedText),
    from: env.mailer.aliasUser || env.mailer.fromEmail,
    replyTo: env.mailer.replyTo || null,
  });

  try {
    const result = await sendEmail({
      to: normalizedRecipients,
      subject: normalizedSubject,
      html: normalizedHtml,
      text: normalizedText,
      tags: ["admin-mailer", source].filter(Boolean),
      metadata: {
        source,
        recipientCount: normalizedRecipients.length,
      },
    });

    console.info("[Mailer] Admin message processed", {
      source,
      recipients: normalizedRecipients,
      subject: normalizedSubject,
      skipped: Boolean(result?.skipped),
      delivered: Boolean(result?.delivered),
      transport: result?.transport || env.mailer.transport,
      messageId: result?.messageId || null,
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || null,
    });

    return result;
  } catch (error) {
    console.error("[Mailer] Admin message failed", {
      source,
      recipients: normalizedRecipients,
      subject: normalizedSubject,
      message: error?.message || String(error),
      stack: error?.stack || null,
    });

    throw new ApiError(503, "Unable to send email right now. Please try again.");
  }
};

const normalizeAdminMailMode = (value) =>
  String(value || "").trim().toLowerCase() === "text" ? "text" : "html";

const buildAdminMailDraftPrompt = ({
  prompt,
  mode,
  subject,
  currentBody,
}) => {
  const normalizedMode = normalizeAdminMailMode(mode);
  const systemMessage = [
    "You are an expert ecommerce email copywriter for a plant nursery brand.",
    `Write only ${normalizedMode === "html" ? "HTML" : "plain text"} content.`,
    normalizedMode === "html"
      ? "Return a mobile-friendly HTML fragment only. Do not include markdown fences, <html>, <body>, or code blocks."
      : "Return plain text only. Do not include markdown fences.",
    "Keep the copy polished, concise, and customer-friendly.",
    "Do not mention that you are AI.",
  ].join(" ");

  const userMessage = [
    `Email mode: ${normalizedMode}.`,
    subject ? `Subject: ${subject}` : "",
    currentBody ? `Current draft to improve or replace:\n${currentBody}` : "",
    `Request: ${prompt}`,
    normalizedMode === "html"
      ? "If useful, include short paragraphs, bullet lists, and a call-to-action button style link using inline HTML only."
      : "Use clear line breaks and readable spacing.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { systemMessage, userMessage };
};

const parseOpenRouterDraft = (content, mode) => {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent) {
    return "";
  }

  return normalizedContent
    .replace(/^```(?:html|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

const generateAdminMailDraft = async ({
  prompt,
  mode,
  subject = "",
  currentBody = "",
} = {}) => {
  const normalizedPrompt = normalizeString(prompt);
  const normalizedSubject = normalizeString(subject);
  const normalizedCurrentBody = String(currentBody || "").trim();
  const normalizedMode = normalizeAdminMailMode(mode);

  if (!normalizedPrompt) {
    throw new ApiError(400, "AI prompt is required.");
  }

  if (!env.openrouter.isConfigured) {
    console.warn("[OpenRouter] Skipping mail draft generation: configuration is missing.", {
      model: env.openrouter.model || null,
      hasApiKey: Boolean(env.openrouter.apiKey),
    });
    throw new ApiError(503, "AI writer is not configured on the server.");
  }

  const { systemMessage, userMessage } = buildAdminMailDraftPrompt({
    prompt: normalizedPrompt,
    mode: normalizedMode,
    subject: normalizedSubject,
    currentBody: normalizedCurrentBody,
  });

  console.info("[OpenRouter] Generating mail draft", {
    mode: normalizedMode,
    subject: normalizedSubject || null,
    promptLength: normalizedPrompt.length,
    currentBodyLength: normalizedCurrentBody.length,
    model: env.openrouter.model,
  });

  const response = await fetch(
    `${String(env.openrouter.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openrouter.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "HTTP-Referer": env.openrouter.siteUrl || "http://localhost",
        "X-Title": env.appName,
      },
      body: JSON.stringify({
        model: env.openrouter.model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1400,
      }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("[OpenRouter] Draft generation failed", {
      status: response.status,
      data: payload,
      model: env.openrouter.model,
    });
    throw new ApiError(
      503,
      "AI writer failed to generate the draft. Please try again.",
    );
  }

  const rawContent = payload?.choices?.[0]?.message?.content || "";
  const body = parseOpenRouterDraft(rawContent, normalizedMode);

  if (!body) {
    console.error("[OpenRouter] Draft generation returned empty content", {
      payload,
    });
    throw new ApiError(503, "AI writer returned an empty draft.");
  }

  console.info("[OpenRouter] Draft generation succeeded", {
    mode: normalizedMode,
    subject: normalizedSubject || null,
    draftLength: body.length,
  });

  return {
    mode: normalizedMode,
    body,
    subject: normalizedSubject || null,
  };
};

const getAccountLockoutMessage = (retryAfterSeconds) => {
  const retryAfterMinutes = Math.max(
    1,
    Math.ceil(Number(retryAfterSeconds || 0) / 60),
  );

  return `Too many failed login attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`;
};

const resolveCurrency = (...values) => {
  for (const value of values) {
    const normalizedValue = normalizeString(value);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "INR";
};

const resolveAmount = (...values) => {
  for (const value of values) {
    const amount = Number(value);

    if (Number.isFinite(amount) && amount >= 0) {
      return Math.round(amount);
    }
  }

  return 0;
};

const resolveOrderTotal = (pricing = {}) =>
  resolveAmount(
    pricing?.grandTotal,
    pricing?.finalAmount,
    pricing?.totalAmount,
    pricing?.total,
    pricing?.payableAmount,
    pricing?.subtotal,
  );

const sanitizeStaffAccount = (staffAccount, organization = null) => ({
  id: staffAccount.id,
  organizationId: staffAccount.organizationId,
  fullName: staffAccount.fullName,
  email: staffAccount.email,
  role: staffAccount.role,
  status: staffAccount.status,
  lastLoginAt: staffAccount.lastLoginAt,
  createdAt: staffAccount.createdAt,
  updatedAt: staffAccount.updatedAt,
  organization: organization
    ? {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
      }
    : undefined,
});

const sanitizeCustomer = (user) => {
  const accountStatus = resolveEffectiveUserAccountStatus(user);

  return {
    id: user.id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    email: user.email,
    authProvider: user.authProvider,
    profileImage: user.profileImage,
    isVerified: Boolean(user.isVerified),
    isVip: Boolean(user.isVip),
    paymentAccess: resolveUserPaymentAccess(user),
    customerCategory: normalizeCustomerCategory(user.customerCategory),
    accountStatus,
    bannedUntil:
      accountStatus === USER_ACCOUNT_STATUSES.bannedTemporary
        ? user.bannedUntil || null
        : null,
    banReason: String(user.banReason || "").trim(),
    deliveryAddress: user.deliveryAddress || {},
    billingDetails: user.billingDetails || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const normalizeAdminCheckoutLocation = (value = {}) => ({
  lat: Number(value?.lat),
  lng: Number(value?.lng),
});

const buildAdminCheckoutAddressFromCustomer = (customer = {}) => ({
  formattedAddress: String(customer.deliveryAddress?.formattedAddress || "").trim(),
  line1: String(customer.deliveryAddress?.line1 || "").trim(),
  line2: String(customer.deliveryAddress?.line2 || "").trim(),
  city: String(customer.deliveryAddress?.city || "").trim(),
  state: String(customer.deliveryAddress?.state || "").trim(),
  postalCode: String(customer.deliveryAddress?.postalCode || "").trim(),
  landmark: String(customer.deliveryAddress?.landmark || "").trim(),
  notes: String(customer.deliveryAddress?.notes || "").trim(),
});

const buildAdminCheckoutBillingDetails = (
  customer = {},
  deliveryAddress = {},
  overrides = {},
) => {
  const customerBilling = customer.billingDetails || {};

  return {
    name:
      normalizeString(overrides.name) ||
      normalizeString(customerBilling.name) ||
      normalizeString(customer.fullName) ||
      "Customer",
    contact:
      normalizeString(overrides.contact) ||
      normalizeString(customerBilling.contact) ||
      normalizeString(customer.phoneNumber),
    email: normalizeString(overrides.email) || normalizeString(customer.email),
    address:
      normalizeString(overrides.address) ||
      normalizeString(customerBilling.address) ||
      normalizeString(deliveryAddress.line1) ||
      normalizeString(deliveryAddress.formattedAddress),
    city:
      normalizeString(overrides.city) ||
      normalizeString(customerBilling.city) ||
      normalizeString(deliveryAddress.city),
    state:
      normalizeString(overrides.state) ||
      normalizeString(customerBilling.state) ||
      normalizeString(deliveryAddress.state),
    gstin: normalizeString(overrides.gstin) || normalizeString(customerBilling.gstin),
  };
};

const normalizeAdminCustomerCartCheckoutPayload = (customer = {}, payload = {}) => {
  const defaultDeliveryAddress = buildAdminCheckoutAddressFromCustomer(customer);
  const nextDeliveryAddress =
    payload.deliveryAddress && typeof payload.deliveryAddress === "object"
      ? {
          ...defaultDeliveryAddress,
          ...payload.deliveryAddress,
        }
      : defaultDeliveryAddress;

  return {
    deliveryAddress: nextDeliveryAddress,
    deliveryLocation: normalizeAdminCheckoutLocation(payload.deliveryLocation || {}),
    billingDetails: buildAdminCheckoutBillingDetails(
      customer,
      nextDeliveryAddress,
      payload.billingDetails && typeof payload.billingDetails === "object"
        ? payload.billingDetails
        : {},
    ),
    couponCode: normalizeString(payload.couponCode).toUpperCase(),
    paymentMethod: normalizeString(payload.paymentMethod) || PAYMENT_METHODS.onlinePayment,
  };
};

const serializeAdminPaymentAttempt = (paymentAttempt) => ({
  id: paymentAttempt.id,
  paymentAttemptId: paymentAttempt.id,
  status: paymentAttempt.status,
  statusLabel:
    PAYMENT_ATTEMPT_STATUS_LABELS[paymentAttempt.status] || "Payment update pending",
  orderId: paymentAttempt.orderId || null,
  amount: resolveAmount(paymentAttempt.amount),
  currency: resolveCurrency(paymentAttempt.currency, "INR"),
  paymentMethod: paymentAttempt.paymentMethod,
  paymentMethodLabel:
    PAYMENT_METHOD_LABELS[paymentAttempt.paymentMethod] || "Payment",
  failureReason: paymentAttempt.failureReason || "",
  provider: normalizeString(paymentAttempt.gateway?.provider) || null,
  merchantOrderId:
    normalizeString(paymentAttempt.gateway?.merchantOrderId) || paymentAttempt.id,
  gatewayOrderId: normalizeString(paymentAttempt.gateway?.gatewayOrderId) || null,
  redirectUrl: normalizeString(paymentAttempt.gateway?.redirectUrl) || "",
  paymentSessionId: normalizeString(paymentAttempt.gateway?.paymentSessionId) || "",
  createdAt: paymentAttempt.createdAt,
  updatedAt: paymentAttempt.updatedAt,
});

const enrichAdminProductWithStockAlerts = async (
  product,
  { includeStockAlerts = false } = {},
) => {
  const stockAlertCountMap = await countRequestedProductStockAlertsByProductIds([
    product.id,
  ]);
  const stockAlerts = includeStockAlerts
    ? await listRequestedProductStockAlertsByProductId(product.id)
    : undefined;

  return {
    ...product,
    stockAlertCount: stockAlertCountMap.get(product.id) || 0,
    ...(includeStockAlerts ? { stockAlerts: stockAlerts || [] } : {}),
  };
};

const enrichAdminProductsWithStockAlertCounts = async (products = []) => {
  const stockAlertCountMap = await countRequestedProductStockAlertsByProductIds(
    products.map((product) => product.id),
  );

  return products.map((product) => ({
    ...product,
    stockAlertCount: stockAlertCountMap.get(product.id) || 0,
  }));
};

const buildOrderTransaction = (order, paymentAttempt = null) => {
  const paymentDetails = order.paymentDetails || {};
  const amount = resolveOrderTotal(order.pricing);
  const isMoneyReceived = order.paymentStatus === "paid";
  const capturedAt = normalizeString(paymentDetails.capturedAt);

  return {
    id: paymentAttempt?.id || order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    trackingCode: order.trackingCode,
    paymentAttemptId: paymentAttempt?.id || null,
    sourceType: "order",
    sourceLabel: paymentAttempt ? "Order payment" : "Order record",
    customerName: order.fullName,
    customerEmail: order.email,
    customerPhone: order.phoneNumber,
    amount,
    receivedAmount: isMoneyReceived ? amount : 0,
    outstandingAmount: isMoneyReceived ? 0 : amount,
    currency: resolveCurrency(order.pricing?.currency),
    paymentMethod: order.paymentMethod,
    paymentMethodLabel:
      order.paymentMethodLabel ||
      PAYMENT_METHOD_LABELS[order.paymentMethod] ||
      "Payment",
    paymentStatus: order.paymentStatus,
    paymentStatusLabel:
      order.paymentStatusLabel ||
      ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus] ||
      "Payment update pending",
    checkoutStatus: paymentAttempt?.status || null,
    checkoutStatusLabel: paymentAttempt
      ? PAYMENT_ATTEMPT_STATUS_LABELS[paymentAttempt.status] ||
        "Payment update pending"
      : null,
    currentStatus: order.currentStatus || null,
    provider:
      normalizeString(paymentDetails.provider) ||
      normalizeString(paymentAttempt?.gateway?.provider) ||
      null,
    gatewayOrderId:
      normalizeString(paymentDetails.gatewayOrderId) ||
      normalizeString(paymentDetails.merchantOrderId) ||
      normalizeString(paymentDetails.cashfreeOrderId) ||
      normalizeString(paymentDetails.razorpayOrderId) ||
      normalizeString(paymentAttempt?.gateway?.gatewayOrderId) ||
      normalizeString(paymentAttempt?.gateway?.merchantOrderId) ||
      normalizeString(paymentAttempt?.gateway?.orderId) ||
      null,
    gatewayPaymentId:
      normalizeString(paymentDetails.gatewayPaymentId) ||
      normalizeString(paymentDetails.cashfreePaymentId) ||
      normalizeString(paymentDetails.razorpayPaymentId) ||
      normalizeString(paymentAttempt?.gateway?.gatewayPaymentId) ||
      normalizeString(paymentAttempt?.gateway?.paymentId) ||
      null,
    failureReason: paymentAttempt?.failureReason || null,
    lastWebhookEvent:
      paymentAttempt?.lastWebhookEvent || normalizeString(paymentDetails.event) || null,
    isMoneyReceived,
    createdAt: order.createdAt,
    processedAt: paymentAttempt?.processedAt || capturedAt || null,
    updatedAt: paymentAttempt?.updatedAt || order.updatedAt || order.createdAt,
  };
};

const normalizeAdminPagination = (payload = {}) => {
  const requestedLimit = Number.parseInt(payload.limit ?? "", 10);
  const requestedOffset = Number.parseInt(payload.offset ?? "", 10);

  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_ADMIN_ORDER_LIST_LIMIT)
      : DEFAULT_ADMIN_ORDER_LIST_LIMIT;

  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0
    ? requestedOffset
    : 0;

  return { limit, offset };
};

const normalizeDateRange = (payload = {}) => {
  const from = payload.from ? new Date(payload.from) : null;
  const to = payload.to ? new Date(payload.to) : null;

  return {
    from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : undefined,
  };
};

const buildStandalonePaymentAttemptTransaction = (paymentAttempt) => {
  const checkoutPayload = paymentAttempt.checkoutPayload || {};
  const billingDetails = checkoutPayload.billingDetails || {};
  const customerName =
    normalizeString(checkoutPayload.fullName) ||
    normalizeString(billingDetails.name) ||
    "Checkout attempt";
  const customerEmail =
    normalizeString(checkoutPayload.email) ||
    normalizeString(billingDetails.email) ||
    "";
  const customerPhone =
    normalizeString(checkoutPayload.phoneNumber) ||
    normalizeString(billingDetails.contact) ||
    normalizeString(billingDetails.phoneNumber) ||
    "";
  const isMoneyReceived = paymentAttempt.status === "completed";

  return {
    id: paymentAttempt.id,
    orderId: null,
    orderNumber: null,
    trackingCode: null,
    paymentAttemptId: paymentAttempt.id,
    sourceType: "payment_attempt",
    sourceLabel: "Checkout attempt",
    customerName,
    customerEmail,
    customerPhone,
    amount: resolveAmount(paymentAttempt.amount),
    receivedAmount: isMoneyReceived ? resolveAmount(paymentAttempt.amount) : 0,
    outstandingAmount: isMoneyReceived ? 0 : resolveAmount(paymentAttempt.amount),
    currency: resolveCurrency(
      paymentAttempt.currency,
      checkoutPayload.pricing?.currency,
    ),
    paymentMethod: paymentAttempt.paymentMethod,
    paymentMethodLabel:
      PAYMENT_METHOD_LABELS[paymentAttempt.paymentMethod] || "Payment",
    paymentStatus: paymentAttempt.status,
    paymentStatusLabel:
      PAYMENT_ATTEMPT_STATUS_LABELS[paymentAttempt.status] ||
      "Payment update pending",
    checkoutStatus: paymentAttempt.status,
    checkoutStatusLabel:
      PAYMENT_ATTEMPT_STATUS_LABELS[paymentAttempt.status] ||
      "Payment update pending",
    currentStatus: null,
    provider: normalizeString(paymentAttempt.gateway?.provider) || null,
    gatewayOrderId:
      normalizeString(paymentAttempt.gateway?.gatewayOrderId) ||
      normalizeString(paymentAttempt.gateway?.merchantOrderId) ||
      normalizeString(paymentAttempt.gateway?.orderId) ||
      null,
    gatewayPaymentId:
      normalizeString(paymentAttempt.gateway?.gatewayPaymentId) ||
      normalizeString(paymentAttempt.gateway?.paymentId) ||
      null,
    failureReason: paymentAttempt.failureReason || null,
    lastWebhookEvent: paymentAttempt.lastWebhookEvent || null,
    isMoneyReceived,
    createdAt: paymentAttempt.createdAt,
    processedAt: paymentAttempt.processedAt || null,
    updatedAt: paymentAttempt.updatedAt || paymentAttempt.createdAt,
  };
};

const buildSalesReportItem = (item = {}, index = 0) => {
  const quantity = resolveAmount(item.quantity, item.qty, 1);
  const pricePerUnit = resolveAmount(
    item.price,
    item.unitPrice,
    item.finalRate,
    item.salePrice,
    0,
  );
  const amount = resolveAmount(
    item.amount,
    item.total,
    item.lineTotal,
    quantity * pricePerUnit,
  );

  return {
    sNo: index + 1,
    itemName:
      normalizeString(item.name || item.itemName || item.productName) ||
      `Item ${index + 1}`,
    hsnSac: normalizeString(item.hsnSac || item.hsn || item.sac) || null,
    quantity,
    unit: normalizeString(item.unit || item.packLabel) || null,
    pricePerUnit,
    taxablePricePerUnit: resolveAmount(
      item.taxablePricePerUnit,
      item.taxableUnitPrice,
      pricePerUnit,
    ),
    finalRate: resolveAmount(item.finalRate, pricePerUnit),
    discount: resolveAmount(item.discount),
    discountPercent: normalizeString(item.discountPercent) || null,
    amount,
  };
};

const calculateOverdueDays = (dueDate, balanceDue) => {
  if (!dueDate || balanceDue <= 0) {
    return 0;
  }

  const dueAt = new Date(dueDate);

  if (Number.isNaN(dueAt.getTime())) {
    return 0;
  }

  const diffMs = Date.now() - dueAt.getTime();

  if (diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const buildSalesReportTransaction = (order, paymentAttempt = null) => {
  const billingDetails = order.billingDetails || {};
  const pricing = order.pricing || {};
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const total = resolveOrderTotal(pricing);
  const received = order.paymentStatus === "paid" ? total : 0;
  const balanceDue = Math.max(0, total - received);
  const dueDate = order.deliveryDate || order.createdAt;
  const overdueDays = calculateOverdueDays(dueDate, balanceDue);

  return {
    id: order.id,
    orderId: order.id,
    paymentAttemptId: paymentAttempt?.id || null,
    createdAt: order.createdAt,
    date: order.createdAt,
    orderNo: order.trackingCode || order.orderNumber || order.id,
    invoiceNo: order.orderNumber || order.id,
    partyName: normalizeString(order.fullName) || "Customer",
    gstin: normalizeString(billingDetails.gstin) || null,
    partyPhone: normalizeString(order.phoneNumber) || null,
    transactionType: "Sale",
    total,
    paymentType:
      order.paymentMethodLabel ||
      PAYMENT_METHOD_LABELS[order.paymentMethod] ||
      "Payment",
    received,
    balanceDue,
    dueDate,
    status: balanceDue > 0 ? "Overdue" : "Paid",
    overdueDays,
    items: items.map((item, index) => buildSalesReportItem(item, index)),
    discount: resolveAmount(
      pricing.couponDiscountValue,
      pricing.discountValue,
      pricing.discount,
    ),
    discountPercent: normalizeString(pricing.couponDiscountPercent) || null,
    shippingCharge: resolveAmount(
      pricing.deliveryCharge,
      pricing.shippingCharge,
      pricing.transportCharge,
    ),
    paymentStatus: order.paymentStatus || null,
    currentStatus: order.currentStatus || null,
    provider:
      normalizeString(order.paymentDetails?.provider) ||
      normalizeString(paymentAttempt?.gateway?.provider) ||
      null,
  };
};

const normalizeServicePayload = (payload = {}, { partial = false } = {}) => {
  const hasName = payload.name !== undefined;
  const name = hasName ? String(payload.name || "").trim() : undefined;

  if (!partial && !name) {
    throw new ApiError(400, "Service name is required.");
  }

  return {
    slug:
      payload.slug !== undefined
        ? String(payload.slug || "").trim()
        : !partial && name
          ? slugifyValue(name)
          : undefined,
    name,
    category:
      payload.category !== undefined
        ? String(payload.category || "").trim()
        : undefined,
    price:
      payload.price !== undefined
        ? Math.max(0, Math.round(Number(payload.price || 0)))
        : undefined,
    unit: payload.unit !== undefined ? String(payload.unit || "").trim() : undefined,
    badge:
      payload.badge !== undefined ? String(payload.badge || "").trim() : undefined,
    description:
      payload.description !== undefined
        ? String(payload.description || "").trim()
        : undefined,
    image:
      payload.image !== undefined ? String(payload.image || "").trim() : undefined,
    images:
      payload.images !== undefined ? normalizeStringArray(payload.images) : undefined,
    usesImages:
      payload.usesImages !== undefined ? normalizeStringArray(payload.usesImages) : undefined,
    tags: payload.tags !== undefined ? normalizeStringArray(payload.tags) : undefined,
    isActive:
      payload.isActive === undefined
        ? partial
          ? undefined
          : true
        : Boolean(payload.isActive),
    metadata:
      payload.metadata !== undefined
        ? payload.metadata && typeof payload.metadata === "object"
          ? payload.metadata
          : {}
        : undefined,
  };
};

const normalizeProductPayload = (payload = {}, { partial = false } = {}) => {
  const name = payload.name !== undefined ? String(payload.name || "").trim() : undefined;
  const category =
    payload.category !== undefined
      ? String(payload.category || "").trim()
      : undefined;
  const variety =
    payload.variety !== undefined ? String(payload.variety || "").trim() : undefined;
  const containerSize =
    payload.containerSize !== undefined
      ? String(payload.containerSize || "").trim()
      : undefined;
  const height =
    payload.height !== undefined ? String(payload.height || "").trim() : undefined;
  const growthSpeed =
    payload.growthSpeed !== undefined ? String(payload.growthSpeed || "").trim() : undefined;
  const countryOfOrigin =
    payload.countryOfOrigin !== undefined
      ? String(payload.countryOfOrigin || "").trim()
      : undefined;
  const manufacturedBy =
    payload.manufacturedBy !== undefined
      ? String(payload.manufacturedBy || "").trim()
      : undefined;
  const marketedBy =
    payload.marketedBy !== undefined ? String(payload.marketedBy || "").trim() : undefined;
  const hsnCode =
    payload.hsnCode !== undefined ? String(payload.hsnCode || "").trim() : undefined;
  const leafColor =
    payload.leafColor !== undefined ? String(payload.leafColor || "").trim() : undefined;
  const flowerColor =
    payload.flowerColor !== undefined ? String(payload.flowerColor || "").trim() : undefined;
  const lightRequirement =
    payload.lightRequirement !== undefined
      ? String(payload.lightRequirement || "").trim()
      : undefined;
  const waterRequirement =
    payload.waterRequirement !== undefined
      ? String(payload.waterRequirement || "").trim()
      : undefined;
  const plantPlacement =
    payload.plantPlacement !== undefined
      ? String(payload.plantPlacement || "").trim()
      : undefined;
  const usageArea =
    payload.usageArea !== undefined ? String(payload.usageArea || "").trim() : undefined;
  const plantAgeMonths =
    payload.plantAgeMonths !== undefined
      ? normalizeOptionalInteger(payload.plantAgeMonths)
      : undefined;
  const productionCapacity =
    payload.productionCapacity !== undefined
      ? normalizeOptionalInteger(payload.productionCapacity)
      : undefined;
  const packagingDetails =
    payload.packagingDetails !== undefined
      ? String(payload.packagingDetails || "").trim()
      : undefined;
  const packLabel =
    payload.packLabel !== undefined
      ? String(payload.packLabel || "").trim()
      : undefined;
  const unit = payload.unit !== undefined ? String(payload.unit || "").trim() : undefined;
  const badge =
    payload.badge !== undefined ? String(payload.badge || "").trim() : undefined;
  const description =
    payload.description !== undefined
      ? String(payload.description || "").trim()
      : undefined;

  if (
    !partial &&
    (!name || !category || !packLabel || !unit || !badge || !description)
  ) {
    throw new ApiError(
      400,
      "Product name, category, pack label, unit, badge, and description are required.",
    );
  }

  const price =
    payload.price !== undefined ? Number(payload.price) : undefined;
  const mrp =
    payload.mrp !== undefined ? Number(payload.mrp) : undefined;
  const weight =
    payload.weight !== undefined ? Number(payload.weight) : undefined;

  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    throw new ApiError(400, "Product price must be zero or greater.");
  }

  if (mrp !== undefined && (!Number.isFinite(mrp) || mrp < 0)) {
    throw new ApiError(400, "Product MRP must be zero or greater.");
  }

  if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
    throw new ApiError(400, "Product weight must be greater than zero.");
  }

  return {
    id: String(payload.id || "").trim() || undefined,
    sku: payload.sku !== undefined ? String(payload.sku || "").trim() : undefined,
    skuId:
      payload.skuId !== undefined ? String(payload.skuId || "").trim() : undefined,
    name,
    category,
    variety,
    containerSize,
    height,
    growthSpeed,
    countryOfOrigin,
    manufacturedBy,
    marketedBy,
    brand:
      payload.brand !== undefined ? String(payload.brand || "").trim() : undefined,
    potMaterial:
      payload.potMaterial !== undefined
        ? String(payload.potMaterial || "").trim()
        : undefined,
    hsnCode,
    leafColor,
    flowerColor,
    lightRequirement,
    waterRequirement,
    plantPlacement,
    usageArea,
    plantAgeMonths,
    productionCapacity,
    packagingDetails,
    price,
    mrp,
    weight,
    offer:
      payload.offer !== undefined ? String(payload.offer || "").trim() : undefined,
    minOrderQuantity:
      payload.minOrderQuantity !== undefined
        ? Math.max(1, Math.round(Number(payload.minOrderQuantity || 1)))
        : undefined,
    stock:
      payload.stock !== undefined
        ? Math.max(0, Math.floor(Number(payload.stock || 0)))
        : undefined,
    isOnTrend:
      payload.isOnTrend !== undefined ? Boolean(payload.isOnTrend) : undefined,
    isFeaturedLatest:
      payload.isFeaturedLatest !== undefined
        ? Boolean(payload.isFeaturedLatest)
        : undefined,
    packLabel,
    variant:
      payload.variant !== undefined ? String(payload.variant || "").trim() : undefined,
    unit,
    badge,
    description,
    image:
      payload.image !== undefined ? String(payload.image || "").trim() : undefined,
    images:
      payload.images !== undefined ? normalizeStringArray(payload.images) : undefined,
    usesImages:
      payload.usesImages !== undefined ? normalizeStringArray(payload.usesImages) : undefined,
    videoClips:
      payload.videoClips !== undefined && Array.isArray(payload.videoClips)
        ? payload.videoClips
        : undefined,
    tags: payload.tags !== undefined ? normalizeStringArray(payload.tags) : undefined,
    status:
      payload.status !== undefined
        ? String(payload.status || "").trim().toLowerCase()
        : undefined,
    optionGroups:
      payload.optionGroups !== undefined && Array.isArray(payload.optionGroups)
        ? payload.optionGroups
        : undefined,
    detailSections:
      payload.detailSections !== undefined && Array.isArray(payload.detailSections)
        ? payload.detailSections
        : undefined,
    quantityPricingSlabs:
      payload.quantityPricingSlabs !== undefined && Array.isArray(payload.quantityPricingSlabs)
        ? payload.quantityPricingSlabs
        : undefined,
  };
};

const normalizeStaffPayload = (payload = {}) => {
  const fullName = String(payload.fullName || "").trim();
  const email = normalizeEmail(String(payload.email || "").trim());
  const role = String(payload.role || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!fullName) {
    throw new ApiError(400, "Staff full name is required.");
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Staff email format is invalid.");
  }

  if (!STAFF_ROLES.includes(role)) {
    throw new ApiError(400, "Staff role is invalid.");
  }

  return { fullName, email, role, password };
};

const canManageRole = (actorRole, targetRole) =>
  (STAFF_ROLE_RANK[actorRole] || 0) > (STAFF_ROLE_RANK[targetRole] || 0);

const assertCanManageStaffRole = (actorRole, targetRole) => {
  if (!canManageRole(actorRole, targetRole)) {
    throw new ApiError(403, "You do not have permission to manage this staff role.");
  }
};

const bootstrapAdminWorkspace = async () => {
  const bootstrapEmail = normalizeEmail(env.staff.bootstrapOwnerEmail || "");
  const bootstrapPassword = env.staff.bootstrapOwnerPassword || "";
  const bootstrapName = env.staff.bootstrapOwnerName || "";

  if (!bootstrapEmail || !bootstrapPassword || !bootstrapName) {
    return;
  }

  let organization = await findOrganizationBySlug(env.staff.bootstrapOrganizationSlug);

  if (!organization) {
    organization = await createOrganization({
      name: env.staff.bootstrapOrganizationName,
      slug: env.staff.bootstrapOrganizationSlug,
    });
  }

  const existingStaffAccount = await findStaffAccountByEmail(bootstrapEmail);

  if (existingStaffAccount) {
    return;
  }

  await createStaffAccount({
    organizationId: organization.id,
    fullName: bootstrapName,
    email: bootstrapEmail,
    passwordHash: await hashPassword(bootstrapPassword),
    role: "owner",
    status: "active",
  });

  console.log(`Bootstrapped staff owner account for ${bootstrapEmail}.`);
};

const loginStaffAccount = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(String(email || "").trim());

  if (!isValidEmail(normalizedEmail) || !password) {
    throw new ApiError(400, "Staff email and password are required.");
  }

  const lockoutState = await getLockoutState("staff", normalizedEmail);

  if (lockoutState.isLocked) {
    throw new ApiError(429, getAccountLockoutMessage(lockoutState.retryAfterSeconds));
  }

  const staffAccount = await findStaffAccountByEmail(normalizedEmail);

  if (!staffAccount && (await countStaffAccounts()) === 0) {
    throw new ApiError(
      409,
      "No staff account exists yet. Set up the initial owner account first.",
    );
  }

  if (!staffAccount || staffAccount.status !== "active") {
    await recordFailedLoginAttempt("staff", normalizedEmail, {
      windowMinutes: env.staff.loginAttemptWindowMinutes,
      maxAttempts: env.staff.loginMaxAttempts,
      lockoutMinutes: env.staff.loginLockoutMinutes,
    });
    throw new ApiError(401, "Staff email or password is incorrect.");
  }

  const passwordMatches = await comparePassword(password, staffAccount.passwordHash);

  if (!passwordMatches) {
    await recordFailedLoginAttempt("staff", normalizedEmail, {
      windowMinutes: env.staff.loginAttemptWindowMinutes,
      maxAttempts: env.staff.loginMaxAttempts,
      lockoutMinutes: env.staff.loginLockoutMinutes,
    });
    throw new ApiError(401, "Staff email or password is incorrect.");
  }

  await clearFailedLoginAttempts("staff", normalizedEmail);

  const updatedStaffAccount = await updateStaffAccount(staffAccount.id, {
    lastLoginAt: new Date(),
  });
  const organization = await findOrganizationById(updatedStaffAccount.organizationId);

  return {
    accessToken: signStaffAccessToken(updatedStaffAccount),
    staff: sanitizeStaffAccount(updatedStaffAccount, organization),
    expiresIn: env.staff.accessTokenTtl,
  };
};

const getAdminSetupStatus = async () => ({
  isSetupComplete: (await countStaffAccounts()) > 0,
});

const setupInitialAdminOwner = async (payload = {}) => {
  if ((await countStaffAccounts()) > 0) {
    throw new ApiError(
      409,
      "Staff setup is already complete. Use the admin login route instead.",
    );
  }

  const fullName = String(payload.fullName || "").trim();
  const email = normalizeEmail(String(payload.email || "").trim());
  const password = String(payload.password || "");
  const organizationName = String(
    payload.organizationName || env.staff.bootstrapOrganizationName || env.appName,
  ).trim();
  const organizationSlug = String(
    payload.organizationSlug || env.staff.bootstrapOrganizationSlug || slugifyValue(organizationName),
  ).trim();

  if (!fullName) {
    throw new ApiError(400, "Owner full name is required.");
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Owner email format is invalid.");
  }

  if (!validatePasswordStrength(password)) {
    throw new ApiError(
      400,
      "Owner password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    );
  }

  const existingStaffAccount = await findStaffAccountByEmail(email);

  if (existingStaffAccount) {
    throw new ApiError(409, "A staff account with this email already exists.");
  }

  let organization = await findOrganizationBySlug(organizationSlug);

  if (!organization) {
    organization = await createOrganization({
      name: organizationName,
      slug: organizationSlug,
    });
  }

  const createdStaffAccount = await createStaffAccount({
    organizationId: organization.id,
    fullName,
    email,
    passwordHash: await hashPassword(password),
    role: "owner",
    status: "active",
  });
  return {
    accessToken: signStaffAccessToken(createdStaffAccount),
    staff: sanitizeStaffAccount(createdStaffAccount, organization),
    expiresIn: env.staff.accessTokenTtl,
  };
};

const getCurrentStaffAccount = async (staffAccountId) => {
  const staffAccount = await findStaffAccountById(staffAccountId);

  if (!staffAccount) {
    throw new ApiError(404, "Staff account not found.");
  }

  const organization = await findOrganizationById(staffAccount.organizationId);
  return sanitizeStaffAccount(staffAccount, organization);
};

const getAdminPaymentGatewaySettings = async () => getPaymentGatewayAdminSettings();

const updateAdminPaymentGatewaySettings = async (
  actorStaffAccountId,
  payload = {},
) => {
  const actor = await findStaffAccountById(actorStaffAccountId);

  if (!actor) {
    throw new ApiError(404, "Staff account not found.");
  }

  const provider = String(payload.provider || "").trim().toLowerCase();

  return updateActivePaymentGatewayProvider({
    provider,
    updatedByStaffAccountId: actor.id,
  });
};

const listAdminProducts = async () =>
  enrichAdminProductsWithStockAlertCounts(await listProducts({}));

const getAdminProduct = async (productId) => {
  const product = await findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return enrichAdminProductWithStockAlerts(product, {
    includeStockAlerts: true,
  });
};

const createAdminProduct = async (payload) =>
  enrichAdminProductWithStockAlerts(
    await createProduct(normalizeProductPayload(payload)),
    { includeStockAlerts: true },
  );

const updateAdminProduct = async (productId, payload) => {
  console.log("[admin.service] updateAdminProduct request", {
    productId,
    payloadKeys: Object.keys(payload || {}),
    image: payload?.image,
    imagesCount: Array.isArray(payload?.images) ? payload.images.length : undefined,
    usesImagesCount: Array.isArray(payload?.usesImages) ? payload.usesImages.length : undefined,
  });

  const product = await updateProduct(
    productId,
    normalizeProductPayload(payload, { partial: true }),
  );

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  console.log("[admin.service] updateAdminProduct response", {
    productId: product.id,
    image: product.image,
    imagesCount: Array.isArray(product.images) ? product.images.length : 0,
    usesImagesCount: Array.isArray(product.usesImages) ? product.usesImages.length : 0,
  });

  return enrichAdminProductWithStockAlerts(product, {
    includeStockAlerts: true,
  });
};

const adjustAdminProductStock = async (productId, payload = {}, actor = {}) => {
  const operation = String(payload.operation || "").trim().toLowerCase();
  const reason = String(payload.reason || "").trim();
  const note = String(payload.note || "").trim();

  if (!["add", "adjust"].includes(operation)) {
    throw new ApiError(400, "Stock operation must be add or adjust.");
  }

  const quantity = Math.floor(Number(payload.quantity || 0));
  const nextStock = Math.floor(Number(payload.nextStock));

  if (operation === "add") {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, "Stock quantity must be greater than zero.");
    }
  } else if (!Number.isFinite(nextStock) || nextStock < 0) {
    throw new ApiError(400, "Adjusted stock must be zero or greater.");
  }

  const normalizedReason = reason || "manual_correction";
  const allowedReasons = STOCK_ADJUSTMENT_REASON_RULES[operation];

  if (!allowedReasons || !allowedReasons.has(normalizedReason)) {
    throw new ApiError(
      400,
      "Selected stock adjustment reason is not valid for this action.",
    );
  }

  const currentProduct = await findProductById(productId);

  if (!currentProduct) {
    throw new ApiError(404, "Product not found.");
  }

  const previousStock = Number(currentProduct.stock || 0);
  if (operation === "adjust" && nextStock === previousStock) {
    throw new ApiError(400, "Adjusted stock matches the current stock. No change to save.");
  }

  const signedDelta = operation === "adjust" ? nextStock - previousStock : quantity;
  const updatedProduct =
    operation === "adjust"
      ? await setProductStock(productId, nextStock)
      : await adjustProductStock(productId, signedDelta);

  if (!updatedProduct) {
    throw new ApiError(
      409,
      "Unable to adjust stock right now.",
    );
  }

  const adjustment = {
    operation,
    quantity: operation === "adjust" ? Math.abs(signedDelta) : quantity,
    delta: signedDelta,
    previousStock,
    currentStock: Number(updatedProduct.stock || 0),
    reason: normalizedReason,
    note: note || null,
    adjustedAt: new Date().toISOString(),
  };

  await createProductStockAdjustmentLog({
    productId: updatedProduct.id,
    productReference: updatedProduct.productId,
    productName: updatedProduct.name,
    operation,
    quantity: adjustment.quantity,
    delta: signedDelta,
    reason: normalizedReason,
    note,
    previousStock: adjustment.previousStock,
    currentStock: adjustment.currentStock,
    actor,
  });

  return {
    product: await enrichAdminProductWithStockAlerts(updatedProduct, {
      includeStockAlerts: false,
    }),
    adjustment,
  };
};

const listAdminProductStockAdjustmentLogs = async (productId, payload = {}) => {
  const product = await findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  const logs = await listProductStockAdjustmentLogs(
    product.id,
    Number(payload.limit || 20),
  );

  return {
    product: {
      id: product.id,
      productId: product.productId,
      name: product.name,
      stock: Number(product.stock || 0),
    },
    logs,
  };
};

const deleteAdminProduct = async (productId) => {
  const product = await deleteProduct(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return product;
};

const syncAdminProductsFromSheet = async (payload, options = {}) =>
  syncProductsFromSheet(payload, options);

const getAdminProductStockSnapshot = async (payload = {}) => {
  const skus = Array.isArray(payload?.skus)
    ? [...new Set(
        payload.skus.map((sku) => String(sku || "").trim()).filter(Boolean),
      )]
    : [];

  if (!skus.length) {
    throw new ApiError(400, "A skus array is required.");
  }

  if (skus.length > env.productSync.maxBatchSize) {
    throw new ApiError(
      413,
      `Stock snapshot request exceeds the maximum batch size of ${env.productSync.maxBatchSize}.`,
    );
  }

  const products = await findProductsBySkuReferences(skus);
  const productsBySkuReference = new Map();

  products.forEach((product) => {
    const productSku = String(product.sku || "").trim();
    const productSkuId = String(product.skuId || "").trim();

    if (productSku) {
      productsBySkuReference.set(productSku, product);
    }

    if (productSkuId) {
      productsBySkuReference.set(productSkuId, product);
    }
  });

  const items = skus.map((sku) => {
    const product = productsBySkuReference.get(sku);

    if (!product) {
      return {
        sku,
        found: false,
        stockQuantity: null,
        status: null,
        updatedAt: null,
      };
    }

    return {
      sku,
        found: true,
        productId: product.productId,
        internalId: product.id,
        skuId: String(product.skuId || "").trim(),
        productName: product.name,
        stockQuantity: Number(product.stock || 0),
      status: String(product.status || "active")
        .trim()
        .toLowerCase() === "inactive"
        ? "Inactive"
        : "Active",
      price: product.price,
      discountPrice: product.price,
      mrp: product.mrp,
      variant: String(product.variant || "").trim(),
      updatedAt: product.updatedAt || null,
    };
  });

  return {
    totalRequested: skus.length,
    found: items.filter((item) => item.found).length,
    missing: items.filter((item) => !item.found).length,
    items,
  };
};

const listAdminServices = async (organizationId) =>
  listServicesByOrganizationId(organizationId);

const getAdminService = async (serviceId, organizationId) => {
  const service = await findServiceById(serviceId);

  if (!service || service.organizationId !== organizationId) {
    throw new ApiError(404, "Service not found.");
  }

  return service;
};

const createAdminService = async (organizationId, payload) =>
  createService({
    organizationId,
    ...normalizeServicePayload(payload),
  });

const updateAdminService = async (serviceId, organizationId, payload) => {
  await getAdminService(serviceId, organizationId);
  return updateService(
    serviceId,
    normalizeServicePayload(payload, { partial: true }),
  );
};

const deleteAdminService = async (serviceId, organizationId) => {
  const service = await getAdminService(serviceId, organizationId);
  await deleteService(serviceId);
  return service;
};

const listAdminReviews = async (query = {}) =>
  listProductReviews({
    productId: String(query.productId || "").trim() || undefined,
    status: String(query.status || "").trim() || undefined,
  });

const updateAdminReview = async (reviewId, payload = {}, actor = null) => {
  const review = await findProductReviewById(reviewId);

  if (!review) {
    throw new ApiError(404, "Review not found.");
  }

  const updates = {};

  if (payload.rating !== undefined) {
    const rating = Number(payload.rating);

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, "Review rating must be between 1 and 5.");
    }

    updates.rating = Math.round(rating);
  }

  if (payload.body !== undefined || payload.review !== undefined) {
    updates.body = String(payload.body || payload.review || "").trim();
  }

  if (payload.status !== undefined) {
    const status = String(payload.status || "").trim().toLowerCase();

    if (!Object.values(REVIEW_STATUSES).includes(status)) {
      throw new ApiError(400, "Review status is invalid.");
    }

    updates.status = status;
  }

  if (payload.adminReply !== undefined || payload.reply !== undefined) {
    const rawReply =
      payload.adminReply && typeof payload.adminReply === "object"
        ? payload.adminReply.body
        : payload.adminReply ?? payload.reply;
    const replyBody = String(rawReply || "").trim();

    if (replyBody.length > 1500) {
      throw new ApiError(400, "Review reply must be 1500 characters or fewer.");
    }

    if (replyBody) {
      let replyAuthorName = "Store team";

      if (actor?.staffAccountId) {
        const staffAccount = await findStaffAccountById(actor.staffAccountId);
        replyAuthorName =
          String(staffAccount?.fullName || actor.email || "").trim() || "Store team";
      } else if (actor?.email) {
        replyAuthorName = String(actor.email || "").trim() || "Store team";
      }

      updates.adminReplyBody = replyBody;
      updates.adminReplyAuthorName = replyAuthorName;
      updates.adminReplyUpdatedAt = new Date();
    } else {
      updates.adminReplyBody = "";
      updates.adminReplyAuthorName = "";
      updates.adminReplyUpdatedAt = null;
    }
  }

  return updateProductReview(reviewId, updates);
};

const deleteAdminReview = async (reviewId) => {
  const review = await findProductReviewById(reviewId);

  if (!review) {
    throw new ApiError(404, "Review not found.");
  }

  await deleteProductReview(reviewId);
  return review;
};

const listAdminOrders = async (payload = {}) => {
  const pagination = normalizeAdminPagination(payload);
  const { rows, totalCount } = await listAllOrders(pagination);
  const orders = await Promise.all(rows.map(serializeOrder));

  return {
    orders,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      totalCount,
      totalPages: totalCount > 0 ? Math.ceil(totalCount / pagination.limit) : 0,
      hasNextPage: pagination.offset + pagination.limit < totalCount,
    },
  };
};

const listAdminTransactions = async (payload = {}) => {
  const dateRange = normalizeDateRange(payload);
  const [orderResult, paymentAttemptResult] = await Promise.all([
    listAllOrders(dateRange),
    listAllPaymentAttempts(dateRange),
  ]);
  const serializedOrders = await Promise.all(orderResult.rows.map(serializeOrder));
  const paymentAttempts = paymentAttemptResult.rows;
  const latestPaymentAttemptByOrderId = new Map();

  for (const paymentAttempt of paymentAttempts) {
    if (!paymentAttempt.orderId) {
      continue;
    }

    const currentEntry = latestPaymentAttemptByOrderId.get(paymentAttempt.orderId);
    const currentUpdatedAt = currentEntry
      ? new Date(currentEntry.updatedAt || currentEntry.createdAt).getTime()
      : -1;
    const nextUpdatedAt = new Date(
      paymentAttempt.updatedAt || paymentAttempt.createdAt,
    ).getTime();

    if (!currentEntry || nextUpdatedAt >= currentUpdatedAt) {
      latestPaymentAttemptByOrderId.set(paymentAttempt.orderId, paymentAttempt);
    }
  }

  const orderTransactions = serializedOrders.map((order) =>
    buildOrderTransaction(order, latestPaymentAttemptByOrderId.get(order.id) || null),
  );
  const orphanPaymentAttemptTransactions = paymentAttempts
    .filter((paymentAttempt) => !paymentAttempt.orderId)
    .map(buildStandalonePaymentAttemptTransaction);
  const transactions = [...orderTransactions, ...orphanPaymentAttemptTransactions].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const summary = transactions.reduce(
    (accumulator, transaction) => {
      accumulator.totalRecords += 1;
      accumulator.totalGrossAmount += resolveAmount(transaction.amount);
      accumulator.totalReceivedAmount += resolveAmount(transaction.receivedAmount);
      accumulator.totalOutstandingAmount += resolveAmount(
        transaction.outstandingAmount,
      );

      if (transaction.paymentStatus === "failed") {
        accumulator.failedAmount += resolveAmount(transaction.amount);
      }

      if (transaction.paymentMethod === "cash_on_delivery") {
        accumulator.cashOnDeliveryAmount += resolveAmount(
          transaction.outstandingAmount,
        );
      }

      if (transaction.paymentMethod === "online_payment") {
        accumulator.onlineReceivedAmount += resolveAmount(
          transaction.receivedAmount,
        );

        if (
          !transaction.isMoneyReceived &&
          transaction.paymentStatus !== "failed"
        ) {
          accumulator.onlinePendingAmount += resolveAmount(
            transaction.outstandingAmount,
          );
        }
      }

      return accumulator;
    },
    {
      totalRecords: 0,
      totalGrossAmount: 0,
      totalReceivedAmount: 0,
      totalOutstandingAmount: 0,
      failedAmount: 0,
      cashOnDeliveryAmount: 0,
      onlineReceivedAmount: 0,
      onlinePendingAmount: 0,
    },
  );

  return {
    transactions,
    summary,
  };
};

const listAdminSalesReport = async (payload = {}) => {
  const dateRange = normalizeDateRange(payload);
  const [orderResult, paymentAttemptResult] = await Promise.all([
    listAllOrders(dateRange),
    listAllPaymentAttempts(dateRange),
  ]);
  const serializedOrders = await Promise.all(orderResult.rows.map(serializeOrder));
  const paymentAttempts = paymentAttemptResult.rows;
  const latestPaymentAttemptByOrderId = new Map();

  for (const paymentAttempt of paymentAttempts) {
    if (!paymentAttempt.orderId) {
      continue;
    }

    const currentEntry = latestPaymentAttemptByOrderId.get(paymentAttempt.orderId);
    const currentUpdatedAt = currentEntry
      ? new Date(currentEntry.updatedAt || currentEntry.createdAt).getTime()
      : -1;
    const nextUpdatedAt = new Date(
      paymentAttempt.updatedAt || paymentAttempt.createdAt,
    ).getTime();

    if (!currentEntry || nextUpdatedAt >= currentUpdatedAt) {
      latestPaymentAttemptByOrderId.set(paymentAttempt.orderId, paymentAttempt);
    }
  }

  const transactions = serializedOrders
    .map((order) =>
      buildSalesReportTransaction(
        order,
        latestPaymentAttemptByOrderId.get(order.id) || null,
      ),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

  const summary = transactions.reduce(
    (accumulator, transaction) => {
      accumulator.totalRecords += 1;
      accumulator.totalSale += resolveAmount(transaction.total);
      accumulator.totalReceived += resolveAmount(transaction.received);
      accumulator.totalOutstanding += resolveAmount(transaction.balanceDue);

      if (transaction.status === "Paid") {
        accumulator.paidCount += 1;
      } else {
        accumulator.overdueCount += 1;
      }

      return accumulator;
    },
    {
      totalRecords: 0,
      totalSale: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      paidCount: 0,
      overdueCount: 0,
    },
  );

  return {
    generatedOn: new Date().toISOString(),
    durationFrom: transactions[transactions.length - 1]?.createdAt || null,
    durationTo: transactions[0]?.createdAt || null,
    transactions,
    summary,
  };
};

const serializeAdminCoupon = (coupon) => {
  const sampleTotalPayable = SAMPLE_COUPON_PRODUCT_TOTAL + SAMPLE_COUPON_DELIVERY_CHARGE;
  const preview = calculateCouponApplication({
    type: coupon.type,
    adjustAmount: coupon.adjustAmount,
    discountPercent: coupon.discountPercent,
    totalProductsPrice: SAMPLE_COUPON_PRODUCT_TOTAL,
    totalPayableAmount: sampleTotalPayable,
  });

  return {
    ...coupon,
    effectiveStatus: resolveCouponEffectiveStatus(coupon),
    isOneTimeUse: coupon.usageMode === COUPON_USAGE_MODES.oneTime,
    isRedeemed:
      Number(coupon.totalUsesRedeemed || 0) >= Number(coupon.totalUsesAllowed || 1),
    createdByStaff: coupon.createdByStaffAccountId
      ? {
          id: coupon.createdByStaffAccountId,
          email: coupon.createdByStaffEmail || "",
          fullName: coupon.createdByStaffName || "",
        }
      : null,
    preview: {
      sampleProductTotal: SAMPLE_COUPON_PRODUCT_TOTAL,
      sampleDeliveryCharge: SAMPLE_COUPON_DELIVERY_CHARGE,
      sampleTotalPayable,
      discountValue: preview.discountValue,
      adjustedProductTotal: preview.adjustedProductTotal,
      adjustedTotalPayable: preview.adjustedTotalPayable,
      appliesTo: preview.appliesTo,
    },
  };
};

const listAdminCoupons = async () =>
  (await listCouponCodes()).map(serializeAdminCoupon);

const createAdminCoupon = async (staffAccountId, payload = {}) => {
  const type = normalizeCouponType(payload.type);

  if (!Object.values(COUPON_TYPES).includes(type)) {
    throw new ApiError(400, "Coupon type is invalid.");
  }

  const rawCode = normalizeCouponCode(payload.code || "");
  const code = rawCode || generateCouponCode(type);
  const existingCoupon = await findCouponCodeByCode(code);

  if (existingCoupon) {
    throw new ApiError(409, "Coupon code already exists. Try another code.");
  }

  const adjustAmount =
    type === COUPON_TYPES.adjust
      ? normalizeWholeAmount(payload.adjustAmount ?? payload.amount)
      : 0;
  const discountPercent =
    type === COUPON_TYPES.discount
      ? normalizeDiscountPercent(payload.discountPercent ?? payload.percent)
      : 0;

  if (type === COUPON_TYPES.adjust && (!Number.isFinite(adjustAmount) || adjustAmount <= 0)) {
    throw new ApiError(400, "Adjust coupon amount must be greater than zero.");
  }

  if (
    type === COUPON_TYPES.discount &&
    (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100)
  ) {
    throw new ApiError(400, "Discount coupon percent must be between 0 and 100.");
  }

  let expiresAt = null;

  if (payload.expiresAt) {
    const parsedDate = new Date(payload.expiresAt);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, "Coupon expiry date is invalid.");
    }

    if (parsedDate.getTime() <= Date.now()) {
      throw new ApiError(400, "Coupon expiry date must be in the future.");
    }

    expiresAt = parsedDate.toISOString();
  }

  const createdCoupon = await createCouponCode({
    code,
    type,
    adjustAmount,
    discountPercent,
    status: COUPON_STATUSES.active,
    usageMode: COUPON_USAGE_MODES.oneTime,
    totalUsesAllowed: 1,
    notes: normalizeString(payload.notes),
    createdByStaffAccountId: staffAccountId || null,
    expiresAt,
    metadata: {
      pricingRule:
        type === COUPON_TYPES.adjust
          ? "TotalPayableAmount - AdjustCouponAmount"
          : "TotalProductsPrice - DiscountCouponPercent",
      calculationScope:
        type === COUPON_TYPES.adjust ? "total_payable_including_delivery" : "product_total_only",
    },
  });

  return serializeAdminCoupon(createdCoupon);
};

const updateAdminCoupon = async (couponId, payload = {}) => {
  const currentCoupon = await findCouponCodeById(couponId);

  if (!currentCoupon) {
    throw new ApiError(404, "Coupon not found.");
  }

  const effectiveStatus = resolveCouponEffectiveStatus(currentCoupon);

  if (
    effectiveStatus === COUPON_STATUSES.used ||
    effectiveStatus === COUPON_STATUSES.expired
  ) {
    throw new ApiError(409, "Used or expired coupons cannot be modified.");
  }

  const nextStatus =
    payload.status !== undefined
      ? normalizeCouponStatus(payload.status)
      : currentCoupon.status;

  if (
    payload.status !== undefined &&
    ![COUPON_STATUSES.active, COUPON_STATUSES.inactive].includes(nextStatus)
  ) {
    throw new ApiError(400, "Coupon status must be active or inactive.");
  }

  let expiresAt = currentCoupon.expiresAt;

  if (payload.expiresAt !== undefined) {
    if (!payload.expiresAt) {
      expiresAt = null;
    } else {
      const parsedDate = new Date(payload.expiresAt);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new ApiError(400, "Coupon expiry date is invalid.");
      }

      if (parsedDate.getTime() <= Date.now()) {
        throw new ApiError(400, "Coupon expiry date must be in the future.");
      }

      expiresAt = parsedDate.toISOString();
    }
  }

  const updatedCoupon = await updateCouponCode(couponId, {
    status: nextStatus,
    notes: payload.notes !== undefined ? normalizeString(payload.notes) : undefined,
    expiresAt,
  });

  return serializeAdminCoupon(updatedCoupon);
};

const deleteAdminCoupon = async (couponId) => {
  const coupon = await findCouponCodeById(couponId);

  if (!coupon) {
    throw new ApiError(404, "Coupon not found.");
  }

  if (Number(coupon.totalUsesRedeemed || 0) > 0 || coupon.redeemedOrderId) {
    throw new ApiError(
      409,
      "Redeemed coupons cannot be deleted because they are part of order history.",
    );
  }

  if (coupon.reservedReference) {
    throw new ApiError(
      409,
      "Coupon is currently reserved in an active checkout and cannot be deleted right now.",
    );
  }

  const deletedCoupon = await deleteCouponCode(couponId);

  if (!deletedCoupon) {
    throw new ApiError(404, "Coupon not found.");
  }

  return serializeAdminCoupon(deletedCoupon);
};

const getAdminOrder = async (orderId) => {
  const order = await findOrderById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  return await serializeOrder(order);
};

const updateAdminOrder = async (orderId, payload = {}) => {
  const currentOrder = await findOrderById(orderId);

  if (!currentOrder) {
    throw new ApiError(404, "Order not found.");
  }

  const previousStatus = normalizeOrderCurrentStatus(currentOrder.currentStatus);
  const currentRefundRequest = buildOrderRefundRequest(currentOrder);
  const updates = {};
  let nextTrackingTimeline;
  let nextPaymentDetails =
    currentOrder.paymentDetails && typeof currentOrder.paymentDetails === "object"
      ? { ...currentOrder.paymentDetails }
      : {};
  let hasPaymentDetailsMutation = false;
  const nowIso = new Date().toISOString();

  if (payload.fullName !== undefined) {
    updates.fullName = String(payload.fullName || "").trim();
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(String(payload.email || "").trim());
    if (!isValidEmail(email)) {
      throw new ApiError(400, "Order email format is invalid.");
    }
    updates.email = email;
  }

  if (payload.phoneNumber !== undefined) {
    const phoneNumber = String(payload.phoneNumber || "").trim();
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      throw new ApiError(400, "Order phone number format is invalid.");
    }
    updates.phoneNumber = phoneNumber;
  }

  if (payload.deliveryDate !== undefined) {
    const deliveryDate = new Date(payload.deliveryDate);
    if (Number.isNaN(deliveryDate.getTime())) {
      throw new ApiError(400, "Order delivery date is invalid.");
    }
    updates.deliveryDate = deliveryDate.toISOString();
  }

  if (payload.paymentStatus !== undefined) {
    updates.paymentStatus = String(payload.paymentStatus || "").trim();
  }

  if (payload.currentStatus !== undefined) {
    const currentStatus = normalizeOrderCurrentStatus(payload.currentStatus);

    if (!currentStatus || !ORDER_STATUS_KEYS.includes(currentStatus)) {
      throw new ApiError(400, "Order status is invalid.");
    }

    updates.currentStatus = currentStatus;
    nextTrackingTimeline = ensureTrackingStatusEntry(
      currentOrder.trackingTimeline || [],
      currentStatus,
      nowIso,
    );
  }

  if (payload.trackingEventMessage !== undefined) {
    const trackingEventMessage = String(payload.trackingEventMessage || "").trim();
    const trackingEventStatus = normalizeOrderCurrentStatus(
      payload.trackingEventStatus || updates.currentStatus || currentOrder.currentStatus || "",
    );

    if (trackingEventMessage) {
      if (!trackingEventStatus || !ORDER_STATUS_KEYS.includes(trackingEventStatus)) {
        throw new ApiError(400, "Tracking event status is invalid.");
      }

      nextTrackingTimeline = appendTrackingEntryToStatus(
        nextTrackingTimeline || currentOrder.trackingTimeline || [],
        trackingEventStatus,
        trackingEventMessage,
        nowIso,
      );
    }
  }

  if (payload.trackingTimeline !== undefined && Array.isArray(payload.trackingTimeline)) {
    nextTrackingTimeline = normalizeStoredTrackingTimeline(payload.trackingTimeline);
  }

  if (nextTrackingTimeline !== undefined) {
    updates.trackingTimeline = nextTrackingTimeline;
  }

  if (payload.paymentDetails !== undefined) {
    nextPaymentDetails =
      payload.paymentDetails && typeof payload.paymentDetails === "object"
        ? { ...payload.paymentDetails }
        : {};
    hasPaymentDetailsMutation = true;
  }

  let nextStatus = normalizeOrderCurrentStatus(
    updates.currentStatus !== undefined ? updates.currentStatus : currentOrder.currentStatus,
  );

  if (payload.cancellationReason !== undefined) {
    updates.cancellationReason = String(payload.cancellationReason || "")
      .trim()
      .toLowerCase();
  }

  if (payload.cancellationNote !== undefined) {
    updates.cancellationNote = String(payload.cancellationNote || "").trim();
  }

  if (payload.refundReason !== undefined) {
    updates.refundReason = String(payload.refundReason || "").trim();
  }

  if (payload.refundAccountAction !== undefined) {
    const refundAccountAction = String(payload.refundAccountAction || "")
      .trim()
      .toLowerCase();
    const refundRequestNote = String(
      payload.refundRequestNote || payload.refundAccountNote || "",
    ).trim();

    if (refundAccountAction === "request_resubmit") {
      if (!currentRefundRequest.accountDetails) {
        throw new ApiError(
          400,
          "Customer refund account details must be submitted before requesting a resubmission.",
        );
      }

      if (!refundRequestNote) {
        throw new ApiError(400, "A resubmission note is required for the customer.");
      }

      nextPaymentDetails = buildPaymentDetailsWithRefundRequest(currentOrder, {
        ...currentRefundRequest,
        status: REFUND_REQUEST_STATUSES.resubmitRequired,
        adminNote: refundRequestNote,
        updatedAt: nowIso,
        resubmitRequestedAt: nowIso,
      });
      hasPaymentDetailsMutation = true;
    } else if (refundAccountAction === "mark_refunded") {
      if (!currentRefundRequest.accountDetails) {
        throw new ApiError(
          400,
          "Refund account details are required before marking this order as refunded.",
        );
      }

      nextPaymentDetails = buildPaymentDetailsWithRefundRequest(currentOrder, {
        ...currentRefundRequest,
        status: REFUND_REQUEST_STATUSES.refunded,
        updatedAt: nowIso,
        refundedAt: currentOrder.refundedAt || nowIso,
      });
      hasPaymentDetailsMutation = true;
      updates.currentStatus = "refunded";
      updates.refundedAt = currentOrder.refundedAt || nowIso;
      updates.paymentStatus = "refunded";
      nextTrackingTimeline = ensureTrackingStatusEntry(
        nextTrackingTimeline || currentOrder.trackingTimeline || [],
        "refunded",
        nowIso,
      );
      updates.trackingTimeline = nextTrackingTimeline;
    } else if (refundAccountAction) {
      throw new ApiError(400, "Refund account action is invalid.");
    }
  }

  nextStatus = normalizeOrderCurrentStatus(
    updates.currentStatus !== undefined ? updates.currentStatus : currentOrder.currentStatus,
  );

  if (nextStatus === "cancelled") {
    const cancellationReason = String(
      updates.cancellationReason || currentOrder.cancellationReason || "",
    )
      .trim()
      .toLowerCase();

    if (!Object.keys(ORDER_CANCELLATION_REASONS).includes(cancellationReason)) {
      throw new ApiError(400, "Order cancellation reason is required.");
    }

    updates.cancelledAt = currentOrder.cancelledAt || nowIso;
    updates.refundedAt = null;
  }

  if (nextStatus === "refunded") {
    const refundReason = String(
      updates.refundReason || currentOrder.refundReason || "",
    ).trim();

    if (!refundReason) {
      throw new ApiError(400, "Refund reason is required.");
    }

    updates.refundedAt = currentOrder.refundedAt || nowIso;
    updates.paymentStatus = "refunded";
    nextPaymentDetails = buildPaymentDetailsWithRefundRequest(currentOrder, {
      ...currentRefundRequest,
      status: REFUND_REQUEST_STATUSES.refunded,
      accountDetails: currentRefundRequest.accountDetails,
      adminNote: currentRefundRequest.adminNote,
      submittedAt: currentRefundRequest.submittedAt,
      updatedAt: nowIso,
      resubmitRequestedAt: currentRefundRequest.resubmitRequestedAt,
      refundedAt: currentOrder.refundedAt || nowIso,
    });
    hasPaymentDetailsMutation = true;
  }

  if (nextStatus === "confirmed" && previousStatus === "placed") {
    nextTrackingTimeline = ensureTrackingStatusEntry(
      nextTrackingTimeline || currentOrder.trackingTimeline || [],
      "confirmed",
      nowIso,
    );
    updates.trackingTimeline = nextTrackingTimeline;
  }

  if (nextStatus !== "cancelled") {
    updates.cancellationReason =
      payload.cancellationReason !== undefined
        ? String(payload.cancellationReason || "").trim().toLowerCase()
        : currentOrder.cancellationReason || "";
    updates.cancellationNote =
      payload.cancellationNote !== undefined
        ? String(payload.cancellationNote || "").trim()
        : currentOrder.cancellationNote || "";
  }

  if (nextStatus !== "refunded" && payload.refundReason === undefined) {
    updates.refundReason = currentOrder.refundReason || "";
  }

  ["deliveryAddress", "vehicle", "orderItems", "recommendedItems", "billingDetails", "deliveryLocation", "pricing"].forEach((key) => {
    if (payload[key] !== undefined) {
      updates[key] =
        payload[key] && typeof payload[key] === "object" ? payload[key] : payload[key];
    }
  });

  if (hasPaymentDetailsMutation) {
    updates.paymentDetails = nextPaymentDetails;
  }

  const updatedOrder = await updateOrder(orderId, updates);
  const serializedOrder = await serializeOrder(updatedOrder);
  const serializedNextStatus = normalizeOrderCurrentStatus(serializedOrder.currentStatus);

  if (serializedNextStatus && serializedNextStatus !== previousStatus) {
    await notifyOrderPrimaryStatus(serializedOrder, serializedNextStatus);
    await createOrderStatusNotification(updatedOrder, serializedNextStatus);
  }

  return serializedOrder;
};

const listAdminCustomers = async () => (await listUsers()).map(sanitizeCustomer);

const createAdminCustomer = async (payload = {}) => {
  const fullName = String(payload.fullName || payload.name || "").trim();
  const email = normalizeEmail(String(payload.email || "").trim());
  const password = String(payload.password || "");
  const phoneNumber = String(payload.phoneNumber || payload.phone || "").trim();
  const isVip = payload.isVip !== undefined ? Boolean(payload.isVip) : false;
  const customerCategory =
    payload.customerCategory !== undefined
      ? normalizeCustomerCategory(payload.customerCategory)
      : CUSTOMER_CATEGORIES.normal;

  if (!fullName) {
    throw new ApiError(400, "Customer full name is required.");
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Customer email format is invalid.");
  }

  if (!validatePasswordStrength(password)) {
    throw new ApiError(
      400,
      "Customer password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    );
  }

  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(400, "Customer phone number format is invalid.");
  }

  const [existingEmailUser, existingPhoneUser] = await Promise.all([
    findUserByEmail(email),
    phoneNumber ? findUserByPhone(phoneNumber) : Promise.resolve(null),
  ]);

  if (existingEmailUser) {
    throw new ApiError(409, "A customer account with this email already exists.");
  }

  if (existingPhoneUser) {
    throw new ApiError(409, "A customer account with this phone number already exists.");
  }

  const customer = await createUser({
    fullName,
    email,
    phoneNumber: phoneNumber || null,
    passwordHash: await hashPassword(password),
    authProvider: "local",
    isVerified: true,
    isVip,
    paymentAccess: DEFAULT_PAYMENT_ACCESS,
    customerCategory,
    accountStatus: USER_ACCOUNT_STATUSES.active,
  });

  // await addBrevoWelcomeContact({
  //   id: customer.id,
  //   email: customer.email,
  //   fullName: customer.fullName,
  // });

  await sendWelcomeEmailBestEffort({
    to: customer.email,
    customerName: customer.fullName,
    source: "admin-customer-create",
  });

  return sanitizeCustomer(customer);
};

const sendAdminEmail = async (payload = {}) =>
  sendAdminMailMessage({
    recipients: payload.recipients || payload.to || [],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    source: payload.source || "admin-mailer",
  });

const sendAdminPushNotification = async (payload = {}) =>
  sendPushNotificationToRecipients({
    recipients: payload.recipients || payload.to || [],
    title: payload.title,
    description: payload.description || payload.body,
    link: payload.link || payload.url,
    buttonLabel: payload.buttonLabel,
    buttonColor: payload.buttonColor,
    logoUrl: payload.logoUrl || payload.logo || payload.imageUrl,
    vibrate: payload.vibrate,
    source: payload.source || "admin-push",
  });

const getAdminCustomer = async (customerId) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return sanitizeCustomer(customer);
};

const getAdminCustomerCart = async (customerId) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return {
    customer: sanitizeCustomer(customer),
    cart: await getUserCart(customer.id),
  };
};

const previewAdminCustomerCartCheckout = async (customerId, payload = {}) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  const checkoutPayload = normalizeAdminCustomerCartCheckoutPayload(customer, payload);
  const preview = await previewCartCheckout(customer.id, checkoutPayload);

  return {
    customer: sanitizeCustomer(customer),
    cart: await getUserCart(customer.id),
    preview,
    checkoutPayload,
  };
};

const createAdminCustomerCartPaymentCheckout = async (customerId, payload = {}) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  const checkoutPayload = normalizeAdminCustomerCartCheckoutPayload(customer, payload);
  const checkout = await createCartPaymentCheckout(customer.id, {
    ...checkoutPayload,
    returnPath: "/",
  });

  return {
    customer: sanitizeCustomer(customer),
    cart: await getUserCart(customer.id),
    checkout,
  };
};

const getAdminCustomerCartPaymentAttempt = async (customerId, paymentAttemptId) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== customer.id) {
    throw new ApiError(404, "Payment transaction not found.");
  }

  const reconciledPaymentAttempt = await reconcilePaymentAttemptStatus(
    paymentAttempt,
  );

  return {
    customer: sanitizeCustomer(customer),
    cart: await getUserCart(customer.id),
    paymentAttempt: serializeAdminPaymentAttempt(reconciledPaymentAttempt),
  };
};

const updateAdminCustomer = async (customerId, payload = {}) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  const updates = {};

  if (payload.fullName !== undefined) {
    updates.fullName = String(payload.fullName || "").trim();
  }

  if (payload.phoneNumber !== undefined) {
    const phoneNumber = String(payload.phoneNumber || "").trim();
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      throw new ApiError(400, "Customer phone number format is invalid.");
    }
    updates.phoneNumber = phoneNumber;
  }

  if (payload.isVerified !== undefined) {
    updates.isVerified = Boolean(payload.isVerified);
  }

  if (payload.isVip !== undefined) {
    updates.isVip = Boolean(payload.isVip);
  }

  if (payload.paymentAccess !== undefined) {
    if (!payload.paymentAccess || typeof payload.paymentAccess !== "object") {
      throw new ApiError(400, "Customer payment access is invalid.");
    }

    updates.paymentAccess = normalizeUserPaymentAccess(payload.paymentAccess);
  }

  if (payload.customerCategory !== undefined) {
    updates.customerCategory = normalizeCustomerCategory(payload.customerCategory);
  }

  if (payload.accountStatus !== undefined) {
    updates.accountStatus = normalizeUserAccountStatus(payload.accountStatus);
  }

  if (payload.banReason !== undefined) {
    updates.banReason = String(payload.banReason || "").trim();
  }

  if (payload.bannedUntil !== undefined) {
    if (!payload.bannedUntil) {
      updates.bannedUntil = null;
    } else {
      const bannedUntil = new Date(payload.bannedUntil);

      if (Number.isNaN(bannedUntil.getTime())) {
        throw new ApiError(400, "Temporary ban expiry is invalid.");
      }

      updates.bannedUntil = bannedUntil.toISOString();
    }
  }

  const nextAccountStatus = normalizeUserAccountStatus(
    updates.accountStatus !== undefined ? updates.accountStatus : customer.accountStatus,
  );

  if (nextAccountStatus === USER_ACCOUNT_STATUSES.active) {
    updates.bannedUntil = null;
    updates.banReason = "";
  }

  if (nextAccountStatus === USER_ACCOUNT_STATUSES.bannedPermanent) {
    updates.bannedUntil = null;
  }

  if (
    nextAccountStatus === USER_ACCOUNT_STATUSES.bannedTemporary &&
    !String(updates.bannedUntil || customer.bannedUntil || "").trim()
  ) {
    throw new ApiError(400, "Temporary ban requires an expiry date and time.");
  }

  if (payload.deliveryAddress !== undefined) {
    updates.deliveryAddress =
      payload.deliveryAddress && typeof payload.deliveryAddress === "object"
        ? payload.deliveryAddress
        : {};
  }

  if (payload.billingDetails !== undefined) {
    updates.billingDetails =
      payload.billingDetails && typeof payload.billingDetails === "object"
        ? payload.billingDetails
        : {};
  }

  const updatedCustomer = await updateUser(customerId, updates);
  return sanitizeCustomer(updatedCustomer);
};

const addItemToAdminCustomerCart = async (customerId, payload = {}) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return {
    customer: sanitizeCustomer(customer),
    cart: await addCartItem(customer.id, payload),
  };
};

const updateAdminCustomerCartItem = async (customerId, itemId, payload = {}) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return {
    customer: sanitizeCustomer(customer),
    cart: await updateCartItemQuantity(customer.id, itemId, payload),
  };
};

const removeAdminCustomerCartItem = async (customerId, itemId) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return {
    customer: sanitizeCustomer(customer),
    cart: await removeCartItem(customer.id, itemId),
  };
};

const listAdminStaffAccounts = async (organizationId) => {
  const organization = await findOrganizationById(organizationId);
  return (await listStaffAccountsByOrganizationId(organizationId)).map((staffAccount) =>
    sanitizeStaffAccount(staffAccount, organization),
  );
};

const createAdminStaffAccount = async (actorStaffAccountId, payload) => {
  const actor = await findStaffAccountById(actorStaffAccountId);
  const normalizedPayload = normalizeStaffPayload(payload);
  assertCanManageStaffRole(actor.role, normalizedPayload.role);

  if (!validatePasswordStrength(normalizedPayload.password)) {
    throw new ApiError(
      400,
      "Staff password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    );
  }

  const existingStaffAccount = await findStaffAccountByEmail(normalizedPayload.email);

  if (existingStaffAccount) {
    throw new ApiError(409, "A staff account with this email already exists.");
  }

  const createdStaffAccount = await createStaffAccount({
    organizationId: actor.organizationId,
    fullName: normalizedPayload.fullName,
    email: normalizedPayload.email,
    passwordHash: await hashPassword(normalizedPayload.password),
    role: normalizedPayload.role,
    status: "active",
  });
  const organization = await findOrganizationById(actor.organizationId);

  return sanitizeStaffAccount(createdStaffAccount, organization);
};

const updateAdminStaffAccount = async (actorStaffAccountId, targetStaffAccountId, payload = {}) => {
  const actor = await findStaffAccountById(actorStaffAccountId);
  const target = await findStaffAccountById(targetStaffAccountId);

  if (!target || target.organizationId !== actor.organizationId) {
    throw new ApiError(404, "Staff account not found.");
  }

  assertCanManageStaffRole(actor.role, target.role);

  const updates = {};

  if (payload.fullName !== undefined) {
    updates.fullName = String(payload.fullName || "").trim();
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(String(payload.email || "").trim());
    if (!isValidEmail(email)) {
      throw new ApiError(400, "Staff email format is invalid.");
    }
    updates.email = email;
  }

  if (payload.role !== undefined) {
    const role = String(payload.role || "").trim().toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      throw new ApiError(400, "Staff role is invalid.");
    }
    assertCanManageStaffRole(actor.role, role);
    updates.role = role;
  }

  if (payload.status !== undefined) {
    const status = String(payload.status || "").trim().toLowerCase();
    if (!["active", "disabled"].includes(status)) {
      throw new ApiError(400, "Staff status is invalid.");
    }
    updates.status = status;
  }

  if (payload.password) {
    if (!validatePasswordStrength(String(payload.password))) {
      throw new ApiError(
        400,
        "Staff password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
      );
    }
    updates.passwordHash = await hashPassword(String(payload.password));
  }

  const updatedStaffAccount = await updateStaffAccount(targetStaffAccountId, updates);
  const organization = await findOrganizationById(actor.organizationId);

  return sanitizeStaffAccount(updatedStaffAccount, organization);
};

const deleteAdminStaffAccount = async (actorStaffAccountId, targetStaffAccountId) => {
  const actor = await findStaffAccountById(actorStaffAccountId);
  const target = await findStaffAccountById(targetStaffAccountId);

  if (!target || target.organizationId !== actor.organizationId) {
    throw new ApiError(404, "Staff account not found.");
  }

  if (actor.id === target.id) {
    throw new ApiError(400, "You cannot delete your own staff account.");
  }

  assertCanManageStaffRole(actor.role, target.role);
  await deleteStaffAccount(targetStaffAccountId);

  return sanitizeStaffAccount(target);
};

module.exports = {
  addItemToAdminCustomerCart,
  adjustAdminProductStock,
  listAdminProductStockAdjustmentLogs,
  bootstrapAdminWorkspace,
  createAdminCustomerCartPaymentCheckout,
  createAdminCustomer,
  createAdminCoupon,
  createAdminProduct,
  createAdminService,
  createAdminStaffAccount,
  deleteAdminCoupon,
  deleteAdminProduct,
  deleteAdminReview,
  deleteAdminService,
  deleteAdminStaffAccount,
  getAdminCustomer,
  getAdminCustomerCart,
  getAdminPaymentGatewaySettings,
  getAdminCustomerCartPaymentAttempt,
  getAdminOrder,
  getAdminProduct,
  getAdminProductStockSnapshot,
  getAdminSetupStatus,
  getAdminService,
  getCurrentStaffAccount,
  listAdminCoupons,
  listAdminCustomers,
  listAdminOrders,
  listAdminProducts,
  listAdminReviews,
  listAdminSalesReport,
  listAdminServices,
  listAdminStaffAccounts,
  listAdminTransactions,
  loginStaffAccount,
  generateAdminMailDraft,
  previewAdminCustomerCartCheckout,
  removeAdminCustomerCartItem,
  sendAdminPushNotification,
  sendAdminEmail,
  setupInitialAdminOwner,
  syncAdminProductsFromSheet,
  updateAdminCustomer,
  updateAdminCustomerCartItem,
  updateAdminCoupon,
  updateAdminOrder,
  updateAdminPaymentGatewaySettings,
  updateAdminProduct,
  updateAdminReview,
  updateAdminService,
  updateAdminStaffAccount,
};
