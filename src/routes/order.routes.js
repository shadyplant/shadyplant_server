const express = require("express");
const {
  createOrder,
  getOrder,
  listOrders,
  submitRefundAccountDetails,
} = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", listOrders);
router.post("/", createOrder);
router.get("/:orderId", getOrder);
router.patch("/:orderId/refund-account", submitRefundAccountDetails);

module.exports = router;
