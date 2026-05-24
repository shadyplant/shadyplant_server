const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const REVIEW_STATUSES = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

const mapReviewRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    rating: Number(row.rating),
    body: row.body || "",
    status: row.status,
    authorName: row.author_name || "Anonymous buyer",
    authorLocation: row.author_location || "",
    verifiedBuyer: Boolean(row.verified_buyer),
    helpfulCount: Number(row.helpful_count || 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
    adminReply:
      String(row.admin_reply_body || "").trim()
        ? {
            body: String(row.admin_reply_body || "").trim(),
            authorName: String(row.admin_reply_author_name || "").trim() || "Store team",
            updatedAt:
              row.admin_reply_updated_at instanceof Date
                ? row.admin_reply_updated_at.toISOString()
                : row.admin_reply_updated_at || null,
          }
        : null,
  };
};

const listApprovedReviewsByProductId = async (productId) => {
  const result = await query(
    `SELECT *
     FROM product_reviews
     WHERE product_id = $1 AND status = $2
     ORDER BY created_at DESC`,
    [productId, REVIEW_STATUSES.approved],
  );

  return result.rows.map(mapReviewRow).filter(Boolean);
};

const listProductReviews = async ({ productId, status } = {}) => {
  const clauses = [];
  const values = [];

  if (productId) {
    values.push(productId);
    clauses.push(`product_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    clauses.push(`status = $${values.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await query(
    `SELECT *
     FROM product_reviews
     ${whereClause}
     ORDER BY created_at DESC`,
    values,
  );

  return result.rows.map(mapReviewRow).filter(Boolean);
};

const findProductReviewById = async (reviewId) => {
  const result = await query(
    "SELECT * FROM product_reviews WHERE id = $1 LIMIT 1",
    [reviewId],
  );

  return mapReviewRow(result.rows[0]);
};

const findProductReviewByProductIdAndUserId = async (productId, userId) => {
  const result = await query(
    `SELECT *
     FROM product_reviews
     WHERE product_id = $1 AND user_id = $2
     LIMIT 1`,
    [productId, userId],
  );

  return mapReviewRow(result.rows[0]);
};

const createOrUpdateProductReview = async ({
  productId,
  userId,
  rating,
  body,
  status,
  authorName,
  authorLocation,
  verifiedBuyer,
}) => {
  const id = generateId();
  const now = new Date();

  const result = await query(
    `INSERT INTO product_reviews (
      id,
      product_id,
      user_id,
      rating,
      title,
      body,
      status,
      author_name,
      author_location,
      verified_buyer,
      helpful_count,
      admin_reply_body,
      admin_reply_author_name,
      admin_reply_updated_at,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, '', '', NULL, $11, $12
    )
    ON CONFLICT (product_id, user_id)
    DO UPDATE SET
      rating = EXCLUDED.rating,
      body = EXCLUDED.body,
      status = EXCLUDED.status,
      author_name = EXCLUDED.author_name,
      author_location = EXCLUDED.author_location,
      verified_buyer = EXCLUDED.verified_buyer,
      admin_reply_body = '',
      admin_reply_author_name = '',
      admin_reply_updated_at = NULL,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      id,
      productId,
      userId,
      rating,
      "",
      body,
      status,
      authorName,
      authorLocation,
      verifiedBuyer,
      now,
      now,
    ],
  );

  return mapReviewRow(result.rows[0]);
};

const updateProductReview = async (reviewId, updates) => {
  const statement = buildUpdateStatement(
    {
      rating: updates.rating,
      body: updates.body,
      status: updates.status,
      authorName: updates.authorName,
      authorLocation: updates.authorLocation,
      verifiedBuyer: updates.verifiedBuyer,
      helpfulCount: updates.helpfulCount,
      adminReplyBody: updates.adminReplyBody,
      adminReplyAuthorName: updates.adminReplyAuthorName,
      adminReplyUpdatedAt: updates.adminReplyUpdatedAt,
      updatedAt: new Date(),
    },
    {
      authorName: "author_name",
      authorLocation: "author_location",
      verifiedBuyer: "verified_buyer",
      helpfulCount: "helpful_count",
      adminReplyBody: "admin_reply_body",
      adminReplyAuthorName: "admin_reply_author_name",
      adminReplyUpdatedAt: "admin_reply_updated_at",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findProductReviewById(reviewId);
  }

  await query(
    `UPDATE product_reviews SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, reviewId],
  );

  return findProductReviewById(reviewId);
};

const deleteProductReview = async (reviewId) => {
  await query("DELETE FROM product_reviews WHERE id = $1", [reviewId]);
};

const hasUserDeliveredProduct = async (userId, productId) => {
  const result = await query(
    `SELECT EXISTS (
      SELECT 1
      FROM orders
      CROSS JOIN LATERAL jsonb_array_elements(order_items) AS item
      WHERE user_id = $1
        AND current_status = 'delivered'
        AND item->>'productId' = $2
    ) AS has_delivered_order`,
    [userId, productId],
  );

  return Boolean(result.rows[0]?.has_delivered_order);
};

module.exports = {
  REVIEW_STATUSES,
  createOrUpdateProductReview,
  deleteProductReview,
  findProductReviewById,
  findProductReviewByProductIdAndUserId,
  hasUserDeliveredProduct,
  listProductReviews,
  listApprovedReviewsByProductId,
  updateProductReview,
};
