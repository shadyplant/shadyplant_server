const axios = require("axios");
const NodeCache = require("node-cache");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

const cache = new NodeCache({ stdTTL: 300 });

const STORE_LOCATION = {
  lat: env.delivery.originLat,
  lng: env.delivery.originLng,
};

const parseCoordinate = (value, label) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new ApiError(400, `${label} must be a numeric value.`);
  }

  return parsedValue;
};

const calculateHaversineDistanceKm = (from, to) => {
  const earthRadiusKm = 6371;
  const latDelta = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getDistanceFromGoogleMaps = async (lat, lng) => {
  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    {
      params: {
        origins: `${STORE_LOCATION.lat},${STORE_LOCATION.lng}`,
        destinations: `${lat},${lng}`,
        key: env.googleMaps.serverApiKey,
      },
    },
  );

  const element = response.data?.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new ApiError(400, "Route not available for the selected delivery location.");
  }

  return element.distance.value / 1000;
};

const getDistanceKmForLocation = async ({ lat, lng }) => {
  const normalizedLat = parseCoordinate(lat, "lat");
  const normalizedLng = parseCoordinate(lng, "lng");
  const cacheKey = `${normalizedLat.toFixed(6)},${normalizedLng.toFixed(6)}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let distanceKm;

  if (env.googleMaps.serverApiKey) {
    distanceKm = await getDistanceFromGoogleMaps(normalizedLat, normalizedLng);
  } else {
    distanceKm = calculateHaversineDistanceKm(STORE_LOCATION, {
      lat: normalizedLat,
      lng: normalizedLng,
    });
  }

  const roundedDistanceKm = Number(distanceKm.toFixed(2));
  cache.set(cacheKey, roundedDistanceKm);
  return roundedDistanceKm;
};

const calculateTransportCharge = (weight, distance) => {
  if (
    typeof weight !== "number" ||
    typeof distance !== "number" ||
    Number.isNaN(weight) ||
    Number.isNaN(distance)
  ) {
    return {
      success: false,
      message: "Invalid location or quantity. Weight and distance must be numeric values.",
    };
  }

  if (weight <= 0 || distance <= 0) {
    return {
      success: false,
      message: "Invalid location or quantity.",
    };
  }

  if (weight >= 1 && weight <= 800) {
    if (distance > 600) {
      return {
        success: false,
        message: `Distance out of range for quantity ${weight}. Maximum supported range is 600 km.`,
      };
    }

    const basePrice = 1200;
    const units = Math.ceil(weight / 20);
    const cost = units * basePrice;

    return {
      success: true,
      cost,
      rate: basePrice,
      units,
      message: `Light goods delivery calculated for ${units} unit(s).`,
    };
  }

  if (weight > 800 && weight <= 30000) {
    if (distance > 1200) {
      return {
        success: false,
        message: `Distance out of range for quantity ${weight}. Maximum supported range is 1200 km.`,
      };
    }

    const billableDistance = Math.max(distance, 60);
    let ratePerKm = null;

    if (weight > 25000) {
      ratePerKm = 136;
    } else if (weight > 12500) {
      ratePerKm = 112;
    } else if (weight > 7500) {
      ratePerKm = 96;
    } else if (weight > 5000) {
      ratePerKm = 80;
    } else if (weight > 1500) {
      ratePerKm = 69;
    } else if (weight > 800) {
      ratePerKm = distance <= 300 ? 53 : 69;
    }

    if (ratePerKm !== null) {
      return {
        success: true,
        cost: Math.round(ratePerKm * billableDistance),
        rate: ratePerKm,
        units: null,
        message: `Heavy goods delivery calculated at ${ratePerKm} INR/km.`,
      };
    }
  }

  return {
    success: false,
    message: `Quantity out of range. Supported range is 1-30000.`,
  };
};

module.exports = {
  STORE_LOCATION,
  calculateTransportCharge,
  getDistanceKmForLocation,
};
