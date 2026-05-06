const { PRODUCT_SEED } = require("../data/products.seed");
const {
  countProducts,
  createManyProducts,
  findProductById,
  listProducts,
  syncProductOptionGroups,
  syncProductStockValues,
  syncProductIdentifiers,
  syncProductImages,
  syncSeedProductMetadata,
} = require("../repositories/product.repository");
const {
  REVIEW_STATUSES,
  createOrUpdateProductReview,
  findProductReviewByProductIdAndUserId,
  hasUserPurchasedProduct,
  listApprovedReviewsByProductId,
} = require("../repositories/product-review.repository");
const {
  createOrUpdateProductStockAlert,
  listRequestedProductIdsByUserId,
} = require("../repositories/product-stock-alert.repository");
const { findUserById } = require("../repositories/user.repository");
const { ApiError } = require("../utils/apiError");

const parsePositiveInteger = (value, fallback = null) => {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const getProducts = async (query = {}) =>
  listProducts({
    query: String(query.q || "").trim(),
    category: String(query.category || "").trim(),
    badge: String(query.badge || "").trim(),
    excludeId: String(query.excludeId || "").trim(),
    limit: parsePositiveInteger(query.limit),
  });

const getProductDetails = async (productId) => {
  const product = await findProductById(String(productId || "").trim());

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return product;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeReviewPayload = (payload = {}) => {
  const rating = Number(payload.rating);
  const title = String(payload.title || "").trim();
  const review = String(payload.review || payload.body || "").trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5.");
  }

  if (title.length < 3) {
    throw new ApiError(400, "Review title must be at least 3 characters.");
  }

  if (review.length < 10) {
    throw new ApiError(400, "Review body must be at least 10 characters.");
  }

  return {
    rating: Math.round(rating),
    title,
    review,
  };
};

const buildReviewLocation = (user) =>
  String(
    user?.deliveryAddress?.city ||
      user?.billingDetails?.city ||
      user?.deliveryAddress?.state ||
      "",
  ).trim();

const serializePublishedReview = (review) => ({
  id: review.id,
  author: review.authorName,
  location: review.authorLocation,
  date: review.createdAt,
  rating: review.rating,
  title: review.title,
  body: review.body,
  helpfulCount: review.helpfulCount,
  verifiedBuyer: review.verifiedBuyer,
});

const buildReviewSummary = (reviews = []) => {
  const totalRatings = reviews.length;
  const breakdownMap = new Map(
    [5, 4, 3, 2, 1].map((stars) => [stars, 0]),
  );

  reviews.forEach((review) => {
    const stars = clamp(Math.round(Number(review.rating || 0)), 1, 5);
    breakdownMap.set(stars, (breakdownMap.get(stars) || 0) + 1);
  });

  const averageRating =
    totalRatings > 0
      ? Number(
          (
            reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
            totalRatings
          ).toFixed(1),
        )
      : 0;
  const recommendCount = reviews.filter((review) => Number(review.rating || 0) >= 4).length;

  return {
    averageRating,
    totalRatings,
    recommendPercent:
      totalRatings > 0 ? Math.round((recommendCount / totalRatings) * 100) : null,
    ratingBreakdown: [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: breakdownMap.get(stars) || 0,
    })),
  };
};

const getProductReviews = async (productId) => {
  const product = await getProductDetails(productId);
  const reviews = await listApprovedReviewsByProductId(product.id);
  const serializedReviews = reviews.map(serializePublishedReview);

  return {
    productId: product.id,
    summary: buildReviewSummary(serializedReviews),
    reviews: serializedReviews,
  };
};

const createProductReview = async (userId, productId, payload = {}) => {
  const product = await getProductDetails(productId);
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const normalizedPayload = normalizeReviewPayload(payload);
  const verifiedBuyer = await hasUserPurchasedProduct(userId, product.id);

  if (!verifiedBuyer) {
    throw new ApiError(
      403,
      "Only verified buyers can submit product reviews for this item.",
    );
  }

  const review = await createOrUpdateProductReview({
    productId: product.id,
    userId,
    rating: normalizedPayload.rating,
    title: normalizedPayload.title,
    body: normalizedPayload.review,
    status: REVIEW_STATUSES.pending,
    authorName: String(user.fullName || "Anonymous buyer").trim() || "Anonymous buyer",
    authorLocation: buildReviewLocation(user),
    verifiedBuyer,
  });

  return {
    id: review.id,
    status: review.status,
    message: "Review submitted successfully and is pending moderation.",
  };
};

const getMyProductReview = async (userId, productId) => {
  const product = await getProductDetails(productId);
  const review = await findProductReviewByProductIdAndUserId(product.id, userId);

  if (!review) {
    return {
      productId: product.id,
      review: null,
    };
  }

  return {
    productId: product.id,
    review: {
      id: review.id,
      author: review.authorName,
      location: review.authorLocation,
      date: review.createdAt,
      rating: review.rating,
      title: review.title,
      body: review.body,
      helpfulCount: review.helpfulCount,
      verifiedBuyer: review.verifiedBuyer,
      status: review.status,
      updatedAt: review.updatedAt,
    },
  };
};

const createProductStockAlert = async (userId, productId) => {
  const product = await getProductDetails(productId);
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (Math.max(0, Math.floor(Number(product.stock || 0))) > 0) {
    throw new ApiError(
      400,
      "This product is already in stock, so notification signup is not needed.",
    );
  }

  const alert = await createOrUpdateProductStockAlert({
    productId: product.id,
    userId,
  });

  return {
    ...alert,
    productName: product.name,
  };
};

const getMyProductStockAlerts = async (userId) => {
  const productIds = await listRequestedProductIdsByUserId(userId);

  return {
    productIds,
    alerts: productIds.map((productId) => ({ productId })),
  };
};

const seedProductCatalog = async () => {
  const productCount = await countProducts();

  if (productCount === 0) {
    await createManyProducts(PRODUCT_SEED);
    console.log(`Seeded ${PRODUCT_SEED.length} products into MongoDB.`);
  }

  const syncedIdentifierCount = await syncProductIdentifiers();
  const syncedCount = await syncProductImages();
  const syncedMetadataCount = await syncSeedProductMetadata(PRODUCT_SEED);
  const syncedStockCount = await syncProductStockValues(PRODUCT_SEED);
  const syncedOptionGroupCount = await syncProductOptionGroups(PRODUCT_SEED);

  if (syncedIdentifierCount > 0) {
    console.log(`Synchronized product identifiers for ${syncedIdentifierCount} products.`);
  }

  if (syncedCount > 0) {
    console.log(`Synchronized image galleries for ${syncedCount} products.`);
  }

  if (syncedMetadataCount > 0) {
    console.log(`Synchronized metadata for ${syncedMetadataCount} seeded products.`);
  }

  if (syncedStockCount > 0) {
    console.log(`Backfilled stock values for ${syncedStockCount} products.`);
  }

  if (syncedOptionGroupCount > 0) {
    console.log(`Backfilled option groups for ${syncedOptionGroupCount} products.`);
  }
};

module.exports = {
  createProductStockAlert,
  createProductReview,
  getProductReviews,
  getMyProductReview,
  getProductDetails,
  getMyProductStockAlerts,
  getProducts,
  seedProductCatalog,
};
