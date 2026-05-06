const {
  createProduct,
  deleteProduct,
  findProductById,
  listProducts,
  updateProduct,
} = require("../repositories/product.repository");
const {
  countRequestedProductStockAlertsByProductIds,
  listRequestedProductStockAlertsByProductId,
} = require("../repositories/product-stock-alert.repository");
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
  findUserById,
  listUsers,
  updateUser,
} = require("../repositories/user.repository");
const {
  findOrderById,
  listAllOrders,
  updateOrder,
} = require("../repositories/order.repository");
const { listAllPaymentAttempts } = require("../repositories/payment.repository");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");
const { comparePassword, hashPassword, validatePasswordStrength } = require("../utils/password");
const { isValidEmail, isValidPhoneNumber, normalizeEmail } = require("../utils/validators");
const {
  ORDER_STATUS_KEYS,
  appendTrackingEntryToStatus,
  ensureTrackingStatusEntry,
  notifyOrderPrimaryStatus,
  normalizeOrderCurrentStatus,
  normalizeStoredTrackingTimeline,
  serializeOrder,
} = require("./order.service");
const { seedHomeCategoryItemsForOrganization } = require("./home-category.service");
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
  completed: "Payment verified",
  failed: "Payment failed",
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

const sanitizeCustomer = (user) => ({
  id: user.id,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  email: user.email,
  authProvider: user.authProvider,
  profileImage: user.profileImage,
  isVerified: Boolean(user.isVerified),
  deliveryAddress: user.deliveryAddress || {},
  billingDetails: user.billingDetails || {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
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
      (paymentAttempt?.razorpay?.orderId ? "razorpay" : null),
    gatewayOrderId:
      normalizeString(paymentDetails.razorpayOrderId) ||
      normalizeString(paymentAttempt?.razorpay?.orderId) ||
      null,
    gatewayPaymentId:
      normalizeString(paymentDetails.razorpayPaymentId) ||
      normalizeString(paymentAttempt?.razorpay?.paymentId) ||
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
    provider: paymentAttempt.razorpay?.orderId ? "razorpay" : null,
    gatewayOrderId: normalizeString(paymentAttempt.razorpay?.orderId) || null,
    gatewayPaymentId: normalizeString(paymentAttempt.razorpay?.paymentId) || null,
    failureReason: paymentAttempt.failureReason || null,
    lastWebhookEvent: paymentAttempt.lastWebhookEvent || null,
    isMoneyReceived,
    createdAt: paymentAttempt.createdAt,
    processedAt: paymentAttempt.processedAt || null,
    updatedAt: paymentAttempt.updatedAt || paymentAttempt.createdAt,
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
  const weight =
    payload.weight !== undefined ? Number(payload.weight) : undefined;

  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    throw new ApiError(400, "Product price must be zero or greater.");
  }

  if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
    throw new ApiError(400, "Product weight must be greater than zero.");
  }

  return {
    id: String(payload.id || "").trim() || undefined,
    name,
    category,
    price,
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
    unit,
    badge,
    description,
    image:
      payload.image !== undefined ? String(payload.image || "").trim() : undefined,
    images:
      payload.images !== undefined ? normalizeStringArray(payload.images) : undefined,
    videoClips:
      payload.videoClips !== undefined && Array.isArray(payload.videoClips)
        ? payload.videoClips
        : undefined,
    tags: payload.tags !== undefined ? normalizeStringArray(payload.tags) : undefined,
    optionGroups:
      payload.optionGroups !== undefined && Array.isArray(payload.optionGroups)
        ? payload.optionGroups
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

  const staffAccount = await findStaffAccountByEmail(normalizedEmail);

  if (!staffAccount && (await countStaffAccounts()) === 0) {
    throw new ApiError(
      409,
      "No staff account exists yet. Set up the initial owner account first.",
    );
  }

  if (!staffAccount || staffAccount.status !== "active") {
    throw new ApiError(401, "Staff email or password is incorrect.");
  }

  const passwordMatches = await comparePassword(password, staffAccount.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, "Staff email or password is incorrect.");
  }

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
  await seedHomeCategoryItemsForOrganization(organization.id, organization.slug);

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
  const product = await updateProduct(
    productId,
    normalizeProductPayload(payload, { partial: true }),
  );

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return enrichAdminProductWithStockAlerts(product, {
    includeStockAlerts: true,
  });
};

const deleteAdminProduct = async (productId) => {
  const product = await deleteProduct(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return product;
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

const updateAdminReview = async (reviewId, payload = {}) => {
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

  if (payload.title !== undefined) {
    updates.title = String(payload.title || "").trim();
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

const listAdminOrders = async () => (await listAllOrders()).map(serializeOrder);

const listAdminTransactions = async () => {
  const [orders, paymentAttempts] = await Promise.all([
    listAllOrders(),
    listAllPaymentAttempts(),
  ]);
  const serializedOrders = orders.map(serializeOrder);
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

const getAdminOrder = async (orderId) => {
  const order = await findOrderById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  return serializeOrder(order);
};

const updateAdminOrder = async (orderId, payload = {}) => {
  const currentOrder = await findOrderById(orderId);

  if (!currentOrder) {
    throw new ApiError(404, "Order not found.");
  }

  const previousStatus = normalizeOrderCurrentStatus(currentOrder.currentStatus);
  const updates = {};
  let nextTrackingTimeline;
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

  ["deliveryAddress", "vehicle", "orderItems", "recommendedItems", "billingDetails", "deliveryLocation", "paymentDetails", "pricing"].forEach((key) => {
    if (payload[key] !== undefined) {
      updates[key] =
        payload[key] && typeof payload[key] === "object" ? payload[key] : payload[key];
    }
  });

  const updatedOrder = await updateOrder(orderId, updates);
  const serializedOrder = serializeOrder(updatedOrder);
  const nextStatus = normalizeOrderCurrentStatus(serializedOrder.currentStatus);

  if (nextStatus && nextStatus !== previousStatus) {
    await notifyOrderPrimaryStatus(serializedOrder, nextStatus);
  }

  return serializedOrder;
};

const listAdminCustomers = async () => (await listUsers()).map(sanitizeCustomer);

const getAdminCustomer = async (customerId) => {
  const customer = await findUserById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return sanitizeCustomer(customer);
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
  bootstrapAdminWorkspace,
  createAdminProduct,
  createAdminService,
  createAdminStaffAccount,
  deleteAdminProduct,
  deleteAdminReview,
  deleteAdminService,
  deleteAdminStaffAccount,
  getAdminCustomer,
  getAdminOrder,
  getAdminProduct,
  getAdminSetupStatus,
  getAdminService,
  getCurrentStaffAccount,
  listAdminCustomers,
  listAdminOrders,
  listAdminProducts,
  listAdminReviews,
  listAdminServices,
  listAdminStaffAccounts,
  listAdminTransactions,
  loginStaffAccount,
  setupInitialAdminOwner,
  updateAdminCustomer,
  updateAdminOrder,
  updateAdminProduct,
  updateAdminReview,
  updateAdminService,
  updateAdminStaffAccount,
};
