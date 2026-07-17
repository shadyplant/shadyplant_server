const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapCountryRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    iso2: row.iso2,
    iso3: row.iso3,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const mapStateRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    countryId: row.country_id,
    code: row.code,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const mapRegionRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    stateId: row.state_id,
    countryId: row.country_id || null,
    countryCode: row.country_code || "",
    countryName: row.country_name || "",
    stateCode: row.state_code || "",
    stateName: row.state_name || "",
    defaultService: Boolean(row.default_service),
    isActive: Boolean(row.is_active),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const mapRuleRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    shippingRegionId: row.shipping_region_id,
    countryId: row.country_id || null,
    countryCode: row.country_code || "",
    countryName: row.country_name || "",
    stateId: row.state_id || null,
    stateCode: row.state_code || "",
    stateName: row.state_name || "",
    action: row.action,
    ruleType: row.rule_type,
    pin: row.pin || "",
    startPin: row.start_pin || "",
    endPin: row.end_pin || "",
    reason: row.reason || "",
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const COUNTRY_SELECT_SQL = `
  SELECT
    id,
    iso2,
    iso3,
    name,
    is_active,
    created_at,
    updated_at
  FROM countries
`;

const STATE_SELECT_SQL = `
  SELECT
    id,
    country_id,
    code,
    name,
    is_active,
    created_at,
    updated_at
  FROM states
`;

const REGION_SELECT_SQL = `
  SELECT
    region.id,
    region.state_id,
    region.default_service,
    region.is_active,
    region.created_at,
    region.updated_at,
    state.id AS country_id,
    country.iso2 AS country_code,
    country.name AS country_name,
    state.code AS state_code,
    state.name AS state_name
  FROM shipping_regions region
  JOIN states state ON state.id = region.state_id
  JOIN countries country ON country.id = state.country_id
`;

const RULE_SELECT_SQL = `
  SELECT
    rule.id,
    rule.shipping_region_id,
    rule.action,
    rule.rule_type,
    rule.pin,
    rule.start_pin,
    rule.end_pin,
    rule.reason,
    rule.created_at,
    rule.updated_at,
    region.state_id,
    state.country_id,
    state.code AS state_code,
    state.name AS state_name,
    country.iso2 AS country_code,
    country.name AS country_name
  FROM shipping_rules rule
  JOIN shipping_regions region ON region.id = rule.shipping_region_id
  JOIN states state ON state.id = region.state_id
  JOIN countries country ON country.id = state.country_id
`;

const listCountries = async () => {
  const result = await query(`${COUNTRY_SELECT_SQL} ORDER BY name ASC`);
  return result.rows.map(mapCountryRow).filter(Boolean);
};

const createCountry = async (countryData) => {
  const id = generateId();
  const result = await query(
    `INSERT INTO countries (
      id,
      iso2,
      iso3,
      name,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $6
    )
    RETURNING id`,
    [
      id,
      countryData.iso2,
      countryData.iso3,
      countryData.name,
      countryData.isActive,
      countryData.createdAt,
    ],
  );

  return findCountryById(result.rows[0]?.id || id);
};

const findCountryById = async (countryId) => {
  const result = await query(
    `${COUNTRY_SELECT_SQL}
     WHERE id = $1
     LIMIT 1`,
    [countryId],
  );

  return mapCountryRow(result.rows[0]);
};

