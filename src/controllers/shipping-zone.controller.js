const { asyncHandler } = require("../utils/asyncHandler");
const {
  createShippingZone,
  deleteShippingZone,
  listShippingZones,
  updateShippingZone,
} = require("../services/shipping-zone.service");

const listShippingZonesForAdmin = asyncHandler(async (req, res) => {
  const zones = await listShippingZones(req.query);

  res.status(200).json({
    message: "Shipping zones fetched successfully.",
    data: { zones },
  });
});

const createShippingZoneForAdmin = asyncHandler(async (req, res) => {
  const zone = await createShippingZone(req.body);

  res.status(201).json({
    message: "Shipping zone created successfully.",
    data: { zone },
  });
});

const updateShippingZoneForAdmin = asyncHandler(async (req, res) => {
  const zone = await updateShippingZone(req.params.zoneId, req.body);

  res.status(200).json({
    message: "Shipping zone updated successfully.",
    data: { zone },
  });
});

const deleteShippingZoneForAdmin = asyncHandler(async (req, res) => {
  const zone = await deleteShippingZone(req.params.zoneId);

  res.status(200).json({
    message: "Shipping zone deleted successfully.",
    data: { zone },
  });
});

module.exports = {
  createShippingZoneForAdmin,
  deleteShippingZoneForAdmin,
  listShippingZonesForAdmin,
  updateShippingZoneForAdmin,
};
