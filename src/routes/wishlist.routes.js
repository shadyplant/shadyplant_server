const express = require("express");
const {
  addItemToWishlist,
  clearWishlist,
  getWishlist,
  removeWishlistLine,
  syncWishlist,
} = require("../controllers/wishlist.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWishlist);
router.post("/items", addItemToWishlist);
router.put("/sync", syncWishlist);
router.delete("/items/:itemId", removeWishlistLine);
router.delete("/", clearWishlist);

module.exports = router;
