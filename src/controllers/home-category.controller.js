const { listPublicHomeCategoryItems } = require("../services/home-category.service");
const { asyncHandler } = require("../utils/asyncHandler");

const listHomeCategoryItems = asyncHandler(async (req, res) => {
  const items = await listPublicHomeCategoryItems();

  res.status(200).json({
    message: "Home category items fetched successfully.",
    data: { items },
  });
});

module.exports = {
  listHomeCategoryItems,
};
