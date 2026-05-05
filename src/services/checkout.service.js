const { env } = require("../config/env");
const { findCartByUserId } = require("../repositories/cart.repository");
const { createOrder } = require("../repositories/order.repository");
const {
  createPaymentAttempt,
  updatePaymentAttempt,
} = require("../repositories/payment.repository");
const {
  findProductById,
  findProductsByIds,
  releaseProductStocks,
  resolveProductVariant,
  reserveProductStocks,
} = require("../repositories/product.repository");
const { findUserById } = require("../repositories/user.repository");
const { ApiError } = require("../utils/apiError");
const { isValidPhoneNumber } = require("../utils/validators");
const { consumeUserCartItems } = require("./cart.service");
const {
  calculateTransportCharge,
  getDistanceKmForLocation,
} = require("./delivery.service");
const { serializeOrder } = require("./order.service");
const {
  createRemoteRazorpayOrder,
  ensureRazorpayCheckoutConfigured,
} = require("./razorpay.service");

const PAYMENT_STATUS_LABELS = {
  created: "Draft created",
  checkout_ready: "Checkout ready",
  completed: "Payment verified",
  failed: "Payment failed",
};

const getAvailableStock = (product) =>
  Math.max(0, Math.floor(Number(product?.stock || 0)));

const buildStockErrorMessage = (product, requestedQuantity) => {
  const productName = String(product?.name || "This product").trim();
  const availableStock = getAvailableStock(product);

  if (availableStock <= 0) {
    return `${productName} is out of stock right now.`;
  }

  return `Only ${availableStock} unit(s) of ${productName} are available right now.`;
};

const normalizeString = (value) => String(value || "").trim();

const normalizeDeliveryAddress = (deliveryAddress = {}) => {
  if (typeof deliveryAddress === "string") {
    return {
      formattedAddress: deliveryAddress.trim(),
      line1: deliveryAddress.trim(),
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      landmark: "",
      notes: "",
    };
  }

  const formattedAddress = normalizeString(
    deliveryAddress.formattedAddress ||
      deliveryAddress.address ||
      deliveryAddress.line1,
  );

  return {
    formattedAddress,
    line1: normalizeString(deliveryAddress.line1 || formattedAddress),
    line2: normalizeString(deliveryAddress.line2),
    city: normalizeString(deliveryAddress.city),
    state: normalizeString(deliveryAddress.state),
    postalCode: normalizeString(deliveryAddress.postalCode),
    landmark: normalizeString(deliveryAddress.landmark),
    notes: normalizeString(deliveryAddress.notes),
  };
};

const validateDeliveryAddress = (deliveryAddress) => {
  const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);

  if (!normalizedDeliveryAddress.line1 && !normalizedDeliveryAddress.formattedAddress) {
    throw new ApiError(400, "Select a delivery address before checkout.");
  }

  return normalizedDeliveryAddress;
};

const normalizeBillingDetails = (billingDetails = {}, user = null) => {
  const name = normalizeString(billingDetails.name || billingDetails.fullName || user?.fullName);
  const contact = normalizeString(
    billingDetails.contact || billingDetails.phoneNumber || user?.phoneNumber,
  );
  const email = normalizeString(billingDetails.email || user?.email);
  const address = normalizeString(billingDetails.address);
  const city = normalizeString(billingDetails.city);
  const state = normalizeString(billingDetails.state);
  const gstin = normalizeString(billingDetails.gstin);

  if (!name) {
    throw new ApiError(400, "Billing name is required.");
  }

  if (!contact || !isValidPhoneNumber(contact)) {
    throw new ApiError(400, "A valid billing contact number is required.");
  }

  if (!address) {
    throw new ApiError(400, "Billing address is required.");
  }

  if (!city) {
    throw new ApiError(400, "Billing city is required.");
  }

  if (!state) {
    throw new ApiError(400, "Billing state is required.");
  }

  return {
    name,
    contact,
    email,
    address,
    city,
    state,
    gstin,
  };
};

const getSuggestedDeliveryDate = () => {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + env.delivery.cartDeliveryOffsetDays);
  return deliveryDate.toISOString();
};

