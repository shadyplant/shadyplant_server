
const express = require("express");
const { ApiError } = require("../utils/apiError");
const {
  calculateTransportCharge,
  getDistanceKmForLocation,
  resolveDeliveryState,
} = require("../services/delivery.service");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const rawWeight = req.body?.weight ?? req.body?.quantity;
    const rawDistance = req.body?.distance ?? req.body?.distance_km;
    const rawLat = req.body?.lat;
    const rawLng = req.body?.lng;
    const rawProfileCode =
      req.body?.profileCode ??
      req.body?.profile_code ??
      req.body?.deliveryProfileCode;

    const weight = Number(rawWeight);
    const hasDirectDistance =
      rawDistance !== undefined && rawDistance !== null && rawDistance !== "";
    let distanceKm = hasDirectDistance ? Number(rawDistance) : null;

    if (!hasDirectDistance) {
      if (rawLat === undefined || rawLng === undefined) {
        return res.status(400).json({
          ok: false,
          success: false,
          message: "Provide either distance or both lat and lng.",
        });
      }

      const lat = Number(rawLat);
      const lng = Number(rawLng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
          ok: false,
          success: false,
          message: "lat and lng must be numeric values.",
        });
      }

      distanceKm = await getDistanceKmForLocation({ lat, lng });
    }

    const resolvedState =
      String(req.body?.state || "").trim() ||
      (rawLat !== undefined && rawLng !== undefined
        ? await resolveDeliveryState({ lat: rawLat, lng: rawLng })
        : "");

    if (!resolvedState && !rawProfileCode) {
      return res.status(400).json({
        ok: false,
        success: false,
        message:
          "State is required. Pass state from the frontend, provide lat and lng for geo lookup, or send a delivery profile code.",
      });
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      throw new ApiError(400, "weight must be a positive numeric value.");
    }

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      throw new ApiError(400, "distance must be a positive numeric value.");
    }

    const result = calculateTransportCharge(weight, distanceKm, {
      state: resolvedState,
      profileCode: rawProfileCode,
    });
    const statusCode = result.success ? 200 : 400;
    const roundedDistanceKm = Number.isFinite(distanceKm)
      ? Number(distanceKm.toFixed(2))
      : null;

    return res.status(statusCode).json({
      ok: result.success,
      ...result,
      weight,
      distance_km: roundedDistanceKm,
      state: resolvedState,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;

    return res.status(statusCode).json({
      ok: false,
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
