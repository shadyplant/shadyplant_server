const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapCouponRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    type: row.type,
    adjustAmount: Number(row.adjust_amount || 0),
    discountPercent: Number(row.discount_percent || 0),
    status: row.status,
    usageMode: row.usage_mode,
    totalUsesAllowed: Number(row.total_uses_allowed || 1),
    totalUsesRedeemed: Number(row.total_uses_redeemed || 0),
    redeemedByUserId: row.redeemed_by_user_id || null,
    redeemedOrderId: row.redeemed_order_id || null,
    redeemedAt:
      row.redeemed_at instanceof Date
        ? row.redeemed_at.toISOString()
        : row.redeemed_at || null,
    reservedReference: row.reserved_reference || null,
    reservedByUserId: row.reserved_by_user_id || null,
    reservedAt:
      row.reserved_at instanceof Date
        ? row.reserved_at.toISOString()
        : row.reserved_at || null,
    reservationExpiresAt:
      row.reservation_expires_at instanceof Date
        ? row.reservation_expires_at.toISOString()
        : row.reservation_expires_at || null,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : row.expires_at || null,
    notes: row.notes || "",
    createdByStaffAccountId: row.created_by_staff_account_id || null,
    createdByStaffEmail: row.created_by_staff_email || null,
    createdByStaffName: row.created_by_staff_name || null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
};

const COUPON_SELECT_SQL = `
  SELECT
    coupon_codes.*,
    staff_accounts.email AS created_by_staff_email,
    staff_accounts.full_name AS created_by_staff_name
  FROM coupon_codes
  LEFT JOIN staff_accounts
    ON staff_accounts.id = coupon_codes.created_by_staff_account_id
`;

const listCouponCodes = async () => {
  const result = await query(
    `${COUPON_SELECT_SQL}
     ORDER BY coupon_codes.created_at DESC`,
  );

  return result.rows.map(mapCouponRow).filter(Boolean);
};

const findCouponCodeById = async (couponId) => {
  const result = await query(
    `${COUPON_SELECT_SQL}
     WHERE coupon_codes.id = $1
     LIMIT 1`,
    [couponId],
  );

  return mapCouponRow(result.rows[0]);
};

const findCouponCodeByCode = async (code) => {
  const result = await query(
    `${COUPON_SELECT_SQL}
     WHERE LOWER(coupon_codes.code) = LOWER($1)
     LIMIT 1`,
    [code],
  );

  return mapCouponRow(result.rows[0]);
};

const createCouponCode = async ({
  code,
  type,
  adjustAmount,
  discountPercent,
  status,
  usageMode,
  totalUsesAllowed,
  totalUsesRedeemed = 0,
  redeemedByUserId = null,
  redeemedOrderId = null,
  redeemedAt = null,
  reservedReference = null,
  reservedByUserId = null,
  reservedAt = null,
  reservationExpiresAt = null,
  expiresAt = null,
  notes = "",
  createdByStaffAccountId = null,
  metadata = {},
}) => {
  const id = generateId();
  const now = new Date();

  const result = await query(
    `INSERT INTO coupon_codes (
      id,
      code,
      type,
      adjust_amount,
      discount_percent,
      status,
      usage_mode,
      total_uses_allowed,
      total_uses_redeemed,
      redeemed_by_user_id,
      redeemed_order_id,
      redeemed_at,
      reserved_reference,
      reserved_by_user_id,
      reserved_at,
      reservation_expires_at,
      expires_at,
      notes,
      created_by_staff_account_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    )
    RETURNING *`,
    [
      id,
      code,
      type,
      adjustAmount,
      discountPercent,
      status,
      usageMode,
      totalUsesAllowed,
      totalUsesRedeemed,
      redeemedByUserId,
      redeemedOrderId,
      redeemedAt,
      reservedReference,
      reservedByUserId,
      reservedAt,
      reservationExpiresAt,
      expiresAt,
      notes,
      createdByStaffAccountId,
      metadata,
      now,
      now,
    ],
  );

  return findCouponCodeById(result.rows[0]?.id || id);
};

