const { listPublicHomeSliderBanners } = require("../services/home-slider-banner.service");
const { asyncHandler } = require("../utils/asyncHandler");

const listHomeSliderBanners = asyncHandler(async (req, res) => {
  const items = await listPublicHomeSliderBanners();

  res.status(200).json({
    message: "Home slider banners fetched successfully.",
    data: { items },
  });
});

module.exports = {
  listHomeSliderBanners,
};
