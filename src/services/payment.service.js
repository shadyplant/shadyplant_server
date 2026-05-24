const { env } = require("../config/env");
const {
  consumeReservedCouponCode,
  releaseCouponReservation,
} = require("../repositories/coupon.repository");
const {
  claimPaymentAttemptForFinalization,
  createPaymentAttempt,
  findPaymentAttemptById,
  updatePaymentAttempt,
} = require("../repositories/payment.repository");
const {
  findProductById,
  releaseProductStocks,
  reserveProductStocks,
} = require("../repositories/product.repository");
const { findOrderByPaymentReference } = require("../repositories/order.repository");
const { ApiError } = require("../utils/apiError");
const { consumeUserCartItems } = require("./cart.service");
const {
  buildPaymentReturnUrl,
  createRemotePaymentOrder,
  ensurePaymentGatewayCheckoutConfigured,
  ensurePaymentGatewayWebhookConfigured,
  verifyPaymentGatewayWebhookAuthorization,
} = require("./payment-gateway.service");
const { createPreparedOrder, prepareOrderForUser } = require("./order.service");
const { PAYMENT_METHODS } = require("./user-account.service");

const CHECKOUT_STATUS_LABELS = {
  created: "Draft created",
  checkout_ready: "Checkout ready",
  processing: "Payment processing",
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

const normalizeGatewayState = (value) => normalizeString(value).toUpperCase();

const toExpectedAmountPaisa = (amount) =>
  Math.round(Number(amount || 0) * 100);

const getPaymentAttemptProvider = (paymentAttempt) =>
  normalizeString(paymentAttempt?.gateway?.provider) || "";

const serializePaymentAttempt = (paymentAttempt) => ({
  id: paymentAttempt.id,
  status: paymentAttempt.status,
  statusLabel:
    CHECKOUT_STATUS_LABELS[paymentAttempt.status] || "Payment update pending",
  orderId: paymentAttempt.orderId || null,
  amount: paymentAttempt.amount,
  currency: paymentAttempt.currency,
  paymentMethod: paymentAttempt.paymentMethod,
  provider: normalizeString(paymentAttempt.gateway?.provider) || env.paymentGateway.provider,
  createdAt: paymentAttempt.createdAt,
  updatedAt: paymentAttempt.updatedAt,
});

const extractGatewayWebhookPayload = (event = {}, provider = "phonepe") => {
  if (provider === "cashfree") {
    const order = event?.data?.order || event?.order || {};
    const payment = event?.data?.payment || event?.payment || {};
    const errorDetails = payment?.error_details || event?.data?.error_details || {};

    return {
      eventName:
        normalizeString(event?.type) ||
        normalizeString(event?.event) ||
        normalizeString(event?.name),
      payload: {
        merchantOrderId: normalizeString(order?.order_id),
        orderId: normalizeString(order?.cf_order_id),
        state:
          normalizeString(payment?.payment_status) ||
          normalizeString(order?.order_status),
        amount: Number.isFinite(Number(payment?.payment_amount))
          ? toExpectedAmountPaisa(payment?.payment_amount)
          : toExpectedAmountPaisa(order?.order_amount),
        raw: event,
      },
      paymentDetail: {
        transactionId: normalizeString(payment?.cf_payment_id),
        paymentMode:
          normalizeString(payment?.payment_group) ||
          normalizeString(payment?.payment_method),
        state:
          normalizeString(payment?.payment_status) ||
          normalizeString(order?.order_status),
        amount: Number.isFinite(Number(payment?.payment_amount))
          ? toExpectedAmountPaisa(payment?.payment_amount)
          : undefined,
        rail: payment?.payment_method || {},
        instrument: payment?.payment_method || {},
        errorCode: normalizeString(errorDetails?.error_code),
        detailedErrorCode: normalizeString(errorDetails?.error_description),
      },
      paymentDetails: payment ? [payment] : [],
    };
  }

  const payload = event?.data || event?.payload || {};
  const paymentDetails = Array.isArray(payload.paymentDetails)
    ? payload.paymentDetails
    : [];

  return {
    eventName:
      normalizeString(event?.event) ||
      normalizeString(event?.type) ||
      normalizeString(event?.name),
    payload,
    paymentDetail: paymentDetails[0] || {},
    paymentDetails,
  };
};

const locatePaymentAttempt = async (eventPayload, provider = "phonepe") => {
  const { payload } = extractGatewayWebhookPayload(eventPayload, provider);
  const paymentAttemptId = normalizeString(payload?.merchantOrderId);

  if (!paymentAttemptId) {
    return null;
  }

  return findPaymentAttemptById(paymentAttemptId);
};

const assertWebhookProviderMatchesPaymentAttempt = (paymentAttempt, provider) => {
  const attemptProvider = getPaymentAttemptProvider(paymentAttempt);
  const webhookProvider = normalizeString(provider);

  if (!attemptProvider) {
    throw new ApiError(
      409,
      "Payment attempt provider is missing. This webhook cannot be processed safely.",
    );
  }

  if (!webhookProvider) {
    throw new ApiError(400, "Webhook provider could not be determined.");
  }

  if (attemptProvider !== webhookProvider) {
    throw new ApiError(
      409,
      `Webhook provider mismatch. Attempt belongs to ${attemptProvider} but received ${webhookProvider}.`,
    );
  }

  return attemptProvider;
};

const createPaymentCheckout = async (userId, payload) => {
  const provider = await ensurePaymentGatewayCheckoutConfigured();

  const preparedOrder = await prepareOrderForUser(userId, payload);

  if (
    preparedOrder.paymentMethod !== PAYMENT_METHODS.onlinePayment &&
    preparedOrder.paymentMethod !== PAYMENT_METHODS.emi
  ) {
    throw new ApiError(
      400,
      "Use an online payment method for gateway checkout.",
    );
  }

  const paymentAttempt = await createPaymentAttempt({
    userId,
    status: "created",
    amount: preparedOrder.pricing.total,
    currency: "INR",
    paymentMethod: preparedOrder.paymentMethod,
    checkoutPayload: preparedOrder,
    orderId: null,
    gateway: {
      provider,
    },
  });

  try {
    const returnUrl = buildPaymentReturnUrl(
      payload?.returnPath,
      paymentAttempt.id,
      "/checkout",
    );
    const gatewayOrder = await createRemotePaymentOrder({
      merchantOrderId: paymentAttempt.id,
      amount: Math.round(Number(preparedOrder.pricing.total || 0) * 100),
      currency: "INR",
      customerId: userId,
      customerName: preparedOrder.fullName,
      customerEmail: preparedOrder.email,
      customerPhone: preparedOrder.phoneNumber,
      returnUrl,
      description: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
      expireAfter: env.paymentGateway.orderExpireAfterSeconds,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
        merchantUrls: {
          redirectUrl: returnUrl,
        },
      },
      disablePaymentRetry: false,
      metaInfo: {
        udf1: preparedOrder.orderSource || "direct_order",
        udf2: paymentAttempt.id,
        udf3: userId,
      },
      prefillUserLoginDetails: {
        phoneNumber: preparedOrder.phoneNumber,
      },
    }, { provider });

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
        currency: "INR",
        status: gatewayOrder.state,
        expiresAt: gatewayOrder.expireAt || null,
      },
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      provider,
      merchantOrderId: paymentAttempt.id,
      gatewayOrderId: gatewayOrder.orderId,
      redirectUrl: gatewayOrder.redirectUrl,
      paymentSessionId: gatewayOrder.paymentSessionId || "",
      amount: preparedOrder.pricing.total,
      currency: "INR",
      businessName: "Grass Green Nursery",
      description: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
      prefill: {
        name: preparedOrder.fullName,
        email: preparedOrder.email,
        contact: preparedOrder.phoneNumber,
      },
      mode: env.paymentGateway.mode,
      returnUrl,
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

const getPaymentAttemptStatus = async (userId, paymentAttemptId) => {
  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== userId) {
    throw new ApiError(404, "Payment attempt not found.");
  }

  return serializePaymentAttempt(paymentAttempt);
};

