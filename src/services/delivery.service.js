const axios = require("axios");
const NodeCache = require("node-cache");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");
const {
  calculateTransportChargeForPanIndia,
} = require("../transport-charge-calculator/pan-india");
const {
  calculateTransportChargeForNorthEast,
} = require("../transport-charge-calculator/ne");

const cache = new NodeCache({ stdTTL: 300 });

const STORE_LOCATION = {
  lat: env.delivery.originLat,
  lng: env.delivery.originLng,
};

const PAN_INDIA_STATES = new Set([
  "assam",
  "jharkhand",
  "bihar",
  "west bengal",
]);

const NORTH_EAST_STATES = new Set([
  "meghalaya",
  "mizoram",
  "nagaland",
  "tripura",
  "arunachal pradesh",
  "manipur",
  "sikkim",
]);

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

const getStateFromGoogleMaps = async (lat, lng) => {
  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: {
        latlng: `${lat},${lng}`,
        key: env.googleMaps.serverApiKey,
      },
    },
  );

  const results = Array.isArray(response.data?.results)
    ? response.data.results
    : [];

  for (const result of results) {
    const stateComponent = Array.isArray(result?.address_components)
      ? result.address_components.find((component) =>
          Array.isArray(component.types) &&
          component.types.includes("administrative_area_level_1"),
        )
      : null;

    const stateName = String(stateComponent?.long_name || "").trim();
    if (stateName) {
      return stateName;
    }
  }

  return "";
};

const getStateNameForLocation = async ({ lat, lng }) => {
  const normalizedLat = parseCoordinate(lat, "lat");
  const normalizedLng = parseCoordinate(lng, "lng");
  const cacheKey = `state:${normalizedLat.toFixed(6)},${normalizedLng.toFixed(6)}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  if (!env.googleMaps.serverApiKey) {
    return "";
  }

  const stateName = await getStateFromGoogleMaps(normalizedLat, normalizedLng);
  cache.set(cacheKey, stateName);
  return stateName;
};

const resolveDeliveryState = async ({ state, lat, lng } = {}) => {
  const providedState = String(state || "").trim();

  if (providedState) {
    return providedState;
  }

  if (lat === undefined || lng === undefined) {
    return "";
  }

  return getStateNameForLocation({ lat, lng });
};

const calculateTransportCharge = (weight, distance, state) => {
  console.log("Calculating transport charge with inputs:", { weight, distance, state });
  const normalizedState = String(state || "").trim().toLowerCase();

  if (!normalizedState) {
    return {
      success: false,
      message: "Delivery state is required for transport charge calculation.",
    };
  }

  if (PAN_INDIA_STATES.has(normalizedState)) {
    return calculateTransportChargeForPanIndia(weight, distance);
  }

  if (NORTH_EAST_STATES.has(normalizedState)) {
    return calculateTransportChargeForNorthEast(weight, distance);
  }

  return {
    success: false,
    message: `Unsupported delivery state: ${state}.`,
  }
};

module.exports = {
  STORE_LOCATION,
  calculateTransportCharge,
  getDistanceKmForLocation,
  getStateNameForLocation,
  resolveDeliveryState,
};
