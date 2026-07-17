const { asyncHandler } = require("../utils/asyncHandler");
const {
  createDeliveryChargeSlab,
  deleteDeliveryChargeSlab,
  getDeliveryChargeProfile,
  listDeliveryChargeProfilesForAdmin,
  listDeliveryChargeSlabsForAdmin,
  updateDeliveryChargeProfile,
  updateDeliveryChargeSlab,
} = require("../services/delivery-charge.service");

const listDeliveryChargeProfilesController = asyncHandler(async (req, res) => {
  const profiles = await listDeliveryChargeProfilesForAdmin(req.query);

  res.status(200).json({
    message: "Delivery charge profiles fetched successfully.",
    data: { profiles },
  });
});

const getDeliveryChargeProfileController = asyncHandler(async (req, res) => {
  const profile = await getDeliveryChargeProfile(req.params.profileCode);

  res.status(200).json({
    message: "Delivery charge profile fetched successfully.",
    data: { profile },
  });
});

const updateDeliveryChargeProfileController = asyncHandler(async (req, res) => {
  const profile = await updateDeliveryChargeProfile(req.params.profileCode, req.body);

  res.status(200).json({
    message: "Delivery charge profile updated successfully.",
    data: { profile },
  });
});

const listDeliveryChargeSlabsController = asyncHandler(async (req, res) => {
  const slabs = await listDeliveryChargeSlabsForAdmin(req.query);

  res.status(200).json({
    message: "Delivery charge slabs fetched successfully.",
    data: { slabs },
  });
});

const createDeliveryChargeSlabController = asyncHandler(async (req, res) => {
  const slab = await createDeliveryChargeSlab(req.body);

  res.status(201).json({
    message: "Delivery charge slab created successfully.",
    data: { slab },
  });
});

const updateDeliveryChargeSlabController = asyncHandler(async (req, res) => {
  const slab = await updateDeliveryChargeSlab(req.params.slabId, req.body);

  res.status(200).json({
    message: "Delivery charge slab updated successfully.",
    data: { slab },
  });
});

const deleteDeliveryChargeSlabController = asyncHandler(async (req, res) => {
  const slab = await deleteDeliveryChargeSlab(req.params.slabId);

  res.status(200).json({
    message: "Delivery charge slab deleted successfully.",
    data: { slab },
  });
});

module.exports = {
  createDeliveryChargeSlabController,
  deleteDeliveryChargeSlabController,
  getDeliveryChargeProfileController,
  listDeliveryChargeProfilesController,
  listDeliveryChargeSlabsController,
  updateDeliveryChargeProfileController,
  updateDeliveryChargeSlabController,
};
