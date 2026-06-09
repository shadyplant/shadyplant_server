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

const buildOrderFilters = (options = {}, values = []) => {
  const clauses = [];
  const from = options.from ? new Date(options.from) : null;
  const to = options.to ? new Date(options.to) : null;

  if (options.userId) {
    values.push(options.userId);
    clauses.push(`user_id = $${values.length}`);
  }

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
const mapOrderRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    trackingCode: row.tracking_code,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    deliveryAddress: row.delivery_address || {},
    deliveryDate: row.delivery_date instanceof Date
      ? row.delivery_date.toISOString()
      : row.delivery_date,
    quantitySqft: row.quantity_sqft,
    distanceKm: Number(row.distance_km),
    vehicle: row.vehicle || {},
    orderItems: row.order_items || [],
    recommendedItems: row.recommended_items || [],
    billingDetails: row.billing_details || {},
    deliveryLocation: row.delivery_location || {},
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    currentStatus: row.current_status || "placed",
    trackingTimeline: row.tracking_timeline || [],
    paymentDetails: row.payment_details || {},
    cancellationReason: row.cancellation_reason || "",
    cancellationNote: row.cancellation_note || "",
    cancelledAt:
      row.cancelled_at instanceof Date
        ? row.cancelled_at.toISOString()
        : row.cancelled_at || null,
    refundReason: row.refund_reason || "",
    refundedAt:
      row.refunded_at instanceof Date
        ? row.refunded_at.toISOString()
        : row.refunded_at || null,
    pricing: row.pricing || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createOrder = async (orderData) => {
  const id = generateId();
  const year = new Date().getFullYear();
  const uniqueSuffix = generateId().replace(/-/g, "").slice(0, 10).toUpperCase();
  const trackingSuffix = generateId().replace(/-/g, "").slice(0, 12).toUpperCase();

  const order = {
    orderNumber: `GGN-${year}-${uniqueSuffix}`,
    trackingCode: `TRK-${trackingSuffix}`,
    ...orderData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await query(
    `INSERT INTO orders (
      id,
      order_number,
      tracking_code,
      user_id,
      full_name,
      email,
      phone_number,
      delivery_address,
      delivery_date,
      quantity_sqft,
      distance_km,
      vehicle,
      order_items,
      recommended_items,
      billing_details,
      delivery_location,
      payment_method,
      payment_status,
      current_status,
      tracking_timeline,
      payment_details,
      cancellation_reason,
      cancellation_note,
      cancelled_at,
      refund_reason,
      refunded_at,
      pricing,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13::jsonb,
      $14::jsonb, $15::jsonb, $16::jsonb, $17, $18, $19, $20::jsonb, $21::jsonb, $22, $23, $24, $25, $26, $27::jsonb, $28, $29
    )`,
    [
      id,
      order.orderNumber,
      order.trackingCode,
      order.userId,
      order.fullName,
      order.email,
      order.phoneNumber,
      JSON.stringify(order.deliveryAddress),
      order.deliveryDate,
      order.quantitySqft,
      order.distanceKm,
      JSON.stringify(order.vehicle),
      JSON.stringify(order.orderItems || []),
      JSON.stringify(order.recommendedItems || []),
      JSON.stringify(order.billingDetails || {}),
      JSON.stringify(order.deliveryLocation || {}),
      order.paymentMethod,
      order.paymentStatus,
      order.currentStatus || "placed",
      JSON.stringify(order.trackingTimeline || []),
      JSON.stringify(order.paymentDetails || {}),
      order.cancellationReason || "",
      order.cancellationNote || "",
      order.cancelledAt || null,
      order.refundReason || "",
      order.refundedAt || null,
      JSON.stringify(order.pricing || {}),
      order.createdAt,
      order.updatedAt,
    ],
  );

  return {
    id,
    ...order,
  };
};

const listOrdersByUserId = async (userId, options = {}) => {
  const values = [];
  const clauses = buildOrderFilters({ ...options, userId }, values);
  const limit = parsePositiveInteger(options.limit);
  const offset = parsePositiveInteger(options.offset);
  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query(
    `SELECT COUNT(*)::int AS total_count FROM orders ${whereClause}`,
    values,
  );
  const totalCount = Number(countResult.rows[0]?.total_count || 0);
  const dataValues = [...values];
  let sql = `SELECT *
             FROM orders
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
    rows: result.rows.map(mapOrderRow).filter(Boolean),
    totalCount,
  };
};

const findOrderById = async (orderId) => {
  const result = await query("SELECT * FROM orders WHERE id = $1 LIMIT 1", [
    orderId,
  ]);
  return mapOrderRow(result.rows[0]);
};

const findOrderByPaymentReference = async (paymentReference) => {
  const result = await query(
    `SELECT * FROM orders
      WHERE payment_details->>'merchantOrderId' = $1
         OR payment_details->>'gatewayOrderId' = $1
         OR payment_details->>'cashfreeOrderId' = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [paymentReference],
  );

  return mapOrderRow(result.rows[0]);
};

const listAllOrders = async (options = {}) => {
  const values = [];
  const clauses = buildOrderFilters(options, values);
  const limit = parsePositiveInteger(options.limit);
  const offset = parsePositiveInteger(options.offset);
  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query(
    `SELECT COUNT(*)::int AS total_count FROM orders ${whereClause}`,
    values,
  );
  const totalCount = Number(countResult.rows[0]?.total_count || 0);
  const dataValues = [...values];
  let sql = `SELECT *
             FROM orders
             ${whereClause}`;

  sql += " ORDER BY created_at DESC";

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
    rows: result.rows.map(mapOrderRow).filter(Boolean),
    totalCount,
  };
};