const buildGatewayPaymentDetails = (paymentAttempt, event) => {
  const provider =
    normalizeString(paymentAttempt.gateway?.provider) || env.paymentGateway.provider;
  const { payload, paymentDetail, eventName } = extractGatewayWebhookPayload(
    event,
    provider,
  );

  return {
    provider,
    merchantOrderId:
      normalizeString(payload?.merchantOrderId) ||
      normalizeString(paymentAttempt.gateway?.merchantOrderId) ||
      paymentAttempt.id,
    gatewayOrderId:
      normalizeString(payload?.orderId) ||
      normalizeString(paymentAttempt.gateway?.gatewayOrderId),
    gatewayPaymentId:
      normalizeString(paymentDetail?.transactionId) ||
      normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
    paymentMode: normalizeString(paymentDetail?.paymentMode),
    paymentState: normalizeString(paymentDetail?.state || payload?.state),
    rail: paymentDetail?.rail || {},
    instrument: paymentDetail?.instrument || {},
    errorCode: normalizeString(paymentDetail?.errorCode),
    detailedErrorCode: normalizeString(paymentDetail?.detailedErrorCode),
    event: eventName || normalizeString(payload?.state),
    capturedAt:
      paymentDetail?.timestamp
        ? new Date(Number(paymentDetail.timestamp)).toISOString()
        : new Date().toISOString(),
  };
};

