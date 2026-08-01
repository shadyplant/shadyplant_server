const express = require("express");
const adminRoutes = require("./admin.routes");
const authRoutes = require("./auth.routes");
const cartRoutes = require("./cart.routes");
const checkoutRoutes = require("./checkout.routes");
const homeCategoryRoutes = require("./home-category.routes");
const homeSliderBannerRoutes = require("./home-slider-banner.routes");
const lawnGrassPageRoutes = require("./lawn-grass-page.routes");
const orderRoutes = require("./order.routes");
const paymentRoutes = require("./payment.routes");
const pushRoutes = require("./push.routes");
const calcRoute = require("./calcDelivery");
const shippingRoutes = require("./shipping.routes");
const shippingZoneRoutes = require("./shipping-zone.routes");
const productRoutes = require("./product.routes");
const wishlistRoutes = require("./wishlist.routes");
const whatsappRoutes = require("./whatsapp.routes");

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
router.use("/lawn-grass-page", lawnGrassPageRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/push", pushRoutes);
router.use("/products", productRoutes);
router.use("/calc-delivery", calcRoute);
router.use("/shipping", shippingRoutes);
router.use("/shipping-zones", shippingZoneRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/whatsapp", whatsappRoutes);

module.exports = router;
