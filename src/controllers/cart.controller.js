const {
  addCartItem,
  clearUserCart,
  getUserCart,
  removeCartItem,
  replaceCartItem,
  syncUserCart,
  updateCartItemQuantity,
} = require("../services/cart.service");
const { asyncHandler } = require("../utils/asyncHandler");

const getCart = asyncHandler(async (req, res) => {
  const cart = await getUserCart(req.auth.userId);

  res.status(200).json({
    message: "Cart fetched successfully.",
    data: { cart },
  });
});

const addItemToCart = asyncHandler(async (req, res) => {
  const cart = await addCartItem(req.auth.userId, req.body);

  res.status(200).json({
    message: "Cart updated successfully.",
    data: { cart },
  });
});

const replaceCartLine = asyncHandler(async (req, res) => {
  const cart = await replaceCartItem(req.auth.userId, req.params.itemId, req.body);

  res.status(200).json({
    message: "Cart item updated successfully.",
    data: { cart },
  });
});

const patchCartLineQuantity = asyncHandler(async (req, res) => {
  const cart = await updateCartItemQuantity(req.auth.userId, req.params.itemId, req.body);

  res.status(200).json({
    message: "Cart quantity updated successfully.",
    data: { cart },
  });
});

const removeCartLine = asyncHandler(async (req, res) => {
  const cart = await removeCartItem(req.auth.userId, req.params.itemId);

  res.status(200).json({
    message: "Cart item removed successfully.",
    data: { cart },
  });
});

const syncCart = asyncHandler(async (req, res) => {
  const cart = await syncUserCart(req.auth.userId, req.body);

  res.status(200).json({
    message: "Cart synced successfully.",
    data: { cart },
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await clearUserCart(req.auth.userId);

  res.status(200).json({
    message: "Cart cleared successfully.",
    data: { cart },
  });
});

module.exports = {
  addItemToCart,
  clearCart,
  getCart,
  patchCartLineQuantity,
  removeCartLine,
  replaceCartLine,
  syncCart,
};
