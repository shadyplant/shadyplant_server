const { env } = require("../config/env");
const {
  createPaymentAttempt,
  findPaymentAttemptById,
  findPaymentAttemptByRazorpayOrderId,
  updatePaymentAttempt,
} = require("../repositories/payment.repository");
const {
  findProductById,
  releaseProductStocks,
  reserveProductStocks,
} = require("../repositories/product.repository");
const { ApiError } = require("../utils/apiError");
const { consumeUserCartItems } = require("./cart.service");
const { createPreparedOrder, prepareOrderForUser } = require("./order.service");
const {
  createRemoteRazorpayOrder,
  ensureRazorpayCheckoutConfigured,
  ensureRazorpayWebhookConfigured,
  verifyWebhookSignature,
} = require("./razorpay.service");
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

const createRazorpayCheckout = async (userId, payload) => {
  ensureRazorpayCheckoutConfigured();

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
    razorpay: {},
  });

  try {
    const razorpayOrder = await createRemoteRazorpayOrder({
      amount: preparedOrder.pricing.total * 100,
      currency: "INR",
      receipt: `GGN-${paymentAttempt.id.slice(0, 14)}`,
      notes: {
        paymentAttemptId: paymentAttempt.id,
        userId,
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
      keyId: env.razorpay.keyId,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      businessName: "Grass Green Nursery",
      description: `Checkout for ${preparedOrder.quantitySqft} sqft premium grass`,
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

const getPaymentAttemptStatus = async (userId, paymentAttemptId) => {
  const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);

  if (!paymentAttempt || paymentAttempt.userId !== userId) {
    throw new ApiError(404, "Payment attempt not found.");
  }

  return serializePaymentAttempt(paymentAttempt);
};

const buildSimulatedSuccessEvent = (paymentAttempt) => {
  const fallbackOrderId = `order_test_${paymentAttempt.id.slice(0, 14)}`;
  const razorpayOrderId = paymentAttempt.razorpay?.orderId || fallbackOrderId;

  return {
    event: "test.payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_test_${paymentAttempt.id.slice(0, 14)}`,
          order_id: razorpayOrderId,
          status: "captured",
          notes: {
            paymentAttemptId: paymentAttempt.id,
            userId: paymentAttempt.userId,
          },
        },
      },
      order: {
        entity: {
          id: razorpayOrderId,
          status: "paid",
          notes: {
            paymentAttemptId: paymentAttempt.id,
            userId: paymentAttempt.userId,
          },
        },
      },
    },
  };
};

const locatePaymentAttempt = async (eventPayload) => {
  const paymentEntity = eventPayload?.payment?.entity || null;
  const orderEntity = eventPayload?.order?.entity || null;
  const paymentAttemptId =
    paymentEntity?.notes?.paymentAttemptId || orderEntity?.notes?.paymentAttemptId || "";
  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id || "";

  if (paymentAttemptId) {
    const paymentAttempt = await findPaymentAttemptById(paymentAttemptId);
    if (paymentAttempt) {
      return paymentAttempt;
    }
  }

  if (razorpayOrderId) {
    return findPaymentAttemptByRazorpayOrderId(razorpayOrderId);
  }

  return null;
};

const finalizeSuccessfulPayment = async (paymentAttempt, event) => {
  if (paymentAttempt.orderId) {
    return {
      processed: true,
      duplicate: true,
      orderId: paymentAttempt.orderId,
    };
  }

  const paymentEntity = event.payload?.payment?.entity || null;
  const orderEntity = event.payload?.order?.entity || null;
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
        lastWebhookEvent: `${event.event}:stock_unavailable`,
      });

      return {
        processed: false,
        failed: true,
        reason: failureReason,
      };
    }
  }

  let order;

  try {
    order = await createPreparedOrder(paymentAttempt.checkoutPayload, {
      paymentStatus: "paid",
      paymentDetails: {
        provider: "razorpay",
        razorpayOrderId: paymentEntity?.order_id || orderEntity?.id || "",
        razorpayPaymentId: paymentEntity?.id || "",
        event: event.event,
        capturedAt: new Date().toISOString(),
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
    orderId: order.id,
    processedAt: new Date(),
    lastWebhookEvent: event.event,
    razorpay: {
      ...(paymentAttempt.razorpay || {}),
      orderId:
        paymentEntity?.order_id ||
        orderEntity?.id ||
        paymentAttempt.razorpay?.orderId ||
        "",
      paymentId: paymentEntity?.id || paymentAttempt.razorpay?.paymentId || "",
      status: paymentEntity?.status || orderEntity?.status || "paid",
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
    orderId: order.id,
  };
};

const markFailedPayment = async (paymentAttempt, event) => {
  const paymentEntity = event.payload?.payment?.entity || null;
  const failureReason =
    paymentEntity?.error_description ||
    paymentEntity?.error_reason ||
    "Payment failed.";

  await updatePaymentAttempt(paymentAttempt.id, {
    status: "failed",
    lastWebhookEvent: event.event,
    failureReason,
    razorpay: {
      ...(paymentAttempt.razorpay || {}),
      orderId:
        paymentEntity?.order_id || paymentAttempt.razorpay?.orderId || "",
      paymentId: paymentEntity?.id || paymentAttempt.razorpay?.paymentId || "",
      status: paymentEntity?.status || "failed",
    },
  });

  return {
    processed: true,
    failed: true,
  };
};

const processRazorpayWebhook = async ({ signature, rawBody, event }) => {
  ensureRazorpayWebhookConfigured();
  verifyWebhookSignature(signature, rawBody);

  const paymentAttempt = await locatePaymentAttempt(event.payload);

  if (!paymentAttempt) {
    return {
      processed: false,
      ignored: true,
      reason: "Payment attempt not found.",
    };
  }

  if (event.event === "payment.failed") {
    return markFailedPayment(paymentAttempt, event);
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    return finalizeSuccessfulPayment(paymentAttempt, event);
  }

  return {
    processed: false,
    ignored: true,
    reason: `Unhandled event ${event.event}.`,
  };
};

const simulateSuccessfulWebhook = async (userId, paymentAttemptId) => {
  ensureRazorpayCheckoutConfigured();

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
  createRazorpayCheckout,
  getPaymentAttemptStatus,
  processRazorpayWebhook,
  simulateSuccessfulWebhook,
};
