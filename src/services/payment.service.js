const { env } = require("../config/env");
const {
  createPaymentAttempt,
  findPaymentAttemptByGatewayOrderId,
  findPaymentAttemptById,
  updatePaymentAttempt,
} = require("../repositories/payment.repository");
const {
  findProductById,
  releaseProductStocks,
  reserveProductStocks,
} = require("../repositories/product.repository");
const { ApiError } = require("../utils/apiError");
const { consumeUserCartItems } = require("./cart.service");
const {
  buildCashfreeReturnUrl,
  createRemoteCashfreeOrder,
  ensureCashfreeCheckoutConfigured,
  ensureCashfreeWebhookConfigured,
  getRemoteCashfreeOrder,
  listRemoteCashfreePayments,
  verifyCashfreeWebhookSignature,
} = require("./cashfree.service");
const { createPreparedOrder, prepareOrderForUser } = require("./order.service");

const CHECKOUT_STATUS_LABELS = {
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

const wait = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const normalizeString = (value) => String(value || "").trim();

const normalizeCashfreeStatus = (value) => normalizeString(value).toUpperCase();

const serializePaymentAttempt = (paymentAttempt) => ({
  id: paymentAttempt.id,
  status: paymentAttempt.status,
  statusLabel:
    CHECKOUT_STATUS_LABELS[paymentAttempt.status] || "Payment update pending",
  orderId: paymentAttempt.orderId || null,
  amount: paymentAttempt.amount,
  currency: paymentAttempt.currency,
  paymentMethod: paymentAttempt.paymentMethod,
  createdAt: paymentAttempt.createdAt,
  updatedAt: paymentAttempt.updatedAt,
});

const extractCashfreePayload = (event = {}) => {
  const data = event?.data || {};

  return {
    type: normalizeString(event?.type),
    eventTime: normalizeString(event?.event_time),
    order: data.order || {},
    payment: data.payment || {},
    errorDetails: data.error_details || {},
    gatewayDetails: data.payment_gateway_details || {},
    customerDetails: data.customer_details || {},
  };
};

const buildSimulatedSuccessEvent = (paymentAttempt) => {
  const orderId = normalizeString(paymentAttempt.gateway?.orderId) || paymentAttempt.id;
  const customerName =
    normalizeString(paymentAttempt.checkoutPayload?.fullName) || "Customer";
  const customerEmail = normalizeString(paymentAttempt.checkoutPayload?.email);
  const customerPhone = normalizeString(paymentAttempt.checkoutPayload?.phoneNumber);

  return {
    type: "PAYMENT_SUCCESS_WEBHOOK",
    event_time: new Date().toISOString(),
    data: {
      order: {
        order_id: orderId,
        order_amount: Number(paymentAttempt.amount || 0),
        order_currency: paymentAttempt.currency || "INR",
        order_tags: {
          payment_attempt_id: paymentAttempt.id,
          source: paymentAttempt.checkoutPayload?.orderSource || "direct_order",
        },
      },
      payment: {
        cf_payment_id: `cf_test_${paymentAttempt.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20)}`,
        payment_status: "SUCCESS",
        payment_amount: Number(paymentAttempt.amount || 0),
        payment_currency: paymentAttempt.currency || "INR",
        payment_message: "Simulated payment success",
        payment_time: new Date().toISOString(),
        bank_reference: `TEST${Date.now()}`,
        auth_id: null,
        payment_method: {
          upi: {
            channel: "collect",
            upi_id: "test@cashfree",
          },
        },
        payment_group: "upi",
      },
      customer_details: {
        customer_name: customerName,
        customer_id: paymentAttempt.userId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      payment_gateway_details: {
        gateway_name: "CASHFREE",
        gateway_order_id:
          normalizeString(paymentAttempt.gateway?.gatewayOrderId) ||
          `gw_order_${paymentAttempt.id.slice(0, 12)}`,
        gateway_payment_id:
          normalizeString(paymentAttempt.gateway?.gatewayPaymentId) ||
          `gw_pay_${paymentAttempt.id.slice(0, 12)}`,
        gateway_order_reference_id: orderId,
        gateway_settlement: "CASHFREE",
        gateway_status_code: null,
      },
    },
  };
};

const buildVerificationSuccessEvent = (remoteOrder, remotePayment, paymentAttempt) => ({
  type: "PAYMENT_SUCCESS_WEBHOOK",
  event_time: remotePayment?.payment_time || new Date().toISOString(),
  data: {
    order: {
      order_id: remoteOrder.order_id,
      order_amount: remoteOrder.order_amount,
      order_currency: remoteOrder.order_currency,
      order_tags: remoteOrder.order_tags || null,
      cf_order_id: remoteOrder.cf_order_id,
    },
    payment: {
      cf_payment_id: remotePayment.cf_payment_id,
      payment_status: remotePayment.payment_status,
      payment_amount: remotePayment.payment_amount || remoteOrder.order_amount,
      payment_currency: remotePayment.payment_currency || remoteOrder.order_currency,
      payment_message: remotePayment.payment_message || "Payment success",
      payment_time: remotePayment.payment_time || new Date().toISOString(),
      bank_reference: remotePayment.bank_reference || "",
      auth_id: remotePayment.auth_id || null,
      payment_method: remotePayment.payment_method || {},
      payment_group: remotePayment.payment_group || "",
    },
    customer_details: remoteOrder.customer_details || {
      customer_name: paymentAttempt.checkoutPayload?.fullName || "",
      customer_id: paymentAttempt.userId,
      customer_email: paymentAttempt.checkoutPayload?.email || "",
      customer_phone: paymentAttempt.checkoutPayload?.phoneNumber || "",
    },
    payment_gateway_details: {
      gateway_name: "CASHFREE",
      gateway_order_id:
        remotePayment?.gateway_order_id ||
        remotePayment?.gateway_details?.gateway_order_id ||
        normalizeString(paymentAttempt.gateway?.gatewayOrderId),
      gateway_payment_id:
        remotePayment?.gateway_payment_id ||
        remotePayment?.gateway_details?.gateway_payment_id ||
        normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
      gateway_order_reference_id: remoteOrder.order_id,
      gateway_settlement: "CASHFREE",
      gateway_status_code: null,
    },
  },
});

const locatePaymentAttempt = async (eventPayload) => {
  const { order } = extractCashfreePayload(eventPayload);
  const orderId = normalizeString(order?.order_id);

  if (!orderId) {
    return null;
  }

  return findPaymentAttemptByGatewayOrderId(orderId);
};

const createCashfreeCheckout = async (userId, payload) => {
  ensureCashfreeCheckoutConfigured();

  const preparedOrder = await prepareOrderForUser(userId, payload);

  if (preparedOrder.paymentMethod !== "online_payment") {
    throw new ApiError(
      400,
      "Use the cash on delivery checkout for COD orders.",
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
      provider: "cashfree",
    },
  });

  try {
    const returnUrl = buildCashfreeReturnUrl(
      payload?.returnPath,
      paymentAttempt.id,
      "/checkout",
    );
    const cashfreeOrder = await createRemoteCashfreeOrder({
      order_id: paymentAttempt.id,
      order_amount: Number(preparedOrder.pricing.total.toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: userId,
        customer_name: preparedOrder.fullName,
        customer_email: preparedOrder.email || undefined,
        customer_phone: preparedOrder.phoneNumber,
      },
      order_meta: {
        return_url: returnUrl,
        ...(env.cashfree.notifyUrl ? { notify_url: env.cashfree.notifyUrl } : {}),
      },
      order_note: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
      order_tags: {
        payment_attempt_id: paymentAttempt.id,
        source: preparedOrder.orderSource || "direct_order",
        user_id: userId,
      },
    });

    await updatePaymentAttempt(paymentAttempt.id, {
      status: "checkout_ready",
      gateway: {
        provider: "cashfree",
        orderId: cashfreeOrder.order_id,
        cfOrderId: cashfreeOrder.cf_order_id,
        amount: cashfreeOrder.order_amount,
        currency: cashfreeOrder.order_currency,
        paymentSessionId: cashfreeOrder.payment_session_id,
        status: cashfreeOrder.order_status,
      },
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      paymentSessionId: cashfreeOrder.payment_session_id,
      orderId: cashfreeOrder.order_id,
      cfOrderId: cashfreeOrder.cf_order_id,
      amount: cashfreeOrder.order_amount,
      currency: cashfreeOrder.order_currency,
      businessName: "Grass Green Nursery",
      description: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
      prefill: {
        name: preparedOrder.fullName,
        email: preparedOrder.email,
        contact: preparedOrder.phoneNumber,
      },
      mode: env.cashfree.environment,
      returnUrl,
      shouldSimulateWebhook: !env.cashfree.isWebhookConfigured,
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

const finalizeSuccessfulPayment = async (paymentAttempt, event) => {
  if (paymentAttempt.orderId) {
    return {
      processed: true,
      duplicate: true,
      orderId: paymentAttempt.orderId,
    };
  }

  const { order, payment, gatewayDetails, type } = extractCashfreePayload(event);
  const orderItems = Array.isArray(paymentAttempt.checkoutPayload?.orderItems)
    ? paymentAttempt.checkoutPayload.orderItems
    : [];

  if (paymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
    const reservationResult = await reserveProductStocks(orderItems);

    if (!reservationResult.success) {
      const failedProduct = await findProductById(
        reservationResult.failedItem?.productId,
      );
      const failureReason = buildStockErrorMessage(
        failedProduct,
        reservationResult.failedItem?.quantity || 0,
      );

      await updatePaymentAttempt(paymentAttempt.id, {
        status: "failed",
        failureReason,
        lastWebhookEvent: `${type || "PAYMENT_SUCCESS_WEBHOOK"}:stock_unavailable`,
      });

      return {
        processed: false,
        failed: true,
        reason: failureReason,
      };
    }
  }

  let orderRecord;

  try {
    orderRecord = await createPreparedOrder(paymentAttempt.checkoutPayload, {
      paymentStatus: "paid",
      paymentDetails: {
        provider: "cashfree",
        cashfreeOrderId: normalizeString(order?.order_id) || normalizeString(paymentAttempt.gateway?.orderId),
        cashfreeCfOrderId:
          normalizeString(order?.cf_order_id) || normalizeString(paymentAttempt.gateway?.cfOrderId),
        cashfreePaymentId:
          normalizeString(payment?.cf_payment_id) || normalizeString(paymentAttempt.gateway?.paymentId),
        cashfreeGatewayOrderId:
          normalizeString(gatewayDetails?.gateway_order_id) ||
          normalizeString(paymentAttempt.gateway?.gatewayOrderId),
        cashfreeGatewayPaymentId:
          normalizeString(gatewayDetails?.gateway_payment_id) ||
          normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
        paymentGroup: normalizeString(payment?.payment_group),
        paymentMessage: normalizeString(payment?.payment_message),
        event: type || "PAYMENT_SUCCESS_WEBHOOK",
        capturedAt:
          normalizeString(payment?.payment_time) || new Date().toISOString(),
      },
    });
  } catch (error) {
    if (paymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
      await releaseProductStocks(orderItems);
    }

    throw error;
  }

  await updatePaymentAttempt(paymentAttempt.id, {
    status: "completed",
    orderId: orderRecord.id,
    processedAt: new Date(),
    lastWebhookEvent: type || "PAYMENT_SUCCESS_WEBHOOK",
    gateway: {
      ...(paymentAttempt.gateway || {}),
      provider: "cashfree",
      orderId:
        normalizeString(order?.order_id) || normalizeString(paymentAttempt.gateway?.orderId),
      cfOrderId:
        normalizeString(order?.cf_order_id) || normalizeString(paymentAttempt.gateway?.cfOrderId),
      paymentId:
        normalizeString(payment?.cf_payment_id) ||
        normalizeString(paymentAttempt.gateway?.paymentId),
      gatewayOrderId:
        normalizeString(gatewayDetails?.gateway_order_id) ||
        normalizeString(paymentAttempt.gateway?.gatewayOrderId),
      gatewayPaymentId:
        normalizeString(gatewayDetails?.gateway_payment_id) ||
        normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
      status: normalizeString(payment?.payment_status) || "SUCCESS",
    },
  });

  if (paymentAttempt.checkoutPayload?.orderSource === "cart_checkout") {
    await consumeUserCartItems(
      paymentAttempt.userId,
      paymentAttempt.checkoutPayload?.orderItems || [],
    );
  }

  return {
    processed: true,
    orderId: orderRecord.id,
  };
};

const markFailedPayment = async (paymentAttempt, event) => {
  const { payment, errorDetails, gatewayDetails, type } = extractCashfreePayload(event);
  const failureReason =
    normalizeString(errorDetails?.error_description) ||
    normalizeString(errorDetails?.error_reason) ||
    normalizeString(payment?.payment_message) ||
    "Payment failed.";

  await updatePaymentAttempt(paymentAttempt.id, {
    status: "failed",
    lastWebhookEvent: type || "PAYMENT_FAILED_WEBHOOK",
    failureReason,
    gateway: {
      ...(paymentAttempt.gateway || {}),
      provider: "cashfree",
      orderId: normalizeString(paymentAttempt.gateway?.orderId) || paymentAttempt.id,
      paymentId:
        normalizeString(payment?.cf_payment_id) ||
        normalizeString(paymentAttempt.gateway?.paymentId),
      gatewayOrderId:
        normalizeString(gatewayDetails?.gateway_order_id) ||
        normalizeString(paymentAttempt.gateway?.gatewayOrderId),
      gatewayPaymentId:
        normalizeString(gatewayDetails?.gateway_payment_id) ||
        normalizeString(paymentAttempt.gateway?.gatewayPaymentId),
      status: normalizeString(payment?.payment_status) || "FAILED",
    },
  });

  return {
    processed: true,
    failed: true,
  };
};

const processCashfreeWebhook = async ({ signature, timestamp, rawBody, event }) => {
  ensureCashfreeWebhookConfigured();
  verifyCashfreeWebhookSignature(signature, timestamp, rawBody);

  const paymentAttempt = await locatePaymentAttempt(event);

  if (!paymentAttempt) {
    return {
      processed: false,
      ignored: true,
      reason: "Payment attempt not found.",
    };
  }

  const { payment, type } = extractCashfreePayload(event);
  const paymentStatus = normalizeCashfreeStatus(payment?.payment_status);

  if (paymentStatus === "SUCCESS" || type === "PAYMENT_SUCCESS_WEBHOOK") {
    return finalizeSuccessfulPayment(paymentAttempt, event);
  }

  if (paymentStatus === "FAILED" || type === "PAYMENT_FAILED_WEBHOOK") {
    return markFailedPayment(paymentAttempt, event);
  }

  return {
    processed: false,
    ignored: true,
    reason: `Unhandled event ${type || paymentStatus || "unknown"}.`,
  };
};

const verifyCashfreePaymentAttempt = async (userId, paymentAttemptId) => {
  ensureCashfreeCheckoutConfigured();

  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== userId) {
    throw new ApiError(404, "Payment attempt not found.");
  }

  if (paymentAttempt.status === "completed" && paymentAttempt.orderId) {
    return serializePaymentAttempt(paymentAttempt);
  }

  const orderId = normalizeString(paymentAttempt.gateway?.orderId);

  if (!orderId) {
    return serializePaymentAttempt(paymentAttempt);
  }

  const remoteOrder = await getRemoteCashfreeOrder(orderId);
  const remoteOrderStatus = normalizeCashfreeStatus(remoteOrder?.order_status);
  const remotePayments = await listRemoteCashfreePayments(orderId).catch(() => []);
  const successfulPayment = Array.isArray(remotePayments)
    ? remotePayments.find(
        (entry) => normalizeCashfreeStatus(entry?.payment_status) === "SUCCESS",
      )
    : null;

  if (remoteOrderStatus === "PAID" && successfulPayment) {
    const latestAttempt =
      (await findPaymentAttemptById(paymentAttemptId)) || paymentAttempt;

    if (!latestAttempt.orderId) {
      await finalizeSuccessfulPayment(
        latestAttempt,
        buildVerificationSuccessEvent(remoteOrder, successfulPayment, latestAttempt),
      );
    }
  } else if (["EXPIRED", "TERMINATED"].includes(remoteOrderStatus)) {
    await updatePaymentAttempt(paymentAttempt.id, {
      status: "failed",
      failureReason: `Cashfree order ${remoteOrderStatus.toLowerCase()}.`,
      lastWebhookEvent: `ORDER_${remoteOrderStatus}`,
      gateway: {
        ...(paymentAttempt.gateway || {}),
        provider: "cashfree",
        orderId,
        cfOrderId:
          normalizeString(remoteOrder?.cf_order_id) ||
          normalizeString(paymentAttempt.gateway?.cfOrderId),
        status: remoteOrderStatus,
      },
    });
  }

  const latestPaymentAttempt =
    (await findPaymentAttemptById(paymentAttemptId)) || paymentAttempt;

  return serializePaymentAttempt(latestPaymentAttempt);
};

const simulateSuccessfulWebhook = async (userId, paymentAttemptId) => {
  ensureCashfreeCheckoutConfigured();

  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== userId) {
    throw new ApiError(404, "Payment attempt not found.");
  }

  await wait(500);

  const latestPaymentAttempt =
    (await findPaymentAttemptById(paymentAttemptId)) || paymentAttempt;

  if (!latestPaymentAttempt.orderId) {
    await finalizeSuccessfulPayment(
      latestPaymentAttempt,
      buildSimulatedSuccessEvent(latestPaymentAttempt),
    );
  }

  const confirmedPaymentAttempt =
    (await findPaymentAttemptById(paymentAttemptId)) || latestPaymentAttempt;

  return serializePaymentAttempt(confirmedPaymentAttempt);
};

module.exports = {
  createCashfreeCheckout,
  getPaymentAttemptStatus,
  processCashfreeWebhook,
  simulateSuccessfulWebhook,
  verifyCashfreePaymentAttempt,
};