const assertSuccessfulPaymentMatchesAttempt = (paymentAttempt, event) => {
  const provider =
    normalizeString(paymentAttempt.gateway?.provider) || env.paymentGateway.provider;
  const { payload, paymentDetail } = extractGatewayWebhookPayload(event, provider);
  const expectedAmountPaisa = toExpectedAmountPaisa(paymentAttempt.amount);
  const payloadAmount = Number(payload?.amount);
  const paymentAmount = Number(paymentDetail?.amount);
  const actualAmountPaisa = Number.isFinite(paymentAmount)
    ? paymentAmount
    : Number.isFinite(payloadAmount)
      ? payloadAmount
      : null;

  if (actualAmountPaisa !== null && actualAmountPaisa !== expectedAmountPaisa) {
    throw new ApiError(
      409,
      `Payment amount mismatch. Expected ${expectedAmountPaisa} paisa but received ${actualAmountPaisa}.`,
    );
  }
};

const recoverCompletedAttemptFromOrderRecord = async (paymentAttempt) => {
  const paymentReference =
    normalizeString(paymentAttempt.gateway?.merchantOrderId) || paymentAttempt.id;
  const existingOrder = await findOrderByPaymentReference(paymentReference);

  if (!existingOrder) {
    return null;
  }

  return updatePaymentAttempt(paymentAttempt.id, {
    status: "completed",
    orderId: existingOrder.id,
    processedAt: new Date(),
    gateway: {
      ...(paymentAttempt.gateway || {}),
      provider: normalizeString(paymentAttempt.gateway?.provider) || env.paymentGateway.provider,
      merchantOrderId: paymentReference,
    },
  });
};