const updateOrder = async (orderId, updates) => {
  const statement = buildUpdateStatement(
    {
      fullName: updates.fullName,
      email: updates.email,
      phoneNumber: updates.phoneNumber,
      deliveryAddress:
        updates.deliveryAddress !== undefined
          ? JSON.stringify(updates.deliveryAddress || {})
          : undefined,
      deliveryDate: updates.deliveryDate,
      quantitySqft: updates.quantitySqft,
      distanceKm: updates.distanceKm,
      vehicle:
        updates.vehicle !== undefined
          ? JSON.stringify(updates.vehicle || {})
          : undefined,
      orderItems:
        updates.orderItems !== undefined
          ? JSON.stringify(updates.orderItems || [])
          : undefined,
      recommendedItems:
        updates.recommendedItems !== undefined
          ? JSON.stringify(updates.recommendedItems || [])
          : undefined,
      billingDetails:
        updates.billingDetails !== undefined
          ? JSON.stringify(updates.billingDetails || {})
          : undefined,
      deliveryLocation:
        updates.deliveryLocation !== undefined
          ? JSON.stringify(updates.deliveryLocation || {})
          : undefined,
      paymentMethod: updates.paymentMethod,
      paymentStatus: updates.paymentStatus,
      currentStatus: updates.currentStatus,
      cancellationReason: updates.cancellationReason,
      cancellationNote: updates.cancellationNote,
      cancelledAt: updates.cancelledAt,
      refundReason: updates.refundReason,
      refundedAt: updates.refundedAt,
      trackingTimeline:
        updates.trackingTimeline !== undefined
          ? JSON.stringify(updates.trackingTimeline || [])
          : undefined,
      paymentDetails:
        updates.paymentDetails !== undefined
          ? JSON.stringify(updates.paymentDetails || {})
          : undefined,
      pricing:
        updates.pricing !== undefined
          ? JSON.stringify(updates.pricing || {})
          : undefined,
      updatedAt: new Date(),
    },
    {
      fullName: "full_name",
      phoneNumber: "phone_number",
      deliveryAddress: { column: "delivery_address", cast: "jsonb" },
      deliveryDate: "delivery_date",
      quantitySqft: "quantity_sqft",
      distanceKm: "distance_km",
      vehicle: { column: "vehicle", cast: "jsonb" },
      orderItems: { column: "order_items", cast: "jsonb" },
      recommendedItems: { column: "recommended_items", cast: "jsonb" },
      billingDetails: { column: "billing_details", cast: "jsonb" },
      deliveryLocation: { column: "delivery_location", cast: "jsonb" },
      paymentMethod: "payment_method",
      paymentStatus: "payment_status",
      currentStatus: "current_status",
      cancellationReason: "cancellation_reason",
      cancellationNote: "cancellation_note",
      cancelledAt: "cancelled_at",
      refundReason: "refund_reason",
      refundedAt: "refunded_at",
      trackingTimeline: { column: "tracking_timeline", cast: "jsonb" },
      paymentDetails: { column: "payment_details", cast: "jsonb" },
      pricing: { column: "pricing", cast: "jsonb" },
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findOrderById(orderId);
  }

  await query(
    `UPDATE orders SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, orderId],
  );

  return findOrderById(orderId);
};

module.exports = {
  createOrder,
  findOrderById,
  findOrderByPaymentReference,
  listAllOrders,
  listOrdersByUserId,
  updateOrder,
};