const updateCountry = async (countryId, updates) => {
  const statement = buildUpdateStatement(
    {
      iso2: updates.iso2,
      iso3: updates.iso3,
      name: updates.name,
      isActive: updates.isActive,
      updatedAt: new Date(),
    },
    {
      isActive: "is_active",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findCountryById(countryId);
  }

  await query(
    `UPDATE countries
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, countryId],
  );

  return findCountryById(countryId);
};

const deleteCountry = async (countryId) => {
  const result = await query(
    `DELETE FROM countries
     WHERE id = $1
     RETURNING id`,
    [countryId],
  );

  return result.rows.length ? { id: result.rows[0].id } : null;
};

const findCountryByCode = async (code) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const result = await query(
    `${COUNTRY_SELECT_SQL}
     WHERE UPPER(iso2) = $1 OR UPPER(iso3) = $1
     LIMIT 1`,
    [normalizedCode],
  );

  return mapCountryRow(result.rows[0]);
};

const findStateByCode = async (countryId, code) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!countryId || !normalizedCode) {
    return null;
  }

  const result = await query(
    `${STATE_SELECT_SQL}
     WHERE country_id = $1
       AND (UPPER(code) = $2 OR UPPER(name) = $2)
     LIMIT 1`,
    [countryId, normalizedCode],
  );

  return mapStateRow(result.rows[0]);
};

const listStatesByCountryId = async (countryId) => {
  const result = await query(
    `${STATE_SELECT_SQL}
     WHERE country_id = $1
     ORDER BY name ASC`,
    [countryId],
  );

  return result.rows.map(mapStateRow).filter(Boolean);
};

const listStates = async ({ countryCode } = {}) => {
  if (!countryCode) {
    const result = await query(
      `${STATE_SELECT_SQL}
       ORDER BY name ASC`,
    );

    return result.rows.map(mapStateRow).filter(Boolean);
  }

  const country = await findCountryByCode(countryCode);
  if (!country) {
    return [];
  }

  return listStatesByCountryId(country.id);
};

const findStateById = async (stateId) => {
  const result = await query(
    `${STATE_SELECT_SQL}
     WHERE id = $1
     LIMIT 1`,
    [stateId],
  );

  return mapStateRow(result.rows[0]);
};

const createState = async (stateData) => {
  const id = generateId();
  await query(
    `INSERT INTO states (
      id,
      country_id,
      code,
      name,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $6
    )`,
    [
      id,
      stateData.countryId,
      stateData.code,
      stateData.name,
      stateData.isActive,
      stateData.createdAt,
    ],
  );

  return findStateById(id);
};

const createShippingRegion = async (regionData) => {
  const id = generateId();
  await query(
    `INSERT INTO shipping_regions (
      id,
      state_id,
      default_service,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $5
    )`,
    [
      id,
      regionData.stateId,
      regionData.defaultService,
      regionData.isActive,
      regionData.createdAt,
    ],
  );

  return findShippingRegionById(id);
};

const updateState = async (stateId, updates) => {
  const statement = buildUpdateStatement(
    {
      countryId: updates.countryId,
      code: updates.code,
      name: updates.name,
      isActive: updates.isActive,
      updatedAt: new Date(),
    },
    {
      countryId: "country_id",
      isActive: "is_active",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findStateById(stateId);
  }

  await query(
    `UPDATE states
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, stateId],
  );

  return findStateById(stateId);
};

const deleteState = async (stateId) => {
  const result = await query(
    `DELETE FROM states
     WHERE id = $1
     RETURNING id`,
    [stateId],
  );

  return result.rows.length ? { id: result.rows[0].id } : null;
};

const findShippingRegionById = async (regionId) => {
  const result = await query(
    `${REGION_SELECT_SQL}
     WHERE region.id = $1
     LIMIT 1`,
    [regionId],
  );

  return mapRegionRow(result.rows[0]);
};

const findShippingRegionByStateId = async (stateId) => {
  const result = await query(
    `${REGION_SELECT_SQL}
     WHERE region.state_id = $1
     LIMIT 1`,
    [stateId],
  );

  return mapRegionRow(result.rows[0]);
};

const listShippingRegions = async ({ countryCode, stateCode, isActive } = {}) => {
  const values = [];
  const where = [];

  if (countryCode) {
    values.push(String(countryCode).trim().toUpperCase());
    where.push(`(UPPER(country.iso2) = $${values.length} OR UPPER(country.iso3) = $${values.length})`);
  }

  if (stateCode) {
    values.push(String(stateCode).trim().toUpperCase());
    where.push(`UPPER(state.code) = $${values.length}`);
  }

  if (isActive !== undefined) {
    values.push(Boolean(isActive));
    where.push(`region.is_active = $${values.length}`);
  }

  const result = await query(
    `${REGION_SELECT_SQL}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY country.name ASC, state.name ASC`,
    values,
  );

  return result.rows.map(mapRegionRow).filter(Boolean);
};

