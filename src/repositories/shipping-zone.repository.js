const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapZoneRow = (row) => {
  if (!row) {
    return null;
  }

  const polygon = Array.isArray(row.polygon)
    ? row.polygon
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    : [];

  const vertices = Array.isArray(row.vertices)
    ? row.vertices
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    : polygon;

  return {
    id: row.id,
    name: row.name,
    zoneType: row.zone_type,
    description: row.description || "",
    notes: row.notes || "",
    isActive: Boolean(row.is_active),
    fillColor: row.fill_color || "",
    strokeColor: row.stroke_color || "",
    opacity: Number(row.opacity ?? 0.28),
    polygon,
    pointCount: polygon.length,
    vertices,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const SHIP_ZONES_SELECT_SQL = `
  SELECT
    id,
    name,
    zone_type,
    description,
    notes,
    is_active,
    fill_color,
    stroke_color,
    opacity,
    polygon,
    vertices,
    metadata,
    created_at,
    updated_at
  FROM shipping_zones
`;

const listShippingZones = async ({ query: search = "" } = {}) => {
  const normalizedSearch = String(search || "").trim();
  const values = [];
  const where = [];

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    where.push(`(
      name ILIKE $${values.length}
      OR description ILIKE $${values.length}
      OR notes ILIKE $${values.length}
    )`);
  }

  const result = await query(
    `${SHIP_ZONES_SELECT_SQL}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC`,
    values,
  );

  return result.rows.map(mapZoneRow).filter(Boolean);
};

const findShippingZoneById = async (zoneId) => {
  const result = await query(
    `${SHIP_ZONES_SELECT_SQL}
     WHERE id = $1
     LIMIT 1`,
    [zoneId],
  );

  return mapZoneRow(result.rows[0]);
};

const findShippingZoneByName = async (name, ignoreZoneId = null) => {
  const values = [name];
  let sql = `${SHIP_ZONES_SELECT_SQL}
    WHERE LOWER(name) = LOWER($1)`;

  if (ignoreZoneId) {
    values.push(ignoreZoneId);
    sql += ` AND id <> $2`;
  }

  sql += " LIMIT 1";

  const result = await query(sql, values);
  return mapZoneRow(result.rows[0]);
};

const findDuplicateShippingZone = async (zoneType, polygon, ignoreZoneId = null) => {
  const values = [zoneType, JSON.stringify(polygon)];
  let sql = `${SHIP_ZONES_SELECT_SQL}
    WHERE zone_type = $1
      AND polygon = $2::jsonb`;

  if (ignoreZoneId) {
    values.push(ignoreZoneId);
    sql += ` AND id <> $3`;
  }

  sql += " LIMIT 1";

  const result = await query(sql, values);
  return mapZoneRow(result.rows[0]);
};

const createShippingZone = async (zoneData) => {
  const id = generateId();
  const result = await query(
    `INSERT INTO shipping_zones (
      id,
      name,
      zone_type,
      description,
      notes,
      is_active,
      fill_color,
      stroke_color,
      opacity,
      polygon,
      vertices,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $13
    )
    RETURNING id`,
    [
      id,
      zoneData.name,
      zoneData.zoneType,
      zoneData.description,
      zoneData.notes,
      zoneData.isActive,
      zoneData.fillColor,
      zoneData.strokeColor,
      zoneData.opacity,
      JSON.stringify(zoneData.polygon),
      JSON.stringify(zoneData.vertices),
      JSON.stringify(zoneData.metadata || {}),
      zoneData.createdAt,
    ],
  );

  return findShippingZoneById(result.rows[0]?.id || id);
};

const updateShippingZone = async (zoneId, updates) => {
  const statement = buildUpdateStatement(
    {
      name: updates.name,
      zoneType: updates.zoneType,
      description: updates.description,
      notes: updates.notes,
      isActive: updates.isActive,
      fillColor: updates.fillColor,
      strokeColor: updates.strokeColor,
      opacity: updates.opacity,
      polygon: JSON.stringify(updates.polygon),
      vertices: JSON.stringify(updates.vertices),
      metadata: JSON.stringify(updates.metadata || {}),
      updatedAt: new Date(),
    },
    {
      zoneType: "zone_type",
      isActive: "is_active",
      fillColor: "fill_color",
      strokeColor: "stroke_color",
      updatedAt: "updated_at",
      polygon: { column: "polygon", cast: "jsonb" },
      vertices: { column: "vertices", cast: "jsonb" },
      metadata: { column: "metadata", cast: "jsonb" },
    },
  );

  if (!statement) {
    return findShippingZoneById(zoneId);
  }

  await query(
    `UPDATE shipping_zones
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, zoneId],
  );

  return findShippingZoneById(zoneId);
};

const deleteShippingZone = async (zoneId) => {
  const result = await query(
    `DELETE FROM shipping_zones
     WHERE id = $1
     RETURNING id`,
    [zoneId],
  );

  return result.rows.length ? { id: result.rows[0].id } : null;
};

module.exports = {
  createShippingZone,
  deleteShippingZone,
  findDuplicateShippingZone,
  findShippingZoneById,
  findShippingZoneByName,
  listShippingZones,
  mapZoneRow,
  updateShippingZone,
};
