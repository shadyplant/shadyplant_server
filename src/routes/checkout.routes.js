const express = require("express");
const {
  createOnlineCheckout,
  getPreview,
  placeCashOnDeliveryOrder,
} = require("../controllers/checkout.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.post("/preview", getPreview);
router.post("/cod", placeCashOnDeliveryOrder);
router.post("/online", createOnlineCheckout);

module.exports = router;
