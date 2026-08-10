const express = require("express");
const { getDeliveryConfigController } = require("../controllers/delivery-config.controller");

const router = express.Router();

// Public snapshot of delivery charge configuration.
// The storefront can load this once and use it as cached UI input,
// while the server still remains the final source of truth at checkout.
router.get("/", getDeliveryConfigController);

module.exports = router;