const updateCouponCode = async (couponId, updates = {}) => {
  const statement = buildUpdateStatement(
    {
      code: updates.code,
      type: updates.type,
      adjustAmount: updates.adjustAmount,
      discountPercent: updates.discountPercent,
      status: updates.status,
      usageMode: updates.usageMode,
      totalUsesAllowed: updates.totalUsesAllowed,
      totalUsesRedeemed: updates.totalUsesRedeemed,
      redeemedByUserId: updates.redeemedByUserId,
      redeemedOrderId: updates.redeemedOrderId,
      redeemedAt: updates.redeemedAt,
      reservedReference: updates.reservedReference,
      reservedByUserId: updates.reservedByUserId,
      reservedAt: updates.reservedAt,
      reservationExpiresAt: updates.reservationExpiresAt,
      expiresAt: updates.expiresAt,
      notes: updates.notes,
      createdByStaffAccountId: updates.createdByStaffAccountId,
      metadata: updates.metadata,
      updatedAt: new Date(),
    },
    {
      adjustAmount: "adjust_amount",
      discountPercent: "discount_percent",
      usageMode: "usage_mode",
      totalUsesAllowed: "total_uses_allowed",
      totalUsesRedeemed: "total_uses_redeemed",
      redeemedByUserId: "redeemed_by_user_id",
      redeemedOrderId: "redeemed_order_id",
      redeemedAt: "redeemed_at",
      reservedReference: "reserved_reference",
      reservedByUserId: "reserved_by_user_id",
      reservedAt: "reserved_at",
      reservationExpiresAt: "reservation_expires_at",
      expiresAt: "expires_at",
      createdByStaffAccountId: "created_by_staff_account_id",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findCouponCodeById(couponId);
  }

  await query(
    `UPDATE coupon_codes
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, couponId],
  );

  return findCouponCodeById(couponId);
};

const deleteCouponCode = async (couponId) => {
  const result = await query(
    `DELETE FROM coupon_codes
     WHERE id = $1
     RETURNING *`,
    [couponId],
  );

  return mapCouponRow(result.rows[0]);
};

const reserveCouponCode = async ({
  code,
  reservationReference,
  userId,
  reservationExpiresAt,
}) => {
  const result = await query(
    `UPDATE coupon_codes
     SET
       reserved_reference = $2,
       reserved_by_user_id = $3,
       reserved_at = NOW(),
       reservation_expires_at = $4,
       updated_at = NOW()
     WHERE LOWER(code) = LOWER($1)
       AND status = 'active'
       AND total_uses_redeemed < total_uses_allowed
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (
         reserved_reference IS NULL
         OR reservation_expires_at IS NULL
         OR reservation_expires_at < NOW()
         OR reserved_reference = $2
         OR reserved_by_user_id = $3
       )
     RETURNING *`,
    [code, reservationReference, userId, reservationExpiresAt],
  );

  return mapCouponRow(result.rows[0]);
};

const releaseCouponReservation = async (reservationReference) => {
  if (!reservationReference) {
    return null;
  }

  const result = await query(
    `UPDATE coupon_codes
     SET
       reserved_reference = NULL,
       reserved_by_user_id = NULL,
       reserved_at = NULL,
       reservation_expires_at = NULL,
       updated_at = NOW()
     WHERE reserved_reference = $1
       AND total_uses_redeemed < total_uses_allowed
     RETURNING *`,
    [reservationReference],
  );

  return mapCouponRow(result.rows[0]);
};

const consumeReservedCouponCode = async ({
  code,
  reservationReference,
  userId,
  orderId,
}) => {
  const result = await query(
    `UPDATE coupon_codes
     SET
       total_uses_redeemed = total_uses_redeemed + 1,
       redeemed_by_user_id = $3,
       redeemed_order_id = $4,
       redeemed_at = NOW(),
       reserved_reference = NULL,
       reserved_by_user_id = NULL,
       reserved_at = NULL,
       reservation_expires_at = NULL,
       status = CASE
         WHEN total_uses_redeemed + 1 >= total_uses_allowed THEN 'used'
         ELSE status
       END,
       updated_at = NOW()
     WHERE LOWER(code) = LOWER($1)
       AND reserved_reference = $2
       AND total_uses_redeemed < total_uses_allowed
       AND (expires_at IS NULL OR expires_at > NOW())
     RETURNING *`,
    [code, reservationReference, userId, orderId],
  );

  return mapCouponRow(result.rows[0]);
};

module.exports = {
  consumeReservedCouponCode,
  createCouponCode,
  deleteCouponCode,
  findCouponCodeByCode,
  findCouponCodeById,
  listCouponCodes,
  releaseCouponReservation,
  reserveCouponCode,
  updateCouponCode,
};
