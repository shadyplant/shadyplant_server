const { env } = require("../config/env");
const { findUserById } = require("../repositories/user.repository");
const {
  createOrder,
  findOrderById,
  listOrdersByUserId,
  updateOrder,
} = require("../repositories/order.repository");
const { ApiError } = require("../utils/apiError");
const { generateId } = require("../utils/crypto");
const { isValidPhoneNumber, isValidPostalCode } = require("../utils/validators");
const { sendOrderStatusEmail } = require("../mailer");
const {
  PAYMENT_METHODS,
  assertUserCanUsePaymentMethod,
} = require("./user-account.service");

const GRASS_PRICE_PER_SQFT = 12;
const VEHICLES = {
  small: {
    id: "small",
    name: "Small Pickup",
    rate: 15,
    description: "Up to 500 sqft",
  },
  medium: {
    id: "medium",
    name: "Medium Truck",
    rate: 25,
    description: "Up to 1200 sqft",
  },
  heavy: {
    id: "heavy",
    name: "Heavy Loader",
    rate: 45,
    description: "Up to 3000 sqft",
  },
};
const PAYMENT_METHOD_LABELS = {
  cash_on_delivery: "Cash on delivery",
  online_payment: "Online payment",
  emi: "EMI",
  bank_transfer: "Bank transfer",
};
const ALLOWED_CREATE_PAYMENT_METHODS = {
  cash_on_delivery: true,
  online_payment: true,
  emi: true,
};
const PAYMENT_STATUS_LABELS = {
  pay_on_delivery: "Pay on delivery",
  paid: "Paid online",
  awaiting_confirmation: "Awaiting confirmation",
  refunded: "Refunded",
};
const ORDER_CANCELLATION_REASONS = {
  poor_plant_health: "Poor Plant Health",
  extreme_weather_conditions: "Extreme Weather Conditions",
  out_of_stock: "Out of Stock",
  transit_safety_limit_unserviceable_location:
    "Transit Safety Limit/Unserviceable Location",
  payment_or_fraud_issue: "Payment or Fraud Issue",
  pricing_error: "Pricing Error",
};
const RECOMMENDED_PRODUCTS = {
  lawn_food: {
    id: "lawn_food",
    name: "Premium Lawn Food",
    unitLabel: "bag",
    unitPrice: 780,
  },
  root_booster: {
    id: "root_booster",
    name: "Root Booster Mix",
    unitLabel: "pack",
    unitPrice: 420,
  },
  installation_help: {
    id: "installation_help",
    name: "Installation Support",
    unitLabel: "slot",
    unitPrice: 950,
  },
};
const ORDER_STATUS_STEPS = [
  {
    key: "placed",
    title: "Order placed",
    description: "Your order has been received and is waiting for admin confirmation.",
    defaultEventMessage: "Order placed and waiting for confirmation.",
  },
  {
    key: "confirmed",
    title: "Order confirmed",
    description: "Your order has been confirmed and moved into fulfillment.",
    defaultEventMessage: "Order confirmed by admin.",
  },
  {
    key: "shipped",
    title: "Shipped",
    description: "Transport planning and dispatch updates are tracked here.",
    defaultEventMessage: "Transport and crew slot have been assigned.",
  },
  {
    key: "out_for_delivery",
    title: "Out for delivery",
    description: "The driver is on the final route to your address.",
    defaultEventMessage: "The driver is on the final route to your address.",
  },
  {
    key: "delivered",
    title: "Delivered",
    description: "The order has been delivered successfully.",
    defaultEventMessage: "The order has been delivered successfully.",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    description: "The order has been cancelled by the admin team.",
    defaultEventMessage: "Order cancelled.",
  },
  {
    key: "refunded",
    title: "Refunded",
    description: "A refund has been recorded for this order.",
    defaultEventMessage: "Order refunded.",
  },
];

const ORDER_STATUS_KEYS = ORDER_STATUS_STEPS.map((step) => step.key);
const ORDER_STATUS_STEP_MAP = new Map(
  ORDER_STATUS_STEPS.map((step) => [step.key, step]),
);
const ORDER_STATUS_ALIASES = {
  placed: "placed",
  confirmed: "confirmed",
  preparing: "confirmed",
  scheduled: "shipped",
  dispatched: "shipped",
  shipped: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  refunded: "refunded",
};
const REFUND_REQUEST_STATUSES = {
  pendingSubmission: "pending_submission",
  submitted: "submitted",
  resubmitRequired: "resubmit_required",
  refunded: "refunded",
};

