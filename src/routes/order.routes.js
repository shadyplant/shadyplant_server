const express = require("express");
const { createOrder, getOrder, listOrders } = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", listOrders);
router.post("/", createOrder);
router.get("/:orderId", getOrder);

module.exports = router;
