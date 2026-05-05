const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapPaymentAttemptRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.payment_method,
    checkoutPayload: row.checkout_payload || {},
    orderId: row.order_id,
    failureReason: row.failure_reason,
    processedAt: row.processed_at,
    lastWebhookEvent: row.last_webhook_event,
    razorpay: row.razorpay || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createPaymentAttempt = async (paymentAttemptData) => {
  const id = generateId();
  const paymentAttempt = {
    ...paymentAttemptData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await query(
    `INSERT INTO payment_attempts (
      id,
      user_id,
      status,
      amount,
      currency,
      payment_method,
      checkout_payload,
      order_id,
      failure_reason,
      processed_at,
      last_webhook_event,
      razorpay,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, $14
    )`,
    [
      id,
      paymentAttempt.userId,
      paymentAttempt.status,
      paymentAttempt.amount,
      paymentAttempt.currency,
      paymentAttempt.paymentMethod,
      JSON.stringify(paymentAttempt.checkoutPayload || {}),
      paymentAttempt.orderId,
      paymentAttempt.failureReason || null,
      paymentAttempt.processedAt || null,
      paymentAttempt.lastWebhookEvent || null,
      JSON.stringify(paymentAttempt.razorpay || {}),
      paymentAttempt.createdAt,
      paymentAttempt.updatedAt,
    ],
  );

  return {
    id,
    ...paymentAttempt,
  };
};

const findPaymentAttemptById = async (paymentAttemptId) => {
  const result = await query(
    "SELECT * FROM payment_attempts WHERE id = $1 LIMIT 1",
    [paymentAttemptId],
  );
  return mapPaymentAttemptRow(result.rows[0]);
};

const findPaymentAttemptByRazorpayOrderId = async (razorpayOrderId) => {
  const result = await query(
    "SELECT * FROM payment_attempts WHERE razorpay->>'orderId' = $1 LIMIT 1",
    [razorpayOrderId],
  );
  return mapPaymentAttemptRow(result.rows[0]);
};

const listAllPaymentAttempts = async () => {
  const result = await query(
    "SELECT * FROM payment_attempts ORDER BY created_at DESC",
    [],
  );

  return result.rows.map(mapPaymentAttemptRow).filter(Boolean);
};

const updatePaymentAttempt = async (paymentAttemptId, updates) => {
  const statement = buildUpdateStatement(
    {
      ...updates,
      checkoutPayload:
        updates.checkoutPayload !== undefined
          ? JSON.stringify(updates.checkoutPayload || {})
          : undefined,
      razorpay:
        updates.razorpay !== undefined
          ? JSON.stringify(updates.razorpay || {})
          : undefined,
      updatedAt: new Date(),
    },
    {
      userId: "user_id",
      paymentMethod: "payment_method",
      checkoutPayload: { column: "checkout_payload", cast: "jsonb" },
      orderId: "order_id",
      failureReason: "failure_reason",
      processedAt: "processed_at",
      lastWebhookEvent: "last_webhook_event",
      razorpay: { column: "razorpay", cast: "jsonb" },
      updatedAt: "updated_at",
    },
  );

  await query(
    `UPDATE payment_attempts SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, paymentAttemptId],
  );

  return findPaymentAttemptById(paymentAttemptId);
};

module.exports = {
  createPaymentAttempt,
  findPaymentAttemptById,
  findPaymentAttemptByRazorpayOrderId,
  listAllPaymentAttempts,
  updatePaymentAttempt,
};
