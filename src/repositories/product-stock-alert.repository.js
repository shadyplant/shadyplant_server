const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");

const PRODUCT_STOCK_ALERT_STATUSES = {
  requested: "requested",
  notified: "notified",
  dismissed: "dismissed",
};

const toIsoString = (value) =>
  value instanceof Date ? value.toISOString() : value || null;

const mapProductStockAlertRow = (row) => {
  if (!row) {
    return null;
  }

  const deliveryAddress =
    row.delivery_address && typeof row.delivery_address === "object"
      ? row.delivery_address
      : {};

  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    status: row.status,
    notifiedAt: toIsoString(row.notified_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    customer: row.full_name
      ? {
          id: row.user_id,
          fullName: row.full_name,
          email: row.email || "",
          phoneNumber: row.phone_number || "",
          city: String(
            deliveryAddress.city ||
              deliveryAddress.town ||
              deliveryAddress.state ||
              "",
          ).trim(),
        }
      : undefined,
  };
};

const createOrUpdateProductStockAlert = async ({ productId, userId }) => {
  const id = generateId();
  const now = new Date();
  const result = await query(
    `INSERT INTO product_stock_alerts (
      id,
      product_id,
      user_id,
      status,
      notified_at,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, NULL, $5, $6
    )
    ON CONFLICT (product_id, user_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      notified_at = NULL,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      id,
      productId,
      userId,
      PRODUCT_STOCK_ALERT_STATUSES.requested,
      now,
      now,
    ],
  );

  return mapProductStockAlertRow(result.rows[0]);
};

const listRequestedProductStockAlertsByProductId = async (productId) => {
  const result = await query(
    `SELECT
       psa.*,
       u.full_name,
       u.email,
       u.phone_number,
       u.delivery_address
     FROM product_stock_alerts psa
     INNER JOIN users u
       ON u.id = psa.user_id
     WHERE psa.product_id = $1
       AND psa.status = $2
     ORDER BY psa.created_at DESC`,
    [productId, PRODUCT_STOCK_ALERT_STATUSES.requested],
  );

  return result.rows.map(mapProductStockAlertRow).filter(Boolean);
};

const listRequestedProductIdsByUserId = async (userId) => {
  const result = await query(
    `SELECT product_id
     FROM product_stock_alerts
     WHERE user_id = $1
       AND status = $2
     ORDER BY created_at DESC`,
    [userId, PRODUCT_STOCK_ALERT_STATUSES.requested],
  );

  return result.rows
    .map((row) => String(row.product_id || "").trim())
    .filter(Boolean);
};

const countRequestedProductStockAlertsByProductIds = async (productIds = []) => {
  const normalizedProductIds = [...new Set(
    productIds.map((productId) => String(productId || "").trim()).filter(Boolean),
  )];

  if (!normalizedProductIds.length) {
    return new Map();
  }

  const result = await query(
    `SELECT product_id, COUNT(*)::int AS count
     FROM product_stock_alerts
     WHERE product_id = ANY($1::text[])
       AND status = $2
     GROUP BY product_id`,
    [normalizedProductIds, PRODUCT_STOCK_ALERT_STATUSES.requested],
  );

  return new Map(
    result.rows.map((row) => [
      String(row.product_id || "").trim(),
      Number(row.count || 0),
    ]),
  );
};

module.exports = {
  PRODUCT_STOCK_ALERT_STATUSES,
  countRequestedProductStockAlertsByProductIds,
  createOrUpdateProductStockAlert,
  listRequestedProductIdsByUserId,
  listRequestedProductStockAlertsByProductId,
};
