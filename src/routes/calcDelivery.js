const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");

const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const STORE_LOCATION = { lat: 26.3280748, lng: 90.8396704 };

async function getDistance(lat, lng) {
  const cacheKey = `${lat},${lng}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    {
      params: {
        origins: `${STORE_LOCATION.lat},${STORE_LOCATION.lng}`,
        destinations: `${lat},${lng}`,
        key: GOOGLE_API_KEY,
      },
    },
  );

  const element = res.data?.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new Error("Route not available");
  }

  const distanceKm = element.distance.value / 1000;

  cache.set(cacheKey, distanceKm);

  return distanceKm;
}

function calculateTransportCharge(weight, distance) {
  // ─── Input type guard ───────────────────────────────────────────────────────
  if (
    typeof weight !== "number" ||
    typeof distance !== "number" ||
    isNaN(weight) ||
    isNaN(distance)
  ) {
    return {
      success: false,
      message:
        "Warn: Sorry Invalid Location or Quantity — weight and distance must be numeric values.",
    };
  }
  // ─── Step 1: Validate location (distance) and quantity (weight) ─────────────
  // Mirrors the flowchart node: "If location valid && quantity > 0"
  if (weight <= 0 || distance <= 0) {
    return {
      success: false,
      message: "Warn: Sorry Invalid Location or Quantity",
    };
  }
  // ─── Step 2: Light-goods path ────────────────────────────────────────────────
  // Weight: 1 – 800 kg  |  Distance: 60 – 600 km
  if (weight >= 1 && weight <= 800) {
    if (distance < 60 || distance > 600) {
      return {
        success: false,
        message: `Warn! Distance Out Of Range — for weight ${weight} kg (light goods: 1–800 kg), distance must be 60–600 km. Provided: ${distance} km.`,
      };
    }
    /**
     * Cost formula (from flowchart):
     *   X    = ceil(W / 20)   → number of 20-kg units, always rounded UP
     *   COST = X * Base       → Base is the per-unit cost (rate per km here)
     */
    const BASE_PRICE = 1200; // ₹ per km per unit-of-20kg
    const units = Math.ceil(weight / 20);
    const cost = units * BASE_PRICE;
    return {
      success: true,
      cost,
      rate: BASE_PRICE,
      message: `Response Done — Light goods: ${units} unit(s) × ₹${BASE_PRICE} = ₹${cost}`,
    };
  }
  // ─── Step 3: Heavy-goods path ────────────────────────────────────────────────
  // Weight: 800 – 30000 kg  |  Distance: 60 – 1200 km  (outer boundary check)
  if (weight > 800 && weight <= 30000) {
    if (distance < 60 || distance > 1200) {
      return {
        success: false,
        message: `Warn! Distance Out Of Range — for weight ${weight} kg (heavy goods: 801–30000 kg), distance must be 60–1200 km. Provided: ${distance} km.`,
      };
    }
    let ratePerKm = null;
    // Weight bracket waterfall (highest first, matching flowchart cascade)
    if (weight > 25000) {
      ratePerKm = 136;
    } else if (weight > 12500 && weight <= 25000) {
      ratePerKm = 112;
    } else if (weight > 7500 && weight <= 12500) {
      ratePerKm = 96;
    } else if (weight > 5000 && weight <= 7500) {
      ratePerKm = 80;
    } else if (weight > 1500 && weight <= 5000) {
      ratePerKm = 69;
    } else if (weight > 800 && weight <= 1500) {
      // Sub-decision on distance for the 800–1500 kg bracket
      if (distance >= 60 && distance <= 300) {
        ratePerKm = 53;
      } else if (distance > 300 && distance <= 1200) {
        ratePerKm = 69;
      } else {
        // Distance out of range for this bracket
        return {
          success: false,
          message: `Warn! Distance Out Of Range — for weight ${weight} kg (bracket 801–1500 kg), distance must be 60–1200 km. Provided: ${distance} km.`,
        };
      }
    }
    if (ratePerKm !== null) {
      const cost = ratePerKm * distance;
      return {
        success: true,
        cost,
        rate: ratePerKm,
        message: `Response Done — Rate ₹${ratePerKm}/km × ${distance} km = ₹${cost}`,
      };
    }
  }
  // ─── Step 4: Out-of-range fallback ──────────────────────────────────────────
  // Reached only when weight itself is out of all valid brackets (>30000 kg).
  return {
    success: false,
    message: `Warn! Weight Out Of Range — valid range is 1–30000 kg. Provided: ${weight} kg.`,
  };
}

router.post("/", async (req, res) => {
  try {
    const rawWeight = req.body?.weight ?? req.body?.quantity;
    const rawDistance = req.body?.distance ?? req.body?.distance_km;
    const rawLat = req.body?.lat;
    const rawLng = req.body?.lng;

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

      if (!GOOGLE_API_KEY) {
        return res.status(500).json({
          ok: false,
          success: false,
          message: "GOOGLE_API_KEY is not configured.",
        });
      }

      distanceKm = await getDistance(lat, lng);
    }

    const result = calculateTransportCharge(weight, distanceKm);
    const statusCode = result.success ? 200 : 400;
    const roundedDistanceKm = Number.isFinite(distanceKm)
      ? Number(distanceKm.toFixed(2))
      : null;

    return res.status(statusCode).json({
      ok: result.success,
      ...result,
      weight,
      distance_km: roundedDistanceKm,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
