const axios = require("axios");
const NodeCache = require("node-cache");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");
const {
  calculateTransportCharge: calculateTransportChargeByRules,
} = require("./delivery-charge.service");

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

const calculateTransportCharge = (weight, distance, stateOrOptions) =>
  calculateTransportChargeByRules(weight, distance, stateOrOptions);

module.exports = {
  STORE_LOCATION,
  calculateTransportCharge,
  getDistanceKmForLocation,
  getStateNameForLocation,
  resolveDeliveryState,
};
