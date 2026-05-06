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
    title: row.title || "",
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
  title,
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
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12
    )
    ON CONFLICT (product_id, user_id)
    DO UPDATE SET
      rating = EXCLUDED.rating,
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      status = EXCLUDED.status,
      author_name = EXCLUDED.author_name,
      author_location = EXCLUDED.author_location,
      verified_buyer = EXCLUDED.verified_buyer,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      id,
      productId,
      userId,
      rating,
      title,
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
      title: updates.title,
      body: updates.body,
      status: updates.status,
      authorName: updates.authorName,
      authorLocation: updates.authorLocation,
      verifiedBuyer: updates.verifiedBuyer,
      helpfulCount: updates.helpfulCount,
      updatedAt: new Date(),
    },
    {
      authorName: "author_name",
      authorLocation: "author_location",
      verifiedBuyer: "verified_buyer",
      helpfulCount: "helpful_count",
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

const hasUserPurchasedProduct = async (userId, productId) => {
  const result = await query(
    `SELECT EXISTS (
      SELECT 1
      FROM orders
      CROSS JOIN LATERAL jsonb_array_elements(order_items) AS item
      WHERE user_id = $1
        AND item->>'productId' = $2
    ) AS has_purchased`,
    [userId, productId],
  );

  return Boolean(result.rows[0]?.has_purchased);
};

module.exports = {
  REVIEW_STATUSES,
  createOrUpdateProductReview,
  deleteProductReview,
  findProductReviewById,
  findProductReviewByProductIdAndUserId,
  hasUserPurchasedProduct,
  listProductReviews,
  listApprovedReviewsByProductId,
  updateProductReview,
};
