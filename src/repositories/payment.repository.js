const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const parsePositiveInteger = (value) => {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
};

const buildPaymentAttemptFilters = (options = {}, values = []) => {
  const clauses = [];
  const from = options.from ? new Date(options.from) : null;
  const to = options.to ? new Date(options.to) : null;

  if (from && !Number.isNaN(from.getTime())) {
    values.push(from);
    clauses.push(`created_at >= $${values.length}`);
  }

  if (to && !Number.isNaN(to.getTime())) {
    values.push(to);
    clauses.push(`created_at <= $${values.length}`);
  }

  return clauses;
};

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
    gateway: row.razorpay || {},
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
      JSON.stringify(paymentAttempt.gateway || {}),
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

const claimPaymentAttemptForFinalization = async (paymentAttemptId) => {
  const result = await query(
    `UPDATE payment_attempts
      SET status = 'processing', updated_at = NOW()
      WHERE id = $1
        AND order_id IS NULL
        AND status IN ('created', 'checkout_ready')
      RETURNING *`,
    [paymentAttemptId],
  );

  return mapPaymentAttemptRow(result.rows[0]);
};

const findPaymentAttemptByGatewayOrderId = async (gatewayOrderId) => {
  const result = await query(
    `SELECT * FROM payment_attempts
      WHERE razorpay->>'gatewayOrderId' = $1
         OR razorpay->>'orderId' = $1
      LIMIT 1`,
    [gatewayOrderId],
  );
  return mapPaymentAttemptRow(result.rows[0]);
};

const listAllPaymentAttempts = async (options = {}) => {
  const values = [];
  const clauses = buildPaymentAttemptFilters(options, values);
  const limit = parsePositiveInteger(options.limit);
  const offset = parsePositiveInteger(options.offset);
  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query(
    `SELECT COUNT(*)::int AS total_count FROM payment_attempts ${whereClause}`,
    values,
  );
  const totalCount = Number(countResult.rows[0]?.total_count || 0);
  const dataValues = [...values];
  let sql = `SELECT *
             FROM payment_attempts
             ${whereClause}
             ORDER BY created_at DESC`;

  if (limit !== null) {
    dataValues.push(limit);
    sql += ` LIMIT $${dataValues.length}`;
  }

  if (offset !== null) {
    dataValues.push(offset);
    sql += ` OFFSET $${dataValues.length}`;
  }

  const result = await query(sql, dataValues);

  return {
    rows: result.rows.map(mapPaymentAttemptRow).filter(Boolean),
    totalCount,
  };
};

const updatePaymentAttempt = async (paymentAttemptId, updates) => {
  const statement = buildUpdateStatement(
    {
      ...updates,
      checkoutPayload:
        updates.checkoutPayload !== undefined
          ? JSON.stringify(updates.checkoutPayload || {})
          : undefined,
      gateway:
        updates.gateway !== undefined
          ? JSON.stringify(updates.gateway || {})
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
      gateway: { column: "razorpay", cast: "jsonb" },
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
  claimPaymentAttemptForFinalization,
  createPaymentAttempt,
  findPaymentAttemptById,
  findPaymentAttemptByGatewayOrderId,
  listAllPaymentAttempts,
  updatePaymentAttempt,
};
