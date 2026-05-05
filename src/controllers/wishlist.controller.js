const {
  addWishlistItem,
  clearUserWishlist,
  getUserWishlist,
  removeWishlistItem,
  syncUserWishlist,
} = require("../services/wishlist.service");
const { asyncHandler } = require("../utils/asyncHandler");

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getUserWishlist(req.auth.userId);

  res.status(200).json({
    message: "Wishlist fetched successfully.",
    data: { wishlist },
  });
});

const addItemToWishlist = asyncHandler(async (req, res) => {
  const wishlist = await addWishlistItem(req.auth.userId, req.body);

  res.status(200).json({
    message: "Wishlist updated successfully.",
    data: { wishlist },
  });
});

const syncWishlist = asyncHandler(async (req, res) => {
  const wishlist = await syncUserWishlist(req.auth.userId, req.body);

  res.status(200).json({
    message: "Wishlist synced successfully.",
    data: { wishlist },
  });
});

const removeWishlistLine = asyncHandler(async (req, res) => {
  const wishlist = await removeWishlistItem(req.auth.userId, req.params.itemId);

  res.status(200).json({
    message: "Wishlist item removed successfully.",
    data: { wishlist },
  });
});

const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await clearUserWishlist(req.auth.userId);

  res.status(200).json({
    message: "Wishlist cleared successfully.",
    data: { wishlist },
  });
});

module.exports = {
  addItemToWishlist,
  clearWishlist,
  getWishlist,
  removeWishlistLine,
  syncWishlist,
};