const REFUND_IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const normalizeDeliveryAddress = (deliveryAddress = {}) => ({
  line1: String(deliveryAddress.line1 || "").trim(),
  line2: String(deliveryAddress.line2 || "").trim(),
  city: String(deliveryAddress.city || "").trim(),
  state: String(deliveryAddress.state || "").trim(),
  postalCode: String(deliveryAddress.postalCode || "").trim(),
  landmark: String(deliveryAddress.landmark || "").trim(),
  notes: String(deliveryAddress.notes || "").trim(),
});

const normalizeRefundRequestStatus = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (
    Object.values(REFUND_REQUEST_STATUSES).includes(normalizedValue)
  ) {
    return normalizedValue;
  }

  return null;
};

const normalizeRefundAccountDetails = (details = {}) => ({
  accountHolderName: String(
    details.accountHolderName || details.nameOnAccount || details.accountName || "",
  ).trim(),
  bankName: String(details.bankName || "").trim(),
  accountNumber: String(details.accountNumber || "").replace(/\s+/g, "").trim(),
  ifscCode: String(details.ifscCode || details.ifsc || "").trim().toUpperCase(),
});

const hasRefundAccountDetails = (details = {}) =>
  Boolean(
    details.accountHolderName &&
      details.bankName &&
      details.accountNumber &&
      details.ifscCode,
  );

const validateRefundAccountDetails = (payload = {}) => {
  const normalizedDetails = normalizeRefundAccountDetails(payload);

  if (!normalizedDetails.accountHolderName) {
    throw new ApiError(400, "Name as on account is required.");
  }

  if (!normalizedDetails.bankName) {
    throw new ApiError(400, "Bank name is required.");
  }

  if (!/^\d{6,24}$/.test(normalizedDetails.accountNumber)) {
    throw new ApiError(400, "Account number format is invalid.");
  }

  if (!REFUND_IFSC_PATTERN.test(normalizedDetails.ifscCode)) {
    throw new ApiError(400, "IFSC code format is invalid.");
  }

  return normalizedDetails;
};

const buildOrderRefundRequest = (order = {}) => {
  const currentStatus = resolveOrderStatus(order);
  const rawRefundRequest =
    order.paymentDetails &&
    typeof order.paymentDetails === "object" &&
    order.paymentDetails.refundRequest &&
    typeof order.paymentDetails.refundRequest === "object"
      ? order.paymentDetails.refundRequest
      : {};
  const accountDetails = normalizeRefundAccountDetails(
    rawRefundRequest.accountDetails || {},
  );
  const statusFromPayload = normalizeRefundRequestStatus(rawRefundRequest.status);
  const hasDetails = hasRefundAccountDetails(accountDetails);

  let status = statusFromPayload;

  if (!status) {
    if (currentStatus === "refunded") {
      status = REFUND_REQUEST_STATUSES.refunded;
    } else if (currentStatus === "cancelled" && hasDetails) {
      status = REFUND_REQUEST_STATUSES.submitted;
    } else if (currentStatus === "cancelled") {
      status = REFUND_REQUEST_STATUSES.pendingSubmission;
    } else {
      status = null;
    }
  }

  return {
    status,
    accountDetails: hasDetails ? accountDetails : null,
    adminNote: String(rawRefundRequest.adminNote || "").trim(),
    submittedAt: String(rawRefundRequest.submittedAt || "").trim() || null,
    updatedAt: String(rawRefundRequest.updatedAt || "").trim() || null,
    resubmitRequestedAt:
      String(rawRefundRequest.resubmitRequestedAt || "").trim() || null,
    refundedAt:
      String(rawRefundRequest.refundedAt || order.refundedAt || "").trim() || null,
  };
};

