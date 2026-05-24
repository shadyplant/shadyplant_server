const express = require("express");
const {
  listHomeSliderBanners,
} = require("../controllers/home-slider-banner.controller");

const router = express.Router();

router.get("/", listHomeSliderBanners);

module.exports = router;