const updateShippingRegion = async (regionId, updates) => {
  const statement = buildUpdateStatement(
    {
      defaultService: updates.defaultService,
      isActive: updates.isActive,
      updatedAt: new Date(),
    },
    {
      defaultService: "default_service",
      isActive: "is_active",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findShippingRegionById(regionId);
  }

  await query(
    `UPDATE shipping_regions
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, regionId],
  );

  return findShippingRegionById(regionId);
};

const listShippingRules = async ({ countryCode, stateCode, regionId } = {}) => {
  const values = [];
  const where = [];

  if (regionId) {
    values.push(regionId);
    where.push(`rule.shipping_region_id = $${values.length}`);
  }

  if (countryCode) {
    values.push(String(countryCode).trim().toUpperCase());
    where.push(`(UPPER(country.iso2) = $${values.length} OR UPPER(country.iso3) = $${values.length})`);
  }

  if (stateCode) {
    values.push(String(stateCode).trim().toUpperCase());
    where.push(`UPPER(state.code) = $${values.length}`);
  }

  const result = await query(
    `${RULE_SELECT_SQL}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY country.name ASC, state.name ASC, rule.created_at DESC`,
    values,
  );

  return result.rows.map(mapRuleRow).filter(Boolean);
};

const listShippingRulesByRegionId = async (regionId) => {
  const result = await query(
    `${RULE_SELECT_SQL}
     WHERE rule.shipping_region_id = $1
     ORDER BY rule.created_at ASC`,
    [regionId],
  );

  return result.rows.map(mapRuleRow).filter(Boolean);
};

const findShippingRuleById = async (ruleId) => {
  const result = await query(
    `${RULE_SELECT_SQL}
     WHERE rule.id = $1
     LIMIT 1`,
    [ruleId],
  );

  return mapRuleRow(result.rows[0]);
};

const createShippingRule = async (ruleData) => {
  const id = generateId();
  await query(
    `INSERT INTO shipping_rules (
      id,
      shipping_region_id,
      action,
      rule_type,
      pin,
      start_pin,
      end_pin,
      reason,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
    )`,
    [
      id,
      ruleData.shippingRegionId,
      ruleData.action,
      ruleData.ruleType,
      ruleData.pin || null,
      ruleData.startPin || null,
      ruleData.endPin || null,
      ruleData.reason || "",
      ruleData.createdAt,
    ],
  );

  return findShippingRuleById(id);
};

const updateShippingRule = async (ruleId, updates) => {
  const statement = buildUpdateStatement(
    {
      shippingRegionId: updates.shippingRegionId,
      action: updates.action,
      ruleType: updates.ruleType,
      pin: updates.pin ?? null,
      startPin: updates.startPin ?? null,
      endPin: updates.endPin ?? null,
      reason: updates.reason,
      updatedAt: new Date(),
    },
    {
      shippingRegionId: "shipping_region_id",
      ruleType: "rule_type",
      startPin: "start_pin",
      endPin: "end_pin",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findShippingRuleById(ruleId);
  }

  await query(
    `UPDATE shipping_rules
     SET ${statement.setClause}
     WHERE id = $${statement.values.length + 1}`,
    [...statement.values, ruleId],
  );

  return findShippingRuleById(ruleId);
};

const deleteShippingRule = async (ruleId) => {
  const result = await query(
    `DELETE FROM shipping_rules
     WHERE id = $1
     RETURNING id`,
    [ruleId],
  );

  return result.rows.length ? { id: result.rows[0].id } : null;
};

module.exports = {
  createCountry,
  createState,
  createShippingRegion,
  createShippingRule,
  deleteShippingRule,
  deleteCountry,
  deleteState,
  findCountryByCode,
  findCountryById,
  findShippingRegionById,
  findShippingRegionByStateId,
  findShippingRuleById,
  findStateByCode,
  findStateById,
  listCountries,
  listStates,
  listShippingRegions,
  listShippingRules,
  listShippingRulesByRegionId,
  listStatesByCountryId,
  mapCountryRow,
  mapRegionRow,
  mapRuleRow,
  mapStateRow,
  updateCountry,
  updateShippingRegion,
  updateState,
  updateShippingRule,
};
