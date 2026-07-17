const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapProfileRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 100),
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

const mapSlabRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    profileId: row.profile_id,
    profileCode: row.profile_code || "",
    profileName: row.profile_name || "",
    ruleKey: row.rule_key,
    name: row.name,
    description: row.description || "",
    notes: row.notes || "",
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 100),
    calculationMode: row.calculation_mode,
    rate: Number(row.rate ?? 0),
    weightUnitKg: Number(row.weight_unit_kg ?? 20),
    minWeightKg:
      row.min_weight_kg === null || row.min_weight_kg === undefined
        ? null
        : Number(row.min_weight_kg),
    minWeightInclusive: Boolean(row.min_weight_inclusive),
    maxWeightKg:
      row.max_weight_kg === null || row.max_weight_kg === undefined
        ? null
        : Number(row.max_weight_kg),
    maxWeightInclusive: Boolean(row.max_weight_inclusive),
    minDistanceKm:
      row.min_distance_km === null || row.min_distance_km === undefined
        ? null
        : Number(row.min_distance_km),
    minDistanceInclusive: Boolean(row.min_distance_inclusive),
    maxDistanceKm:
      row.max_distance_km === null || row.max_distance_km === undefined
        ? null
        : Number(row.max_distance_km),
    maxDistanceInclusive: Boolean(row.max_distance_inclusive),
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

const parseBooleanQueryValue = (value) => {
  if (value === true || value === false) {
    return value;
  }

  const normalizedValue = String(value || "").trim().toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes";
};

const PROFILE_SELECT_SQL = `
  SELECT
    id,
    code,
    name,
    description,
    is_active,
    sort_order,
    metadata,
    created_at,
    updated_at
  FROM delivery_charge_profiles
`;

const SLAB_SELECT_SQL = `
  SELECT
    slab.id,
    slab.profile_id,
    profile.code AS profile_code,
    profile.name AS profile_name,
    slab.rule_key,
    slab.name,
    slab.description,
    slab.notes,
    slab.is_active,
    slab.sort_order,
    slab.calculation_mode,
    slab.rate,
    slab.weight_unit_kg,
    slab.min_weight_kg,
    slab.min_weight_inclusive,
    slab.max_weight_kg,
    slab.max_weight_inclusive,
    slab.min_distance_km,
    slab.min_distance_inclusive,
    slab.max_distance_km,
    slab.max_distance_inclusive,
    slab.metadata,
    slab.created_at,
    slab.updated_at
  FROM delivery_charge_slabs slab
  INNER JOIN delivery_charge_profiles profile
    ON profile.id = slab.profile_id
`;

const listDeliveryChargeProfiles = async ({ query: search = "" } = {}) => {
  const values = [];
  const where = [];
  const normalizedSearch = String(search || "").trim();

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    where.push(`(
      code ILIKE $${values.length}
      OR name ILIKE $${values.length}
      OR description ILIKE $${values.length}
    )`);
  }

  const result = await query(
    `${PROFILE_SELECT_SQL}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY sort_order ASC, created_at ASC`,
    values,
  );

  return result.rows.map(mapProfileRow).filter(Boolean);
};

const findDeliveryChargeProfileById = async (profileId) => {
  const result = await query(
    `${PROFILE_SELECT_SQL}
     WHERE id = $1
     LIMIT 1`,
    [profileId],
  );

  return mapProfileRow(result.rows[0]);
};

const findDeliveryChargeProfileByCode = async (code) => {
  const result = await query(
    `${PROFILE_SELECT_SQL}
     WHERE code = $1
     LIMIT 1`,
    [code],
  );

  return mapProfileRow(result.rows[0]);
};

const upsertDeliveryChargeProfile = async (profileData) => {
  const id = profileData.id || generateId();
  const result = await query(
    `INSERT INTO delivery_charge_profiles (
      id,
      code,
      name,
      description,
      is_active,
      sort_order,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      metadata = EXCLUDED.metadata,
      updated_at = EXCLUDED.updated_at
    RETURNING id`,
    [
      id,
      profileData.code,
      profileData.name,
      profileData.description || "",
      profileData.isActive !== undefined ? profileData.isActive : true,
      profileData.sortOrder ?? 100,
      JSON.stringify(profileData.metadata || {}),
      profileData.createdAt || new Date(),
      profileData.updatedAt || new Date(),
    ],
  );

  return findDeliveryChargeProfileById(result.rows[0]?.id || id);
};

