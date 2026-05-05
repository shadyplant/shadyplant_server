const express = require("express");
const {
  getProduct,
  listMyProductStockAlerts,
  listProductReviews,
  listProducts,
  submitProductStockAlert,
  submitProductReview,
} = require("../controllers/product.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", listProducts);
router.get("/stock-alerts/me", requireAuth, listMyProductStockAlerts);
router.get("/:productId/reviews", listProductReviews);
router.post("/:productId/reviews", requireAuth, submitProductReview);
router.post("/:productId/stock-alerts", requireAuth, submitProductStockAlert);
router.get("/:productId", getProduct);

module.exports = router;
