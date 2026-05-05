const { findUserById } = require("../repositories/user.repository");
const {
  createOrder,
  findOrderById,
  listOrdersByUserId,
} = require("../repositories/order.repository");
const { ApiError } = require("../utils/apiError");
const { isValidPhoneNumber, isValidPostalCode } = require("../utils/validators");

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
  bank_transfer: "Bank transfer",
};
const ALLOWED_CREATE_PAYMENT_METHODS = {
  cash_on_delivery: true,
  online_payment: true,
};
const PAYMENT_STATUS_LABELS = {
  pay_on_delivery: "Pay on delivery",
  paid: "Paid online",
  awaiting_confirmation: "Awaiting confirmation",
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
const TRACKING_STEPS = [
  {
    key: "placed",
    title: "Order placed",
    description: "Your checkout request has been received.",
  },
  {
    key: "confirmed",
    title: "Order confirmed",
    description: "Our team has reviewed the order and reserved stock.",
  },
  {
    key: "preparing",
    title: "Preparing dispatch",
    description: "Fresh carpet grass is being cut, packed, and staged.",
  },
  {
    key: "scheduled",
    title: "Delivery scheduled",
    description: "Transport and crew slot have been assigned.",
  },
  {
    key: "dispatched",
    title: "Dispatched",
    description: "Your truck has left the nursery.",
  },
  {
    key: "out_for_delivery",
    title: "Out for delivery",
    description: "The driver is on the final route to your address.",
  },
  {
    key: "delivered",
    title: "Delivered",
    description: "The order has been delivered successfully.",
  },
];

const normalizeDeliveryAddress = (deliveryAddress = {}) => ({
  line1: String(deliveryAddress.line1 || "").trim(),
  line2: String(deliveryAddress.line2 || "").trim(),
  city: String(deliveryAddress.city || "").trim(),
  state: String(deliveryAddress.state || "").trim(),
  postalCode: String(deliveryAddress.postalCode || "").trim(),
  landmark: String(deliveryAddress.landmark || "").trim(),
  notes: String(deliveryAddress.notes || "").trim(),
});

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
    email: user.email,
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

const resolveOrderStatus = (order) => {
  const deliveryDateMs = new Date(order.deliveryDate).getTime();
  const diffMs = deliveryDateMs - Date.now();

  if (diffMs <= -24 * 60 * 60 * 1000) {
    return "delivered";
  }

  if (diffMs <= 2 * 60 * 60 * 1000) {
    return "out_for_delivery";
  }

  if (diffMs <= 12 * 60 * 60 * 1000) {
    return "dispatched";
  }

  if (diffMs <= 36 * 60 * 60 * 1000) {
    return "scheduled";
  }

  if (diffMs <= 72 * 60 * 60 * 1000) {
    return "preparing";
  }

  return "confirmed";
};

const buildTrackingTimeline = (order) => {
  const currentStatus = resolveOrderStatus(order);
  const currentIndex = TRACKING_STEPS.findIndex((step) => step.key === currentStatus);

  return TRACKING_STEPS.map((step, index) => ({
    key: step.key,
    title: step.title,
    description: step.description,
    state:
      index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "upcoming",
  }));
};

const serializeOrder = (order) => {
  const currentStatus = resolveOrderStatus(order);

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
    currentStatus,
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
    ...overrides,
  });

  return serializeOrder(order);
};

const createUserOrder = async (userId, payload) => {
  const preparedOrder = await prepareOrderForUser(userId, payload);

  if (preparedOrder.paymentMethod !== "cash_on_delivery") {
    throw new ApiError(
      400,
      "Online payment orders must be completed through Razorpay checkout first.",
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

module.exports = {
  createPreparedOrder,
  prepareOrderForUser,
  createUserOrder,
  getUserOrder,
  listUserOrders,
  serializeOrder,
};