const getCartLineItems = async (userId) => {
  const cartState = await findCartByUserId(userId);
  const cartItems = Array.isArray(cartState.items) ? cartState.items : [];

  if (!cartItems.length) {
    throw new ApiError(400, "Your cart is empty.");
  }

  const products = await findProductsByIds(cartItems.map((item) => item.productId));
  const productsById = new Map(products.map((product) => [product.id, product]));

  const missingProductIds = cartItems
    .map((item) => normalizeString(item.productId))
    .filter((productId) => productId && !productsById.has(productId));

  if (missingProductIds.length) {
    throw new ApiError(
      400,
      "Some cart items are no longer available. Refresh your cart and try again.",
    );
  }

  const orderItems = cartItems.map((cartItem) => {
    const product = productsById.get(normalizeString(cartItem.productId));
    const quantity = Math.max(1, Math.floor(Number(cartItem.quantity || 0)));
    const resolvedVariant = resolveProductVariant(product, {
      variantId: cartItem.variantId,
      optionSelections:
        cartItem.optionSelections || cartItem.metadata?.optionSelections,
    });
    const availableStock = getAvailableStock(product);

    if (quantity > availableStock) {
      throw new ApiError(409, buildStockErrorMessage(product, quantity));
    }

    if (quantity > Math.max(0, Math.floor(Number(resolvedVariant.stock || 0)))) {
      throw new ApiError(
        409,
        buildStockErrorMessage(
          {
            ...product,
            name: resolvedVariant.displayLabel
              ? `${product.name} (${resolvedVariant.displayLabel})`
              : product.name,
            stock: resolvedVariant.stock,
          },
          quantity,
        ),
      );
    }

    const unitPrice = Number(resolvedVariant.price || product.price || 0);
    const unitWeightKg = Number(resolvedVariant.weight || product.weight || 0);

    return {
      productId: product.id,
      variantId: resolvedVariant.variantId,
      variantLabel: resolvedVariant.displayLabel,
      optionSelections: resolvedVariant.optionSelections,
      name: product.name,
      category: product.category,
      image: product.image,
      packLabel: resolvedVariant.packLabel || product.packLabel,
      unit: product.unit,
      quantity,
      unitPrice,
      unitWeightKg,
      availableStock,
      totalWeightKg: Number((unitWeightKg * quantity).toFixed(2)),
      subtotal: unitPrice * quantity,
      currency: "INR",
    };
  });

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemsSubtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalWeightKg = orderItems.reduce(
    (sum, item) => sum + Number(item.totalWeightKg || 0),
    0,
  );
  const roundedTotalWeightKg = Number(totalWeightKg.toFixed(2));

  return {
    orderItems,
    summary: {
      itemCount: orderItems.length,
      totalQuantity,
      totalWeightKg: roundedTotalWeightKg > 0 ? roundedTotalWeightKg : 0,
      itemsSubtotal: Math.round(itemsSubtotal),
      currency: "INR",
    },
  };
};

const reservePreparedOrderStock = async (orderItems = []) => {
  const reservationResult = await reserveProductStocks(orderItems);

  if (reservationResult.success) {
    return;
  }

  const failedProduct = await findProductById(reservationResult.failedItem?.productId);
  throw new ApiError(
    409,
    buildStockErrorMessage(
      failedProduct,
      reservationResult.failedItem?.quantity || 0,
    ),
  );
};

const buildCheckoutPreview = async (userId, payload = {}) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const deliveryAddress = validateDeliveryAddress(payload.deliveryAddress);
  const deliveryLocation = {
    lat: Number(payload.deliveryLocation?.lat ?? payload.lat),
    lng: Number(payload.deliveryLocation?.lng ?? payload.lng),
  };
  const distanceKm = await getDistanceKmForLocation(deliveryLocation);
  const cart = await getCartLineItems(userId);
  const deliveryResult = calculateTransportCharge(
    cart.summary.totalWeightKg,
    distanceKm,
  );

  if (!deliveryResult.success) {
    throw new ApiError(400, deliveryResult.message);
  }

  const deliveryCharge = Math.max(0, Math.round(Number(deliveryResult.cost || 0)));
  const total = cart.summary.itemsSubtotal + deliveryCharge;

  return {
    user,
    orderSource: "cart_checkout",
    deliveryAddress,
    deliveryLocation,
    orderItems: cart.orderItems,
    summary: cart.summary,
    pricing: {
      itemsSubtotal: cart.summary.itemsSubtotal,
      deliveryCharge,
      total,
      currency: cart.summary.currency,
      distanceKm,
      deliveryRate: deliveryResult.rate || 0,
      totalWeightKg: cart.summary.totalWeightKg,
    },
    deliveryChargeDetails: {
      message: deliveryResult.message,
      rate: deliveryResult.rate || 0,
      units: deliveryResult.units ?? null,
    },
    suggestedDeliveryDate: getSuggestedDeliveryDate(),
  };
};

const buildPreparedCartOrder = async (userId, payload = {}, paymentMethod) => {
  const preview = await buildCheckoutPreview(userId, payload);
  const billingDetails = normalizeBillingDetails(payload.billingDetails, preview.user);
  const requestedDeliveryDate = normalizeString(payload.deliveryDate);
  const deliveryDate = requestedDeliveryDate || preview.suggestedDeliveryDate;
  const parsedDeliveryDate = new Date(deliveryDate);

  if (Number.isNaN(parsedDeliveryDate.getTime())) {
    throw new ApiError(400, "Select a valid delivery date.");
  }

  return {
    ...preview,
    fullName: billingDetails.name,
    phoneNumber: billingDetails.contact,
    email: preview.user.email,
    billingDetails,
    deliveryDate: parsedDeliveryDate.toISOString(),
    paymentMethod,
    vehicle: {
      id: "server_delivery_formula",
      name: "Server Calculated Delivery",
      rate: preview.pricing.deliveryRate,
      description: `${preview.summary.totalWeightKg} kg chargeable weight`,
    },
  };
};