const finalizeSuccessfulPayment = async (paymentAttempt, event) => {
  if (paymentAttempt.orderId) {
    return {
      processed: true,
      duplicate: true,
      orderId: paymentAttempt.orderId,
    };
  }

  assertSuccessfulPaymentMatchesAttempt(paymentAttempt, event);

  const claimedPaymentAttempt = await claimPaymentAttemptForFinalization(
    paymentAttempt.id,
  );

  if (!claimedPaymentAttempt) {
    const latestPaymentAttempt = await findPaymentAttemptById(paymentAttempt.id);

    if (latestPaymentAttempt?.orderId) {
      return {
        processed: true,
        duplicate: true,
        orderId: latestPaymentAttempt.orderId,
      };
    }

    if (latestPaymentAttempt) {
      const recoveredAttempt =
        await recoverCompletedAttemptFromOrderRecord(latestPaymentAttempt);

      if (recoveredAttempt?.orderId) {
        return {
          processed: true,
          duplicate: true,
          orderId: recoveredAttempt.orderId,
        };
      }
    }

    return {
      processed: false,
      ignored: true,
      reason: "Payment attempt is already being finalized.",
    };
  }

  const provider =
    normalizeString(claimedPaymentAttempt.gateway?.provider) ||
    normalizeString(paymentAttempt.gateway?.provider) ||
    env.paymentGateway.provider;
  const { eventName } = extractGatewayWebhookPayload(event, provider);
  const paymentDetails = buildGatewayPaymentDetails(claimedPaymentAttempt, event);
  const orderItems = Array.isArray(claimedPaymentAttempt.checkoutPayload?.orderItems)
    ? claimedPaymentAttempt.checkoutPayload.orderItems
    : [];
  const appliedCoupon = claimedPaymentAttempt.checkoutPayload?.appliedCoupon || null;
  const couponReservationReference = normalizeString(
    appliedCoupon?.reservationReference,
  );

  if (claimedPaymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
    const reservationResult = await reserveProductStocks(orderItems);

    if (!reservationResult.success) {
      const failedProduct = await findProductById(
        reservationResult.failedItem?.productId,
      );
      const failureReason = buildStockErrorMessage(
        failedProduct,
        reservationResult.failedItem?.quantity || 0,
      );

      await updatePaymentAttempt(claimedPaymentAttempt.id, {
        status: "failed",
        failureReason,
        lastWebhookEvent: `${eventName || "checkout.order.completed"}:stock_unavailable`,
      });
      if (couponReservationReference) {
        await releaseCouponReservation(couponReservationReference);
      }

      return {
        processed: false,
        failed: true,
        reason: failureReason,
      };
    }
  }

  let orderRecord;

  try {
    orderRecord = await createPreparedOrder(claimedPaymentAttempt.checkoutPayload, {
      paymentStatus: "paid",
      paymentDetails,
    });
  } catch (error) {
    if (claimedPaymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
      await releaseProductStocks(orderItems);
    }
    if (couponReservationReference) {
      await releaseCouponReservation(couponReservationReference);
    }

    await updatePaymentAttempt(claimedPaymentAttempt.id, {
      status: "checkout_ready",
      failureReason: error instanceof Error ? error.message : "Order finalization failed.",
    });

    throw error;
  }

  if (appliedCoupon?.code && couponReservationReference) {
    await consumeReservedCouponCode({
      code: appliedCoupon.code,
      reservationReference: couponReservationReference,
      userId: claimedPaymentAttempt.userId,
      orderId: orderRecord.id,
    });
  }

  await updatePaymentAttempt(claimedPaymentAttempt.id, {
    status: "completed",
    orderId: orderRecord.id,
    processedAt: new Date(),
    lastWebhookEvent: eventName || "checkout.order.completed",
    gateway: {
      ...(claimedPaymentAttempt.gateway || {}),
      provider,
      merchantOrderId: paymentDetails.merchantOrderId,
      gatewayOrderId: paymentDetails.gatewayOrderId,
      gatewayPaymentId: paymentDetails.gatewayPaymentId,
      paymentMode: paymentDetails.paymentMode,
      status: paymentDetails.paymentState || "COMPLETED",
      rail: paymentDetails.rail,
      instrument: paymentDetails.instrument,
    },
  });

  if (claimedPaymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
    await consumeUserCartItems(
      claimedPaymentAttempt.userId,
      claimedPaymentAttempt.checkoutPayload?.orderItems || [],
    );
  }

  return {
    processed: true,
    orderId: orderRecord.id,
  };
};