const buildPaymentDetailsWithRefundRequest = (order = {}, refundRequest = null) => {
  const nextPaymentDetails =
    order.paymentDetails && typeof order.paymentDetails === "object"
      ? { ...order.paymentDetails }
      : {};

  if (refundRequest) {
    nextPaymentDetails.refundRequest = refundRequest;
  } else {
    delete nextPaymentDetails.refundRequest;
  }

  return nextPaymentDetails;
};

const buildOrderItemSummary = (order = {}) => {
  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];

  if (orderItems.length > 0) {
    return orderItems
      .slice(0, 3)
      .map((item) => {
        const quantity = Number(item.quantity || 0);
        const name = String(item.name || item.productName || "Item").trim() || "Item";
        return quantity > 0 ? `${name} × ${quantity}` : name;
      })
      .join(", ");
  }

  const quantitySqft = Number(order.quantitySqft || 0);
  return quantitySqft > 0 ? `${quantitySqft} sqft order` : "";
};

const notifyOrderPrimaryStatus = async (order, statusOverride = "") => {
  const to = String(order?.email || "").trim();
  const currentStatus = normalizeOrderCurrentStatus(statusOverride || order?.currentStatus);

  if (!to || !currentStatus) {
    console.warn("[Mailer] Skipping order status email", {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      hasEmail: Boolean(to),
      status: currentStatus || null,
    });
    return null;
  }

  try {
    const result = await sendOrderStatusEmail({
      to,
      customerName: String(order.fullName || "").trim() || "Customer",
      status: currentStatus,
      orderNumber: String(order.orderNumber || "").trim(),
      trackingCode: String(order.trackingCode || "").trim(),
      deliveryDate: order.deliveryDate,
      deliveryAddress: order.deliveryAddress || {},
      billingDetails: order.billingDetails || {},
      paymentMethodLabel: order.paymentMethodLabel || "",
      paymentStatusLabel: order.paymentStatusLabel || "",
      totalAmount: Number(order?.pricing?.total || 0),
      itemSummary: buildOrderItemSummary(order),
    });

    console.info("[Mailer] Order status email processed", {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      status: currentStatus,
      email: to,
      delivered: Boolean(result?.delivered),
      skipped: Boolean(result?.skipped),
      transport: result?.transport || env.mailer.transport,
      messageId: result?.messageId || null,
    });

    return result;
  } catch (error) {
    console.error("[Mailer] Failed to send order status email", {
      orderId: order?.id,
      status: currentStatus,
      email: to,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
};

const validateDeliveryAddress = (deliveryAddress) => {
  const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);

  if (
    !normalizedDeliveryAddress.line1 ||
    !normalizedDeliveryAddress.city ||
    !normalizedDeliveryAddress.state ||
    !normalizedDeliveryAddress.postalCode
  ) {
    throw new ApiError(
      400,
      "Complete the delivery address with address line 1, city, state, and postal code.",
    );
  }

  if (!isValidPostalCode(normalizedDeliveryAddress.postalCode)) {
    throw new ApiError(400, "Postal code format is invalid.");
  }

  return normalizedDeliveryAddress;
};

const validateCreateOrderPayload = (payload) => {
  if (!payload.fullName?.trim()) {
    throw new ApiError(400, "Full name is required.");
  }

  if (!payload.phoneNumber?.trim() || !isValidPhoneNumber(payload.phoneNumber)) {
    throw new ApiError(400, "A valid phone number is required.");
  }

  const quantitySqft = Number(payload.quantitySqft);
  if (!Number.isFinite(quantitySqft) || quantitySqft <= 0) {
    throw new ApiError(400, "Quantity must be greater than zero.");
  }

  const distanceKm = Number(payload.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new ApiError(400, "Distance must be zero or greater.");
  }

  const vehicle = VEHICLES[payload.vehicleId];
  if (!vehicle) {
    throw new ApiError(400, "Select a valid transport option.");
  }

  const deliveryDate = new Date(payload.deliveryDate);
  if (Number.isNaN(deliveryDate.getTime())) {
    throw new ApiError(400, "Select a valid preferred delivery date.");
  }

  const paymentMethod = String(payload.paymentMethod || "");
  if (!ALLOWED_CREATE_PAYMENT_METHODS[paymentMethod]) {
    throw new ApiError(400, "Select a valid payment method.");
  }

  const recommendedItems = Array.isArray(payload.recommendedItems)
    ? payload.recommendedItems
    : [];

  const normalizedRecommendedItems = recommendedItems.map((item) => {
    const product = RECOMMENDED_PRODUCTS[item.id];
    const quantity = Number(item.quantity);

    if (!product) {
      throw new ApiError(400, "One of the selected recommended products is invalid.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, "Recommended product quantity must be greater than zero.");
    }

    return {
      id: product.id,
      name: product.name,
      unitLabel: product.unitLabel,
      unitPrice: product.unitPrice,
      quantity: Math.round(quantity),
      subtotal: product.unitPrice * Math.round(quantity),
    };
  });

  return {
    fullName: payload.fullName.trim(),
    email: String(payload.email || "").trim(),
    phoneNumber: payload.phoneNumber.trim(),
    quantitySqft: Math.round(quantitySqft),
    distanceKm: Number(distanceKm.toFixed(1)),
    vehicle,
    deliveryDate: deliveryDate.toISOString(),
    paymentMethod,
    deliveryAddress: validateDeliveryAddress(payload.deliveryAddress),
    recommendedItems: normalizedRecommendedItems,
  };
};

const prepareOrderForUser = async (userId, payload) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const nextOrder = validateCreateOrderPayload(payload);
  assertUserCanUsePaymentMethod(user, nextOrder.paymentMethod);
  const materialSubtotal = nextOrder.quantitySqft * GRASS_PRICE_PER_SQFT;
  const shippingSubtotal = Math.round(nextOrder.distanceKm * nextOrder.vehicle.rate);
  const recommendedSubtotal = nextOrder.recommendedItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const total = materialSubtotal + shippingSubtotal + recommendedSubtotal;

  return {
    userId,
    fullName: nextOrder.fullName,
    email: nextOrder.email || user.email,
    phoneNumber: nextOrder.phoneNumber,
    deliveryAddress: nextOrder.deliveryAddress,
    deliveryDate: nextOrder.deliveryDate,
    quantitySqft: nextOrder.quantitySqft,
    distanceKm: nextOrder.distanceKm,
    vehicle: nextOrder.vehicle,
    recommendedItems: nextOrder.recommendedItems,
    paymentMethod: nextOrder.paymentMethod,
    pricing: {
      grassPricePerSqft: GRASS_PRICE_PER_SQFT,
      materialSubtotal,
      shippingSubtotal,
      recommendedSubtotal,
      total,
    },
  };
};

const resolveLegacyOrderStatus = (order) => {
  const deliveryDateMs = new Date(order.deliveryDate).getTime();
  const diffMs = deliveryDateMs - Date.now();

  if (diffMs <= -24 * 60 * 60 * 1000) {
    return "delivered";
  }

  if (diffMs <= 2 * 60 * 60 * 1000) {
    return "out_for_delivery";
  }

  if (diffMs <= 36 * 60 * 60 * 1000) {
    return "shipped";
  }

  return "confirmed";
};

const normalizeOrderCurrentStatus = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return ORDER_STATUS_ALIASES[normalizedValue] || null;
};

const resolveOrderStatus = (order) =>
  normalizeOrderCurrentStatus(order.currentStatus) ||
  resolveLegacyOrderStatus(order);

const normalizeTrackingEntry = (entry = {}, statusKey, index = 0) => {
  const message = String(
    entry.message || entry.description || entry.note || "",
  ).trim();
  const timestamp = String(
    entry.timestamp || entry.createdAt || entry.occurredAt || "",
  ).trim();

  if (!message) {
    return null;
  }

  return {
    id:
      String(entry.id || "").trim() ||
      `${statusKey}-${index + 1}-${generateId()}`,
    message,
    timestamp: timestamp || new Date().toISOString(),
  };
};

const normalizeStoredTrackingTimeline = (trackingTimeline = []) => {
  const normalizedGroups = new Map();

  for (const step of ORDER_STATUS_STEPS) {
    normalizedGroups.set(step.key, {
      key: step.key,
      title: step.title,
      entries: [],
    });
  }

  if (!Array.isArray(trackingTimeline)) {
    return ORDER_STATUS_STEPS.map((step) => normalizedGroups.get(step.key));
  }

  trackingTimeline.forEach((group) => {
    if (!group || typeof group !== "object") {
      return;
    }

    const statusKey = normalizeOrderCurrentStatus(group.key || group.status);

    if (!statusKey) {
      return;
    }

    const step = ORDER_STATUS_STEP_MAP.get(statusKey);
    const currentGroup = normalizedGroups.get(statusKey);
    const entries = Array.isArray(group.entries)
      ? group.entries
          .map((entry, index) => normalizeTrackingEntry(entry, statusKey, index))
          .filter(Boolean)
          .sort(
            (left, right) =>
              new Date(left.timestamp).getTime() -
              new Date(right.timestamp).getTime(),
          )
      : [];

    normalizedGroups.set(statusKey, {
      key: statusKey,
      title: step.title,
      entries: [...(currentGroup?.entries || []), ...entries].sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime(),
      ),
    });
  });

  return ORDER_STATUS_STEPS.map((step) => normalizedGroups.get(step.key));
};

