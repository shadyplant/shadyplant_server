const { ApiError } = require("../utils/apiError");
const {
  createShippingZone: createShippingZoneRecord,
  deleteShippingZone: deleteShippingZoneRecord,
  findDuplicateShippingZone,
  findShippingZoneById,
  findShippingZoneByName,
  listShippingZones: listShippingZoneRecords,
  updateShippingZone: updateShippingZoneRecord,
} = require("../repositories/shipping-zone.repository");

const VALID_ZONE_TYPES = new Set(["service", "restriction"]);
const MIN_VERTICES = 3;

const normalizeString = (value) => String(value || "").trim();

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Boolean(value);
};

const normalizeOpacity = (value, fallback = 0.28) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new ApiError(400, "Zone opacity must be a numeric value.");
  }

  if (parsedValue < 0 || parsedValue > 1) {
    throw new ApiError(400, "Zone opacity must be between 0 and 1.");
  }

  return parsedValue;
};

const normalizeZonePoints = (points = []) => {
  if (!Array.isArray(points)) {
    throw new ApiError(400, "Zone polygon must be an array of points.");
  }

  const normalizedPoints = points
    .map((point) => ({
      lat: Number(point?.lat),
      lng: Number(point?.lng),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (normalizedPoints.length < MIN_VERTICES) {
    throw new ApiError(400, "A zone polygon requires at least 3 valid points.");
  }

  return normalizedPoints;
};

const serializeZone = (zone) => {
  if (!zone) {
    return null;
  }

  return {
    id: zone.id,
    name: zone.name,
    zoneType: zone.zoneType,
    description: zone.description || "",
    notes: zone.notes || "",
    isActive: Boolean(zone.isActive),
    fillColor: zone.fillColor || "",
    strokeColor: zone.strokeColor || "",
    opacity: Number(zone.opacity ?? 0.28),
    polygon: Array.isArray(zone.polygon) ? zone.polygon : [],
    pointCount: Number(zone.pointCount ?? (Array.isArray(zone.polygon) ? zone.polygon.length : 0)),
    vertices: Array.isArray(zone.vertices) ? zone.vertices : [],
    metadata: zone.metadata || {},
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
};

const normalizeZonePayload = async (payload = {}, existingZone = null) => {
  const name = normalizeString(payload.name ?? existingZone?.name);
  const zoneType = normalizeString(payload.zoneType ?? existingZone?.zoneType).toLowerCase();

  if (!name) {
    throw new ApiError(400, "Zone name is required.");
  }

  if (!VALID_ZONE_TYPES.has(zoneType)) {
    throw new ApiError(400, "Zone type must be either service or restriction.");
  }

  const verticesSource =
    payload.vertices ??
    payload.polygon ??
    payload.path ??
    payload.points ??
    existingZone?.vertices ??
    [];
  const vertices = normalizeZonePoints(verticesSource);
  const fillColor = normalizeString(payload.fillColor ?? existingZone?.fillColor);
  const strokeColor = normalizeString(payload.strokeColor ?? existingZone?.strokeColor);

  return {
    name,
    zoneType,
    description: normalizeString(payload.description ?? existingZone?.description),
    notes: normalizeString(payload.notes ?? existingZone?.notes),
    isActive: normalizeBoolean(payload.isActive, existingZone?.isActive ?? true),
    fillColor,
    strokeColor,
    opacity: normalizeOpacity(payload.opacity, existingZone?.opacity ?? 0.28),
    polygon: vertices,
    vertices,
    metadata:
      payload.metadata !== undefined
        ? payload.metadata && typeof payload.metadata === "object"
          ? payload.metadata
          : {}
        : existingZone?.metadata || {},
  };
};

const assertUniqueZone = async (normalizedPayload, ignoreZoneId = null) => {
  const duplicateName = await findShippingZoneByName(
    normalizedPayload.name,
    ignoreZoneId,
  );

  if (duplicateName) {
    throw new ApiError(409, "A shipping zone with this name already exists.");
  }

  const duplicatePolygon = await findDuplicateShippingZone(
    normalizedPayload.zoneType,
    normalizedPayload.polygon,
    ignoreZoneId,
  );

  if (duplicatePolygon) {
    throw new ApiError(409, "A matching shipping zone already exists.");
  }
};

const listShippingZones = async (query = {}) => {
  const zones = await listShippingZoneRecords(query);
  return zones.map(serializeZone);
};

const listPublicShippingZones = async (query = {}) => {
  const zones = await listShippingZones(query);
  return zones.filter((zone) => zone.isActive);
};

const createShippingZone = async (payload = {}) => {
  const normalizedPayload = await normalizeZonePayload(payload);
  await assertUniqueZone(normalizedPayload);

  const zone = await createShippingZoneRecord({
    ...normalizedPayload,
    metadata: normalizedPayload.metadata || {},
    createdAt: new Date(),
  });

  return serializeZone(zone);
};

const updateShippingZone = async (zoneId, payload = {}) => {
  const currentZone = await findShippingZoneById(zoneId);

  if (!currentZone) {
    throw new ApiError(404, "Shipping zone not found.");
  }

  const normalizedPayload = await normalizeZonePayload(payload, currentZone);
  await assertUniqueZone(normalizedPayload, zoneId);

  const nextZone = await updateShippingZoneRecord(zoneId, normalizedPayload);
  return serializeZone(nextZone);
};

const deleteShippingZone = async (zoneId) => {
  const deletedZone = await deleteShippingZoneRecord(zoneId);

  if (!deletedZone) {
    throw new ApiError(404, "Shipping zone not found.");
  }

  return deletedZone;
};

module.exports = {
  createShippingZone,
  deleteShippingZone,
  listShippingZones,
  listPublicShippingZones,
  serializeZone,
  updateShippingZone,
};