const markFailedPayment = async (paymentAttempt, event) => {
  const provider =
    normalizeString(paymentAttempt.gateway?.provider) || env.paymentGateway.provider;
  const { payload, paymentDetail, eventName } = extractGatewayWebhookPayload(
    event,
    provider,
  );
  const couponReservationReference = normalizeString(
    paymentAttempt.checkoutPayload?.appliedCoupon?.reservationReference,
  );
  const failureReason =
    normalizeString(paymentDetail?.detailedErrorCode) ||
    normalizeString(paymentDetail?.errorCode) ||
    normalizeString(payload?.state) ||
    "Payment failed.";

  await updatePaymentAttempt(paymentAttempt.id, {
    status: "failed",
    lastWebhookEvent: eventName || "checkout.order.failed",
    failureReason,
    gateway: {
      ...(paymentAttempt.gateway || {}),
      provider,
      merchantOrderId:
        normalizeString(payload?.merchantOrderId) ||
        normalizeString(paymentAttempt.gateway?.merchantOrderId) ||
        paymentAttempt.id,
      gatewayOrderId:
        normalizeString(payload?.orderId) ||
        normalizeString(paymentAttempt.gateway?.gatewayOrderId),
      gatewayPaymentId:
        normalizeString(paymentDetail?.transactionId) ||
        normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
      paymentMode: normalizeString(paymentDetail?.paymentMode),
      status: normalizeString(paymentDetail?.state || payload?.state) || "FAILED",
      errorCode: normalizeString(paymentDetail?.errorCode),
      detailedErrorCode: normalizeString(paymentDetail?.detailedErrorCode),
    },
  });

  if (couponReservationReference) {
    await releaseCouponReservation(couponReservationReference);
  }

  return {
    processed: true,
    failed: true,
  };
};

const processPaymentWebhook = async ({
  authorization,
  signature,
  timestamp,
  rawBody,
  event,
}) => {
  const provider = await verifyPaymentGatewayWebhookAuthorization({
    authorization,
    signature,
    timestamp,
    rawBody,
    event,
  });
  await ensurePaymentGatewayWebhookConfigured(provider);

  const paymentAttempt = await locatePaymentAttempt(event, provider);

  if (!paymentAttempt) {
    return {
      processed: false,
      ignored: true,
      reason: "Payment attempt not found.",
    };
  }

  const matchedProvider = assertWebhookProviderMatchesPaymentAttempt(
    paymentAttempt,
    provider,
  );

  const { payload, eventName } = extractGatewayWebhookPayload(
    event,
    matchedProvider,
  );
  const gatewayState = normalizeGatewayState(payload?.state);

  if (
    ["COMPLETED", "SUCCESS", "PAID"].includes(gatewayState) ||
    eventName === "checkout.order.completed" ||
    eventName === "PAYMENT_SUCCESS_WEBHOOK"
  ) {
    return finalizeSuccessfulPayment(paymentAttempt, event);
  }

  if (
    ["FAILED", "FAILURE", "ERROR"].includes(gatewayState) ||
    eventName === "checkout.order.failed" ||
    eventName === "PAYMENT_FAILED_WEBHOOK"
  ) {
    return markFailedPayment(paymentAttempt, event);
  }

  return {
    processed: false,
    ignored: true,
    reason: `Unhandled event ${eventName || gatewayState || "unknown"}.`,
  };
};

const verifyPaymentAttempt = async (userId, paymentAttemptId) => {
  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== userId) {
    throw new ApiError(404, "Payment attempt not found.");
  }

  if (paymentAttempt.status === "completed" && paymentAttempt.orderId) {
    return serializePaymentAttempt(paymentAttempt);
  }

  if (paymentAttempt.status === "processing" && !paymentAttempt.orderId) {
    const recoveredAttempt =
      await recoverCompletedAttemptFromOrderRecord(paymentAttempt);

    if (recoveredAttempt?.orderId) {
      return serializePaymentAttempt(recoveredAttempt);
    }
  }

  return serializePaymentAttempt(paymentAttempt);
};

module.exports = {
  createPaymentCheckout,
  getPaymentAttemptStatus,
  processPaymentWebhook,
  verifyPaymentAttempt,
};
