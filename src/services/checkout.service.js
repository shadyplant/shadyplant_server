const { env } = require("../config/env");
const { findCartByUserId } = require("../repositories/cart.repository");
const {
  findCouponCodeByCode,
  reserveCouponCode,
  releaseCouponReservation,
  consumeReservedCouponCode,
} = require("../repositories/coupon.repository");
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
  COUPON_STATUSES,
  COUPON_TYPES,
  calculateCouponApplication,
  normalizeCouponCode,
  resolveCouponEffectiveStatus,
} = require("./coupon.service");
const {
  calculateTransportCharge,
  getDistanceKmForLocation,
  resolveDeliveryState,
} = require("./delivery.service");
const {
  createOrderStatusNotification,
  notifyOrderPrimaryStatus,
  serializeOrder,
} = require("./order.service");
const {
  buildPaymentReturnUrl,
  createRemotePaymentOrder,
  ensurePaymentGatewayCheckoutConfigured,
} = require("./payment-gateway.service");
const {
  PAYMENT_METHODS,
  assertUserCanUsePaymentMethod,
} = require("./user-account.service");

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

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));

const buildCouponUnavailableError = (message) =>
  new ApiError(409, message || "Coupon is unavailable right now.");

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

const validateCouponForCheckout = async ({
  userId,
  couponCode,
  reservationReference = "",
}) => {
  const normalizedCouponCode = normalizeCouponCode(couponCode);

  if (!normalizedCouponCode) {
    return null;
  }

  const coupon = await findCouponCodeByCode(normalizedCouponCode);

  if (!coupon) {
    throw new ApiError(404, "Coupon code is invalid.");
  }

  const effectiveStatus = resolveCouponEffectiveStatus(coupon);

  if (effectiveStatus === COUPON_STATUSES.inactive) {
    throw buildCouponUnavailableError("Coupon is inactive right now.");
  }

  if (effectiveStatus === COUPON_STATUSES.used) {
    throw buildCouponUnavailableError("Coupon has already been used.");
  }

  if (effectiveStatus === COUPON_STATUSES.expired) {
    throw buildCouponUnavailableError("Coupon has expired.");
  }

  const reservationExpiryTimestamp = coupon.reservationExpiresAt
    ? new Date(coupon.reservationExpiresAt).getTime()
    : 0;
  const hasActiveReservation =
    Boolean(coupon.reservedReference) &&
    Number.isFinite(reservationExpiryTimestamp) &&
    reservationExpiryTimestamp > Date.now();

  if (
    hasActiveReservation &&
    coupon.reservedReference !== reservationReference &&
    coupon.reservedByUserId !== userId
  ) {
    throw buildCouponUnavailableError(
      "Coupon is currently reserved for another checkout. Please try again shortly.",
    );
  }

  return coupon;
};

