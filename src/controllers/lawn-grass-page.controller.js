const { getLawnGrassPageSettings } = require("../services/lawn-grass-page.service");
const { asyncHandler } = require("../utils/asyncHandler");

const getLawnGrassPage = asyncHandler(async (_req, res) => {
  const settings = await getLawnGrassPageSettings();

  res.status(200).json({
    message: "Lawn grass page settings fetched successfully.",
    data: settings,
  });
});

module.exports = {
  getLawnGrassPage,
};