const previewCartCheckout = async (userId, payload = {}) => {
  const preview = await buildCheckoutPreview(userId, payload);

  return {
    deliveryAddress: preview.deliveryAddress,
    deliveryLocation: preview.deliveryLocation,
    summary: preview.summary,
    pricing: preview.pricing,
    deliveryChargeDetails: preview.deliveryChargeDetails,
    suggestedDeliveryDate: preview.suggestedDeliveryDate,
  };
};

const placeCartOrderCashOnDelivery = async (userId, payload = {}) => {
  const preparedOrder = await buildPreparedCartOrder(
    userId,
    payload,
    "cash_on_delivery",
  );
  await reservePreparedOrderStock(preparedOrder.orderItems);

  let order;

  try {
    order = await createOrder({
      userId,
      fullName: preparedOrder.fullName,
      email: preparedOrder.email,
      phoneNumber: preparedOrder.phoneNumber,
      deliveryAddress: preparedOrder.deliveryAddress,
      deliveryDate: preparedOrder.deliveryDate,
      quantitySqft: preparedOrder.summary.totalQuantity,
      distanceKm: preparedOrder.pricing.distanceKm,
      vehicle: preparedOrder.vehicle,
      orderItems: preparedOrder.orderItems,
      recommendedItems: [],
      billingDetails: preparedOrder.billingDetails,
      deliveryLocation: preparedOrder.deliveryLocation,
      paymentMethod: "cash_on_delivery",
      paymentStatus: "pay_on_delivery",
      paymentDetails: {
        provider: "cash_on_delivery",
        checkoutSource: preparedOrder.orderSource,
      },
      pricing: {
        ...preparedOrder.pricing,
        checkoutSource: preparedOrder.orderSource,
      },
    });
  } catch (error) {
    await releaseProductStocks(preparedOrder.orderItems);
    throw error;
  }

  await consumeUserCartItems(userId, preparedOrder.orderItems);
  return serializeOrder(order);
};

const createCartRazorpayCheckout = async (userId, payload = {}) => {
  ensureRazorpayCheckoutConfigured();

  const preparedOrder = await buildPreparedCartOrder(
    userId,
    payload,
    "online_payment",
  );

  const paymentAttempt = await createPaymentAttempt({
    userId,
    status: "created",
    amount: preparedOrder.pricing.total,
    currency: preparedOrder.pricing.currency,
    paymentMethod: "online_payment",
    checkoutPayload: {
      userId,
      orderSource: preparedOrder.orderSource,
      fullName: preparedOrder.fullName,
      email: preparedOrder.email,
      phoneNumber: preparedOrder.phoneNumber,
      deliveryAddress: preparedOrder.deliveryAddress,
      deliveryLocation: preparedOrder.deliveryLocation,
      deliveryDate: preparedOrder.deliveryDate,
      quantitySqft: preparedOrder.summary.totalQuantity,
      distanceKm: preparedOrder.pricing.distanceKm,
      vehicle: preparedOrder.vehicle,
      orderItems: preparedOrder.orderItems,
      recommendedItems: [],
      billingDetails: preparedOrder.billingDetails,
      paymentMethod: "online_payment",
      pricing: {
        ...preparedOrder.pricing,
        checkoutSource: preparedOrder.orderSource,
      },
    },
    orderId: null,
    razorpay: {},
  });

  try {
    const razorpayOrder = await createRemoteRazorpayOrder({
      amount: preparedOrder.pricing.total * 100,
      currency: preparedOrder.pricing.currency,
      receipt: `GGN-CART-${paymentAttempt.id.slice(0, 10)}`,
      notes: {
        paymentAttemptId: paymentAttempt.id,
        userId,
        source: preparedOrder.orderSource,
      },
    });

    await updatePaymentAttempt(paymentAttempt.id, {
      status: "checkout_ready",
      razorpay: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        notes: razorpayOrder.notes || {},
      },
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      status: "checkout_ready",
      statusLabel: PAYMENT_STATUS_LABELS.checkout_ready,
      keyId: env.razorpay.keyId,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      businessName: "Grass Green Nursery",
      description: `Checkout for ${preparedOrder.summary.itemCount} cart item(s)`,
      prefill: {
        name: preparedOrder.fullName,
        email: preparedOrder.email,
        contact: preparedOrder.phoneNumber,
      },
      shouldSimulateWebhook: !env.razorpay.isWebhookConfigured,
    };
  } catch (error) {
    await updatePaymentAttempt(paymentAttempt.id, {
      status: "failed",
      failureReason:
        error instanceof Error ? error.message : "Unable to start checkout.",
    });
    throw error;
  }
};

module.exports = {
  createCartRazorpayCheckout,
  placeCartOrderCashOnDelivery,
  previewCartCheckout,
};
