const express = require("express");
const {
  addItemToCart,
  clearCart,
  getCart,
  patchCartLineQuantity,
  removeCartLine,
  replaceCartLine,
  syncCart,
} = require("../controllers/cart.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", getCart);
router.post("/items", addItemToCart);
router.put("/items/:itemId", replaceCartLine);
router.patch("/items/:itemId", patchCartLineQuantity);
router.delete("/items/:itemId", removeCartLine);
router.put("/sync", syncCart);
router.delete("/", clearCart);

module.exports = router;