const updateDeliveryChargeProfile = async (profileId, updates) => {
  const statement = buildUpdateStatement(
    {
      name: updates.name,
      description: updates.description,
      isActive: updates.isActive,
      sortOrder: updates.sortOrder,
      metadata:
        updates.metadata === undefined ? undefined : JSON.stringify(updates.metadata || {}),
      updatedAt: new Date(),
    },
    {
      isActive: "is_active",
      sortOrder: "sort_order",
      metadata: { column: "metadata", cast: "jsonb" },
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findDeliveryChargeProfileById(profileId);
  }

  await query(
    `UPDATE delivery_charge_profiles
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, profileId],
  );

  return findDeliveryChargeProfileById(profileId);
};

const listDeliveryChargeSlabs = async ({
  query: search = "",
  profileCode = "",
  profileId = "",
  includeInactive = false,
} = {}) => {
  const values = [];
  const where = [];
  const normalizedSearch = String(search || "").trim();
  const normalizedProfileCode = String(profileCode || "").trim();
  const normalizedProfileId = String(profileId || "").trim();

  if (normalizedProfileCode) {
    values.push(normalizedProfileCode);
    where.push(`profile.code = $${values.length}`);
  }

  if (normalizedProfileId) {
    values.push(normalizedProfileId);
    where.push(`slab.profile_id = $${values.length}`);
  }

  if (!parseBooleanQueryValue(includeInactive)) {
    where.push("slab.is_active = TRUE");
  }

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    where.push(`(
      slab.rule_key ILIKE $${values.length}
      OR slab.name ILIKE $${values.length}
      OR slab.description ILIKE $${values.length}
      OR slab.notes ILIKE $${values.length}
    )`);
  }

  const result = await query(
    `${SLAB_SELECT_SQL}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY slab.sort_order ASC, slab.created_at ASC`,
    values,
  );

  return result.rows.map(mapSlabRow).filter(Boolean);
};

const findDeliveryChargeSlabById = async (slabId) => {
  const result = await query(
    `${SLAB_SELECT_SQL}
     WHERE slab.id = $1
     LIMIT 1`,
    [slabId],
  );

  return mapSlabRow(result.rows[0]);
};

const findDeliveryChargeSlabByRuleKey = async (profileId, ruleKey) => {
  const result = await query(
    `${SLAB_SELECT_SQL}
     WHERE slab.profile_id = $1
       AND slab.rule_key = $2
     LIMIT 1`,
    [profileId, ruleKey],
  );

  return mapSlabRow(result.rows[0]);
};

const createDeliveryChargeSlab = async (slabData) => {
  const id = generateId();
  const result = await query(
    `INSERT INTO delivery_charge_slabs (
      id,
      profile_id,
      rule_key,
      name,
      description,
      notes,
      is_active,
      sort_order,
      calculation_mode,
      rate,
      weight_unit_kg,
      min_weight_kg,
      min_weight_inclusive,
      max_weight_kg,
      max_weight_inclusive,
      min_distance_km,
      min_distance_inclusive,
      max_distance_km,
      max_distance_inclusive,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21, $22
    )
    RETURNING id`,
    [
      id,
      slabData.profileId,
      slabData.ruleKey,
      slabData.name,
      slabData.description || "",
      slabData.notes || "",
      slabData.isActive !== undefined ? slabData.isActive : true,
      slabData.sortOrder ?? 100,
      slabData.calculationMode,
      slabData.rate,
      slabData.weightUnitKg ?? 20,
      slabData.minWeightKg,
      slabData.minWeightInclusive,
      slabData.maxWeightKg,
      slabData.maxWeightInclusive,
      slabData.minDistanceKm,
      slabData.minDistanceInclusive,
      slabData.maxDistanceKm,
      slabData.maxDistanceInclusive,
      JSON.stringify(slabData.metadata || {}),
      slabData.createdAt || new Date(),
      slabData.updatedAt || new Date(),
    ],
  );

  return findDeliveryChargeSlabById(result.rows[0]?.id || id);
};

const updateDeliveryChargeSlab = async (slabId, updates) => {
  const statement = buildUpdateStatement(
    {
      profileId: updates.profileId,
      ruleKey: updates.ruleKey,
      name: updates.name,
      description: updates.description,
      notes: updates.notes,
      isActive: updates.isActive,
      sortOrder: updates.sortOrder,
      calculationMode: updates.calculationMode,
      rate: updates.rate,
      weightUnitKg: updates.weightUnitKg,
      minWeightKg: updates.minWeightKg,
      minWeightInclusive: updates.minWeightInclusive,
      maxWeightKg: updates.maxWeightKg,
      maxWeightInclusive: updates.maxWeightInclusive,
      minDistanceKm: updates.minDistanceKm,
      minDistanceInclusive: updates.minDistanceInclusive,
      maxDistanceKm: updates.maxDistanceKm,
      maxDistanceInclusive: updates.maxDistanceInclusive,
      metadata:
        updates.metadata === undefined ? undefined : JSON.stringify(updates.metadata || {}),
      updatedAt: new Date(),
    },
    {
      profileId: "profile_id",
      ruleKey: "rule_key",
      isActive: "is_active",
      sortOrder: "sort_order",
      calculationMode: "calculation_mode",
      weightUnitKg: "weight_unit_kg",
      minWeightKg: "min_weight_kg",
      minWeightInclusive: "min_weight_inclusive",
      maxWeightKg: "max_weight_kg",
      maxWeightInclusive: "max_weight_inclusive",
      minDistanceKm: "min_distance_km",
      minDistanceInclusive: "min_distance_inclusive",
      maxDistanceKm: "max_distance_km",
      maxDistanceInclusive: "max_distance_inclusive",
      metadata: { column: "metadata", cast: "jsonb" },
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findDeliveryChargeSlabById(slabId);
  }

  await query(
    `UPDATE delivery_charge_slabs
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, slabId],
  );

  return findDeliveryChargeSlabById(slabId);
};

const deleteDeliveryChargeSlab = async (slabId) => {
  const result = await query(
    `DELETE FROM delivery_charge_slabs
     WHERE id = $1
     RETURNING id`,
    [slabId],
  );

  return result.rows.length ? { id: result.rows[0].id } : null;
};

module.exports = {
  createDeliveryChargeSlab,
  deleteDeliveryChargeSlab,
  findDeliveryChargeProfileByCode,
  findDeliveryChargeProfileById,
  findDeliveryChargeSlabById,
  findDeliveryChargeSlabByRuleKey,
  listDeliveryChargeProfiles,
  listDeliveryChargeSlabs,
  mapProfileRow,
  mapSlabRow,
  upsertDeliveryChargeProfile,
  updateDeliveryChargeProfile,
  updateDeliveryChargeSlab,
};
