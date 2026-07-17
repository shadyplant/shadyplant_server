const { asyncHandler } = require("../utils/asyncHandler");
const {
  listPublicShippingZones,
} = require("../services/shipping-zone.service");

const listPublicShippingZonesController = asyncHandler(async (req, res) => {
  const zones = await listPublicShippingZones(req.query);

  res.status(200).json({
    message: "Shipping zones fetched successfully.",
    data: { zones },
  });
});

module.exports = {
  listPublicShippingZonesController,
};