const appendTrackingEntryToStatus = (
  trackingTimeline = [],
  statusKey,
  message,
  timestamp = new Date().toISOString(),
) => {
  const normalizedStatusKey = normalizeOrderCurrentStatus(statusKey);
  const nextMessage = String(message || "").trim();

  if (!normalizedStatusKey || !nextMessage) {
    return normalizeStoredTrackingTimeline(trackingTimeline);
  }

  const nextTimeline = normalizeStoredTrackingTimeline(trackingTimeline);
  const targetGroup = nextTimeline.find((group) => group.key === normalizedStatusKey);

  if (!targetGroup) {
    return nextTimeline;
  }

  targetGroup.entries = [
    ...targetGroup.entries,
    {
      id: generateId(),
      message: nextMessage,
      timestamp,
    },
  ].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return nextTimeline;
};

const ensureTrackingStatusEntry = (
  trackingTimeline = [],
  statusKey,
  timestamp = new Date().toISOString(),
) => {
  const normalizedStatusKey = normalizeOrderCurrentStatus(statusKey);

  if (!normalizedStatusKey) {
    return normalizeStoredTrackingTimeline(trackingTimeline);
  }

  const nextTimeline = normalizeStoredTrackingTimeline(trackingTimeline);
  const targetGroup = nextTimeline.find((group) => group.key === normalizedStatusKey);
  const targetStep = ORDER_STATUS_STEP_MAP.get(normalizedStatusKey);

  if (!targetGroup || !targetStep) {
    return nextTimeline;
  }

  if (!targetGroup.entries.length) {
    targetGroup.entries.push({
      id: generateId(),
      message: targetStep.defaultEventMessage,
      timestamp,
    });
  }

  return nextTimeline;
};

