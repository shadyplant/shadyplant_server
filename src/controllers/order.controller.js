const {
  createUserOrder,
  getUserOrder,
  listUserOrders,
  submitUserRefundAccountDetails,
} = require("../services/order.service");
const { asyncHandler } = require("../utils/asyncHandler");

const createOrder = asyncHandler(async (req, res) => {
  const order = await createUserOrder(req.auth.userId, req.body);

  res.status(201).json({
    message: "Order placed successfully.",
    data: { order },
  });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await listUserOrders(req.auth.userId);

  res.status(200).json({
    message: "Orders fetched successfully.",
    data: { orders },
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await getUserOrder(req.auth.userId, req.params.orderId);

  res.status(200).json({
    message: "Order fetched successfully.",
    data: { order },
  });
});

const submitRefundAccountDetails = asyncHandler(async (req, res) => {
  const order = await submitUserRefundAccountDetails(
    req.auth.userId,
    req.params.orderId,
    req.body,
  );

  res.status(200).json({
    message: "Refund account details submitted successfully.",
    data: { order },
  });
});

module.exports = {
  createOrder,
  getOrder,
  listOrders,
  submitRefundAccountDetails,
};
