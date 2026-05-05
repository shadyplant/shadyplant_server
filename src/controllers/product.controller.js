const {
  createProductStockAlert,
  createProductReview,
  getProductDetails,
  getMyProductStockAlerts,
  getProductReviews,
  getProducts,
} = require("../services/product.service");
const { asyncHandler } = require("../utils/asyncHandler");

const listProducts = asyncHandler(async (req, res) => {
  const products = await getProducts(req.query);

  res.status(200).json({
    message: "Products fetched successfully.",
    data: { products },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await getProductDetails(req.params.productId);

  res.status(200).json({
    message: "Product fetched successfully.",
    data: { product },
  });
});

const listProductReviews = asyncHandler(async (req, res) => {
  const reviewData = await getProductReviews(req.params.productId);

  res.status(200).json({
    message: "Product reviews fetched successfully.",
    data: reviewData,
  });
});

const submitProductReview = asyncHandler(async (req, res) => {
  const review = await createProductReview(
    req.auth.userId,
    req.params.productId,
    req.body,
  );

  res.status(201).json({
    message: review.message,
    data: { review },
  });
});

const listMyProductStockAlerts = asyncHandler(async (req, res) => {
  const stockAlerts = await getMyProductStockAlerts(req.auth.userId);

  res.status(200).json({
    message: "Product stock alerts fetched successfully.",
    data: stockAlerts,
  });
});

const submitProductStockAlert = asyncHandler(async (req, res) => {
  const alert = await createProductStockAlert(
    req.auth.userId,
    req.params.productId,
  );

  res.status(201).json({
    message: "You will be notified when this product is back in stock.",
    data: { alert },
  });
});

module.exports = {
  getProduct,
  listMyProductStockAlerts,
  listProductReviews,
  listProducts,
  submitProductStockAlert,
  submitProductReview,
};