const buildInitialTrackingTimeline = (timestamp = new Date().toISOString()) =>
  ensureTrackingStatusEntry([], "placed", timestamp);

const buildTrackingTimeline = (order) => {
  const currentStatus = resolveOrderStatus(order);
  const normalizedTimeline = normalizeStoredTrackingTimeline(order.trackingTimeline);
  const currentIndex = ORDER_STATUS_STEPS.findIndex(
    (step) => step.key === currentStatus,
  );

  return ORDER_STATUS_STEPS.map((step, index) => {
    const storedGroup =
      normalizedTimeline.find((group) => group.key === step.key) || {
        key: step.key,
        title: step.title,
        entries: [],
      };
    const latestEntry =
      storedGroup.entries[storedGroup.entries.length - 1] || null;

    return {
      key: step.key,
      title: step.title,
      description: step.description,
      state:
        index < currentIndex
          ? "complete"
          : index === currentIndex
            ? "current"
            : "upcoming",
      occurredAt: latestEntry?.timestamp || null,
      entries: storedGroup.entries,
    };
  });
};

const serializeOrder = (order) => {
  const currentStatus = resolveOrderStatus(order);
  const refundRequest = buildOrderRefundRequest(order);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingCode: order.trackingCode,
    fullName: order.fullName,
    email: order.email,
    phoneNumber: order.phoneNumber,
    deliveryAddress: order.deliveryAddress,
    deliveryDate: order.deliveryDate,
    quantitySqft: order.quantitySqft,
    distanceKm: order.distanceKm,
    vehicle: order.vehicle,
    orderItems: order.orderItems || [],
    billingDetails: order.billingDetails || {},
    deliveryLocation: order.deliveryLocation || {},
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[order.paymentMethod],
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[order.paymentStatus],
    paymentDetails: order.paymentDetails || {},
    refundAccountDetails: refundRequest.accountDetails,
    refundRequestStatus: refundRequest.status,
    refundRequestNote: refundRequest.adminNote,
    refundSubmittedAt: refundRequest.submittedAt,
    refundResubmitRequestedAt: refundRequest.resubmitRequestedAt,
    currentStatus,
    cancellationReason: order.cancellationReason || "",
    cancellationNote: order.cancellationNote || "",
    cancelledAt: order.cancelledAt || null,
    refundReason: order.refundReason || "",
    refundedAt: order.refundedAt || null,
    trackingTimeline: buildTrackingTimeline(order),
    recommendedItems: order.recommendedItems || [],
    pricing: {
      recommendedSubtotal: 0,
      ...order.pricing,
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

const createPreparedOrder = async (preparedOrder, overrides = {}) => {
  const order = await createOrder({
    ...preparedOrder,
    paymentStatus: "pay_on_delivery",
    currentStatus: "placed",
    trackingTimeline: buildInitialTrackingTimeline(),
    ...overrides,
  });

  const serializedOrder = serializeOrder(order);
  await notifyOrderPrimaryStatus(serializedOrder, serializedOrder.currentStatus);
  return serializedOrder;
};

const createUserOrder = async (userId, payload) => {
  const preparedOrder = await prepareOrderForUser(userId, payload);

  if (preparedOrder.paymentMethod !== PAYMENT_METHODS.cashOnDelivery) {
      throw new ApiError(
        400,
        "Online payment orders must be completed through the payment gateway checkout first.",
      );
  }

  return createPreparedOrder(preparedOrder, {
    paymentStatus: "pay_on_delivery",
  });
};

const listUserOrders = async (userId) =>
  (await listOrdersByUserId(userId))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(serializeOrder);

const getUserOrder = async (userId, orderId) => {
  const order = await findOrderById(orderId);

  if (!order || order.userId !== userId) {
    throw new ApiError(404, "Order not found.");
  }

  return serializeOrder(order);
};

const submitUserRefundAccountDetails = async (userId, orderId, payload = {}) => {
  const order = await findOrderById(orderId);

  if (!order || order.userId !== userId) {
    throw new ApiError(404, "Order not found.");
  }

  const currentStatus = resolveOrderStatus(order);

  if (currentStatus !== "cancelled") {
    throw new ApiError(
      400,
      "Refund account details can only be submitted after an order is cancelled.",
    );
  }

  const currentRefundRequest = buildOrderRefundRequest(order);

  if (currentRefundRequest.status === REFUND_REQUEST_STATUSES.refunded) {
    throw new ApiError(400, "This order has already been refunded.");
  }

  const accountDetails = validateRefundAccountDetails(payload);
  const nowIso = new Date().toISOString();
  const nextRefundRequest = {
    ...currentRefundRequest,
    status: REFUND_REQUEST_STATUSES.submitted,
    accountDetails,
    adminNote: "",
    submittedAt: currentRefundRequest.submittedAt || nowIso,
    updatedAt: nowIso,
    resubmitRequestedAt: null,
  };

  const updatedOrder = await updateOrder(orderId, {
    paymentDetails: buildPaymentDetailsWithRefundRequest(order, nextRefundRequest),
  });

  return serializeOrder(updatedOrder);
};

module.exports = {
  ORDER_CANCELLATION_REASONS,
  ORDER_STATUS_KEYS,
  appendTrackingEntryToStatus,
  buildInitialTrackingTimeline,
  createPreparedOrder,
  ensureTrackingStatusEntry,
  normalizeOrderCurrentStatus,
  normalizeStoredTrackingTimeline,
  prepareOrderForUser,
  createUserOrder,
  getUserOrder,
  listUserOrders,
  submitUserRefundAccountDetails,
  serializeOrder,
  notifyOrderPrimaryStatus,
  buildOrderRefundRequest,
  buildPaymentDetailsWithRefundRequest,
  REFUND_REQUEST_STATUSES,
};
