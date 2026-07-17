const express = require("express");
const {
  checkShippingServiceabilityController,
} = require("../controllers/shipping-restriction.controller");

const router = express.Router();

router.get("/check", checkShippingServiceabilityController);

module.exports = router;
