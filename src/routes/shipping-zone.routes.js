const express = require("express");
const {
  listPublicShippingZonesController,
} = require("../controllers/shipping-zone.public.controller");

const router = express.Router();

router.get("/", listPublicShippingZonesController);

module.exports = router;