const applyCouponToPricing = ({ pricing, coupon }) => {
  if (!coupon) {
    return {
      pricing: {
        ...pricing,
        totalBeforeCoupon: pricing.total,
        couponCode: "",
        couponType: "",
        couponDiscountValue: 0,
        couponAdjustAmount: 0,
        couponDiscountPercent: 0,
        itemsSubtotalAfterCoupon: pricing.itemsSubtotal,
      },
      appliedCoupon: null,
    };
  }

  const couponCalculation = calculateCouponApplication({
    type: coupon.type,
    adjustAmount: coupon.adjustAmount,
    discountPercent: coupon.discountPercent,
    totalProductsPrice: pricing.itemsSubtotal,
    totalPayableAmount: pricing.total,
  });

  return {
    pricing: {
      ...pricing,
      totalBeforeCoupon: pricing.total,
      total: roundCurrency(couponCalculation.adjustedTotalPayable),
      couponCode: coupon.code,
      couponType: coupon.type,
      couponDiscountValue: roundCurrency(couponCalculation.discountValue),
      couponAdjustAmount:
        coupon.type === COUPON_TYPES.adjust ? coupon.adjustAmount : 0,
      couponDiscountPercent:
        coupon.type === COUPON_TYPES.discount ? coupon.discountPercent : 0,
      itemsSubtotalAfterCoupon: roundCurrency(
        couponCalculation.adjustedProductTotal,
      ),
    },
    appliedCoupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      adjustAmount: coupon.adjustAmount,
      discountPercent: coupon.discountPercent,
      discountValue: roundCurrency(couponCalculation.discountValue),
    },
  };
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
    const unitMrp = Number(
      resolvedVariant.mrp || product.mrp || resolvedVariant.price || product.price || 0,
    );
    const unitWeightKg = Number(resolvedVariant.weight || product.weight || 0);
    const unitDiscount = Math.max(0, unitMrp - unitPrice);
    const discountPercent =
      unitMrp > 0 ? Number(((unitDiscount / unitMrp) * 100).toFixed(2)) : 0;
    const itemImages = [...new Set(
      [
        ...(Array.isArray(product.images) ? product.images : []),
        product.image,
      ]
        .map((image) => String(image || "").trim())
        .filter(Boolean),
    )].slice(0, 3);
    return {
      productId: product.id,
      variantId: resolvedVariant.variantId,
      variantLabel: resolvedVariant.displayLabel,
      optionSelections: resolvedVariant.optionSelections,
      name: product.name,
      category: product.category,
      image: itemImages[0] || product.image,
      images: itemImages,
      packLabel: resolvedVariant.packLabel || product.packLabel,
      unit: product.unit,
      quantity,
      unitPrice,
      unitMrp,
      unitDiscount,
      discountPercent,
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
  const deliveryState =
    String(payload.deliveryAddress?.state || payload.state || "").trim() ||
    (await resolveDeliveryState(deliveryLocation));

  if (!deliveryState) {
    throw new ApiError(
      400,
      "Delivery state is required. Pass state from the frontend or provide a lat/lng pair for geo lookup.",
    );
  }

  const cart = await getCartLineItems(userId);
  const deliveryResult = calculateTransportCharge(
    cart.summary.totalWeightKg,
    distanceKm,
    deliveryState,
  );

  if (!deliveryResult.success) {
    throw new ApiError(400, deliveryResult.message);
  }

  const deliveryCharge = Math.max(0, Math.round(Number(deliveryResult.cost || 0)));
  const basePricing = {
    itemsSubtotal: cart.summary.itemsSubtotal,
    deliveryCharge,
    total: cart.summary.itemsSubtotal + deliveryCharge,
    currency: cart.summary.currency,
    distanceKm,
    deliveryRate: deliveryResult.rate || 0,
    totalWeightKg: cart.summary.totalWeightKg,
  };
  const coupon = await validateCouponForCheckout({
    userId,
    couponCode: payload.couponCode,
  });
  const couponPricing = applyCouponToPricing({
    pricing: basePricing,
    coupon,
  });

  return {
    user,
    orderSource: "cart_checkout",
    deliveryAddress,
    deliveryLocation,
    orderItems: cart.orderItems,
    summary: cart.summary,
    pricing: couponPricing.pricing,
    appliedCoupon: couponPricing.appliedCoupon,
    deliveryState,
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
    email: billingDetails.email || preview.user.email,
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
    deliveryState: preview.deliveryState,
    summary: preview.summary,
    pricing: preview.pricing,
    deliveryChargeDetails: preview.deliveryChargeDetails,
    appliedCoupon: preview.appliedCoupon,
    suggestedDeliveryDate: preview.suggestedDeliveryDate,
  };
};

const placeCartOrderCashOnDelivery = async (userId, payload = {}) => {
  const customer = await findUserById(userId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  assertUserCanUsePaymentMethod(customer, PAYMENT_METHODS.cashOnDelivery);

  const preparedOrder = await buildPreparedCartOrder(
    userId,
    payload,
    PAYMENT_METHODS.cashOnDelivery,
  );
  const couponReservationReference = preparedOrder.appliedCoupon?.code
    ? `cod:${userId}:${Date.now()}`
    : "";

  if (preparedOrder.appliedCoupon?.code) {
    const reservedCoupon = await reserveCouponCode({
      code: preparedOrder.appliedCoupon.code,
      reservationReference: couponReservationReference,
      userId,
      reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (!reservedCoupon) {
      throw buildCouponUnavailableError(
        "Coupon is unavailable right now. Refresh checkout and try again.",
      );
    }

    preparedOrder.appliedCoupon = {
      ...preparedOrder.appliedCoupon,
      reservationReference: couponReservationReference,
    };
  }

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
      currentStatus: "placed",
      paymentDetails: {
        provider: "cash_on_delivery",
        checkoutSource: preparedOrder.orderSource,
      },
      pricing: {
        ...preparedOrder.pricing,
        checkoutSource: preparedOrder.orderSource,
      },
    });

    if (preparedOrder.appliedCoupon?.code && couponReservationReference) {
      const consumedCoupon = await consumeReservedCouponCode({
        code: preparedOrder.appliedCoupon.code,
        reservationReference: couponReservationReference,
        userId,
        orderId: order.id,
      });

      if (!consumedCoupon) {
        throw buildCouponUnavailableError(
          "Coupon could not be finalized for this order. Please try again.",
        );
      }
    }
  } catch (error) {
    await releaseProductStocks(preparedOrder.orderItems);
    if (couponReservationReference) {
      await releaseCouponReservation(couponReservationReference);
    }
    throw error;
  }

  await consumeUserCartItems(userId, preparedOrder.orderItems);
  const serializedOrder = await serializeOrder(order);
  await notifyOrderPrimaryStatus(serializedOrder, serializedOrder.currentStatus);
  await createOrderStatusNotification(order, serializedOrder.currentStatus);
  return serializedOrder;
};

