const {
  createCartCashfreeCheckout,
  placeCartOrderCashOnDelivery,
  previewCartCheckout,
} = require("../services/checkout.service");
const { asyncHandler } = require("../utils/asyncHandler");

const getPreview = asyncHandler(async (req, res) => {
  const preview = await previewCartCheckout(req.auth.userId, req.body);

  res.status(200).json({
    message: "Checkout preview generated successfully.",
    data: { preview },
  });
});

const placeCashOnDeliveryOrder = asyncHandler(async (req, res) => {
  const order = await placeCartOrderCashOnDelivery(req.auth.userId, req.body);

  res.status(201).json({
    message: "Cash on delivery order placed successfully.",
    data: { order },
  });
});

const createOnlineCheckout = asyncHandler(async (req, res) => {
  const checkout = await createCartCashfreeCheckout(req.auth.userId, req.body);

  res.status(201).json({
    message: "Online checkout created successfully.",
    data: { checkout },
  });
});

module.exports = {
  createOnlineCheckout,
  getPreview,
  placeCashOnDeliveryOrder,
};
