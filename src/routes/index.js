const express = require("express");
const adminRoutes = require("./admin.routes");
const authRoutes = require("./auth.routes");
const cartRoutes = require("./cart.routes");
const checkoutRoutes = require("./checkout.routes");
const homeCategoryRoutes = require("./home-category.routes");
const homeSliderBannerRoutes = require("./home-slider-banner.routes");
const orderRoutes = require("./order.routes");
const paymentRoutes = require("./payment.routes");
const calcRoute = require("./calcDelivery");
const productRoutes = require("./product.routes");
const wishlistRoutes = require("./wishlist.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    message: "Grass Green Nursery auth server is healthy.",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/cart", cartRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/home-categories", homeCategoryRoutes);
router.use("/home-slider-banners", homeSliderBannerRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/products", productRoutes);
router.use("/calc-delivery", calcRoute);
router.use("/wishlist", wishlistRoutes);

module.exports = router;