const createCartPaymentCheckout = async (userId, payload = {}, options = {}) => {
  const provider = await ensurePaymentGatewayCheckoutConfigured();
  const checkoutContext = String(options.context || "storefront")
    .trim()
    .toLowerCase();
  const paymentMethod =
    String(payload.paymentMethod || PAYMENT_METHODS.onlinePayment)
      .trim()
      .toLowerCase() || PAYMENT_METHODS.onlinePayment;

  if (
    paymentMethod !== PAYMENT_METHODS.onlinePayment &&
    paymentMethod !== PAYMENT_METHODS.emi
  ) {
    throw new ApiError(400, "Select a valid online payment method.");
  }

  const customer = await findUserById(userId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  assertUserCanUsePaymentMethod(customer, paymentMethod);

  let preparedOrder = await buildPreparedCartOrder(
    userId,
    payload,
    paymentMethod,
  );

  const paymentAttempt = await createPaymentAttempt({
    userId,
    status: "created",
    amount: preparedOrder.pricing.total,
    currency: preparedOrder.pricing.currency,
    paymentMethod,
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
      paymentMethod,
      pricing: {
        ...preparedOrder.pricing,
        checkoutSource: preparedOrder.orderSource,
      },
    },
    orderId: null,
    gateway: {
      provider,
    },
  });

  if (preparedOrder.appliedCoupon?.code) {
    const reservationExpiresAt = new Date(
      Date.now() + (env.paymentGateway.orderExpireAfterSeconds + 900) * 1000,
    ).toISOString();
    const reservedCoupon = await reserveCouponCode({
      code: preparedOrder.appliedCoupon.code,
      reservationReference: paymentAttempt.id,
      userId,
      reservationExpiresAt,
    });

    if (!reservedCoupon) {
      await updatePaymentAttempt(paymentAttempt.id, {
        status: "failed",
        failureReason: "Coupon is unavailable right now. Refresh checkout and try again.",
      });
      throw buildCouponUnavailableError(
        "Coupon is unavailable right now. Refresh checkout and try again.",
      );
    }

    preparedOrder = {
      ...preparedOrder,
      appliedCoupon: {
        ...preparedOrder.appliedCoupon,
        reservationReference: paymentAttempt.id,
      },
    };

    await updatePaymentAttempt(paymentAttempt.id, {
      checkoutPayload: {
        ...preparedOrder,
      },
    });
  }

  try {
    const returnUrl = buildPaymentReturnUrl(
      payload.returnPath,
      paymentAttempt.id,
      "/order-summary",
    );
    const gatewayOrder = await createRemotePaymentOrder({
      merchantOrderId: paymentAttempt.id,
      amount: Math.round(Number(preparedOrder.pricing.total || 0) * 100),
      currency: preparedOrder.pricing.currency,
      customerId: userId,
      customerName: preparedOrder.fullName,
      customerEmail: preparedOrder.email,
      customerPhone: preparedOrder.phoneNumber,
      returnUrl,
      description: `Checkout for ${preparedOrder.summary.itemCount} cart item(s)`,
      expireAfter: env.paymentGateway.orderExpireAfterSeconds,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: `Cart checkout for ${preparedOrder.summary.itemCount} cart item(s)`,
        merchantUrls: {
          redirectUrl: returnUrl,
        },
      },
      disablePaymentRetry: false,
      metaInfo: {
        udf1: preparedOrder.orderSource,
        udf2: paymentAttempt.id,
        udf3: userId,
      },
      prefillUserLoginDetails: {
        phoneNumber: preparedOrder.phoneNumber,
      },
    }, {
      provider,
      context: checkoutContext,
    });

    await updatePaymentAttempt(paymentAttempt.id, {
      status: "checkout_ready",
      gateway: {
        provider,
        merchantOrderId: paymentAttempt.id,
        gatewayOrderId: gatewayOrder.orderId,
        redirectUrl: gatewayOrder.redirectUrl,
        paymentSessionId: gatewayOrder.paymentSessionId || "",
        amount: preparedOrder.pricing.total,
        amountPaisa: gatewayOrder.amount || Math.round(Number(preparedOrder.pricing.total || 0) * 100),
        currency: preparedOrder.pricing.currency,
        status: gatewayOrder.state,
        expiresAt: gatewayOrder.expireAt || null,
      },
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      status: "checkout_ready",
      statusLabel: PAYMENT_STATUS_LABELS.checkout_ready,
      provider,
      merchantOrderId: paymentAttempt.id,
      gatewayOrderId: gatewayOrder.orderId,
      redirectUrl: gatewayOrder.redirectUrl,
      paymentSessionId: gatewayOrder.paymentSessionId || "",
      amount: preparedOrder.pricing.total,
      currency: preparedOrder.pricing.currency,
      businessName: "Grass Green Nursery",
      description: `Checkout for ${preparedOrder.summary.itemCount} cart item(s)`,
      prefill: {
        name: preparedOrder.fullName,
        email: preparedOrder.email,
        contact: preparedOrder.phoneNumber,
      },
      mode: env.paymentGateway.mode,
      returnUrl,
    };
  } catch (error) {
    if (preparedOrder.appliedCoupon?.reservationReference) {
      await releaseCouponReservation(preparedOrder.appliedCoupon.reservationReference);
    }
    await updatePaymentAttempt(paymentAttempt.id, {
      status: "failed",
      failureReason:
        error instanceof Error ? error.message : "Unable to start checkout.",
    });
    throw error;
  }
};

module.exports = {
  createCartPaymentCheckout,
  placeCartOrderCashOnDelivery,
  previewCartCheckout,
};

