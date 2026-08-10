const { asyncHandler } = require("../utils/asyncHandler");
const {
  getDeliveryChargeConfigurationSnapshot,
} = require("../services/delivery-charge.service");

// Public delivery configuration snapshot for the storefront.
// Keep this lightweight so the client can cache it and the checkout
// flow can still verify pricing on the server when needed.
const getDeliveryConfigController = asyncHandler(async (req, res) => {
  const config = getDeliveryChargeConfigurationSnapshot();

  res.status(200).json({
    message: "Delivery configuration fetched successfully.",
    data: { config },
  });
});

module.exports = {
  getDeliveryConfigController,
};
