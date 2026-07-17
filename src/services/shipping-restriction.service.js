const { ApiError } = require("../utils/apiError");
const {
  createCountry: createCountryRecord,
  createState: createStateRecord,
  createShippingRegion: createShippingRegionRecord,
  createShippingRule: createShippingRuleRecord,
  deleteCountry: deleteCountryRecord,
  deleteState: deleteStateRecord,
  deleteShippingRule: deleteShippingRuleRecord,
  findCountryByCode,
  findCountryById,
  findShippingRegionById,
  findShippingRegionByStateId,
  findShippingRuleById,
  findStateByCode,
  findStateById,
  listCountries,
  listShippingRegions,
  listShippingRules,
  listShippingRulesByRegionId,
  listStatesByCountryId,
  listStates,
  updateCountry: updateCountryRecord,
  updateShippingRegion: updateShippingRegionRecord,
  updateState: updateStateRecord,
  updateShippingRule: updateShippingRuleRecord,
} = require("../repositories/shipping-restriction.repository");

const VALID_ACTIONS = new Set(["ALLOW", "BLOCK"]);
const VALID_RULE_TYPES = new Set([
  "PIN",
  "PIN_RANGE",
  "CITY",
  "DISTRICT",
  "POLYGON",
  "LATLNG",
]);
const SUPPORTED_PIN_RULE_TYPES = new Set(["PIN", "PIN_RANGE"]);
const PIN_PATTERN = /^[A-Z0-9]{3,12}$/;
const NUMERIC_PIN_PATTERN = /^\d{3,12}$/;

const normalizeText = (value) => String(value || "").trim();

const normalizeUpperCode = (value) => normalizeText(value).toUpperCase();

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return Boolean(value);
};

const parseBooleanLike = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return Boolean(value);
};

const normalizeAction = (value) => {
  const action = normalizeUpperCode(value);

  if (!VALID_ACTIONS.has(action)) {
    throw new ApiError(400, "Action must be ALLOW or BLOCK.");
  }

  return action;
};

const normalizeRuleType = (value) => {
  const ruleType = normalizeUpperCode(value);

  if (!VALID_RULE_TYPES.has(ruleType)) {
    throw new ApiError(400, "Rule type is invalid.");
  }

  return ruleType;
};

const normalizeCountryCode = (value) => {
  const code = normalizeUpperCode(value);

  if (!code || code.length < 2 || code.length > 3) {
    throw new ApiError(400, "Country code is invalid.");
  }

  return code;
};

const normalizeIso3Code = (value) => {
  const code = normalizeUpperCode(value);

  if (!code || code.length !== 3) {
    throw new ApiError(400, "ISO3 code is invalid.");
  }

  return code;
};

const normalizeStateCode = (value) => {
  const code = normalizeUpperCode(value);

  if (!code) {
    throw new ApiError(400, "State code is required.");
  }

  return code;
};

const normalizePinCode = (value) => {
  const pin = normalizeUpperCode(value).replace(/\s+/g, "");

  if (!pin) {
    return "";
  }

  if (!PIN_PATTERN.test(pin)) {
    throw new ApiError(400, "PIN must be 3 to 12 alphanumeric characters.");
  }

  return pin;
};

const normalizeNumericPin = (value, label) => {
  const pin = normalizeText(value).replace(/\s+/g, "");

  if (!NUMERIC_PIN_PATTERN.test(pin)) {
    throw new ApiError(400, `${label} must be 3 to 12 numeric digits.`);
  }

  return pin;
};

const compareNumericPins = (leftPin, rightPin) => {
  if (leftPin.length !== rightPin.length) {
    throw new ApiError(
      400,
      "PIN range start and end must use the same number of digits.",
    );
  }

  if (leftPin > rightPin) {
    throw new ApiError(400, "PIN range start cannot be greater than end.");
  }
};

const pinMatchesRange = (pin, startPin, endPin) => {
  if (pin.length !== startPin.length || pin.length !== endPin.length) {
    return false;
  }

  return pin >= startPin && pin <= endPin;
};

const serializeRule = (rule) => {
  if (!rule) {
    return null;
  }

  return {
    id: rule.id,
    shippingRegionId: rule.shippingRegionId,
    countryId: rule.countryId || null,
    countryCode: rule.countryCode || "",
    countryName: rule.countryName || "",
    stateId: rule.stateId || null,
    stateCode: rule.stateCode || "",
    stateName: rule.stateName || "",
    action: rule.action,
    ruleType: rule.ruleType,
    pin: rule.pin || "",
    startPin: rule.startPin || "",
    endPin: rule.endPin || "",
    reason: rule.reason || "",
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
};

const serializeRegion = (region) => {
  if (!region) {
    return null;
  }

  return {
    id: region.id,
    stateId: region.stateId,
    countryId: region.countryId || null,
    countryCode: region.countryCode || "",
    countryName: region.countryName || "",
    stateCode: region.stateCode || "",
    stateName: region.stateName || "",
    defaultService: Boolean(region.defaultService),
    isActive: Boolean(region.isActive),
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  };
};

const serializeCountry = (country) => {
  if (!country) {
    return null;
  }

  return {
    id: country.id,
    iso2: country.iso2,
    iso3: country.iso3,
    name: country.name,
    isActive: Boolean(country.isActive),
    createdAt: country.createdAt,
    updatedAt: country.updatedAt,
  };
};

const serializeState = (state) => {
  if (!state) {
    return null;
  }

  return {
    id: state.id,
    countryId: state.countryId,
    code: state.code,
    name: state.name,
    isActive: Boolean(state.isActive),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
};

const resolveShippingRegion = async (payload = {}, existingRegion = null) => {
  if (payload.shippingRegionId) {
    const region = await findShippingRegionById(payload.shippingRegionId);
    if (!region) {
      throw new ApiError(404, "Shipping region not found.");
    }

    return region;
  }

  const countryCode = normalizeCountryCode(
    payload.countryCode ?? existingRegion?.countryCode,
  );
  const stateCode = normalizeStateCode(
    payload.stateCode ?? existingRegion?.stateCode,
  );

  const country = await findCountryByCode(countryCode);
  if (!country) {
    throw new ApiError(404, "Country not found.");
  }

  const state = await findStateByCode(country.id, stateCode);
  if (!state) {
    throw new ApiError(404, "State not found.");
  }

  const region = await findShippingRegionByStateId(state.id);
  if (!region) {
    throw new ApiError(404, "Shipping region not found.");
  }

  return region;
};

const normalizeRulePayload = async (payload = {}, existingRule = null) => {
  const action = normalizeAction(payload.action ?? existingRule?.action);
  const ruleType = normalizeRuleType(payload.ruleType ?? existingRule?.ruleType);
  const shippingRegion = await resolveShippingRegion(payload, existingRule);
  const reason = normalizeText(payload.reason ?? existingRule?.reason);

  if (SUPPORTED_PIN_RULE_TYPES.has(ruleType)) {
    if (ruleType === "PIN") {
      return {
        shippingRegionId: shippingRegion.id,
        action,
        ruleType,
        pin: normalizePinCode(payload.pin ?? existingRule?.pin),
        startPin: null,
        endPin: null,
        reason,
      };
    }

    const startPin = normalizeNumericPin(
      payload.startPin ?? existingRule?.startPin,
      "PIN range start",
    );
    const endPin = normalizeNumericPin(
      payload.endPin ?? existingRule?.endPin,
      "PIN range end",
    );
    compareNumericPins(startPin, endPin);

    return {
      shippingRegionId: shippingRegion.id,
      action,
      ruleType,
      pin: null,
      startPin,
      endPin,
      reason,
    };
  }

  return {
    shippingRegionId: shippingRegion.id,
    action,
    ruleType,
    pin: null,
    startPin: null,
    endPin: null,
    reason,
  };
};

const assertNoDuplicateRule = async (normalizedPayload, ignoreRuleId = null) => {
  if (!SUPPORTED_PIN_RULE_TYPES.has(normalizedPayload.ruleType)) {
    return;
  }

  const allRules = await listShippingRulesByRegionId(normalizedPayload.shippingRegionId);

  if (normalizedPayload.ruleType === "PIN") {
    const duplicatePin = allRules.find(
      (rule) =>
        rule.ruleType === "PIN" &&
        rule.pin === normalizedPayload.pin &&
        rule.id !== ignoreRuleId,
    );

    if (duplicatePin) {
      throw new ApiError(409, "A matching PIN rule already exists.");
    }

    const overlappingRange = allRules.find(
      (rule) =>
        rule.ruleType === "PIN_RANGE" &&
        rule.id !== ignoreRuleId &&
        pinMatchesRange(normalizedPayload.pin, rule.startPin, rule.endPin),
    );

    if (overlappingRange) {
      throw new ApiError(409, "This PIN is already covered by an existing range rule.");
    }

    return;
  }

  if (normalizedPayload.ruleType === "PIN_RANGE") {
    const duplicateRange = allRules.find(
      (rule) =>
        rule.ruleType === "PIN_RANGE" &&
        rule.startPin === normalizedPayload.startPin &&
        rule.endPin === normalizedPayload.endPin &&
        rule.id !== ignoreRuleId,
    );

    if (duplicateRange) {
      throw new ApiError(409, "A matching PIN range rule already exists.");
    }

    const pinInsideRange = allRules.find(
      (rule) =>
        rule.ruleType === "PIN" &&
        rule.id !== ignoreRuleId &&
        pinMatchesRange(rule.pin, normalizedPayload.startPin, normalizedPayload.endPin),
    );

    if (pinInsideRange) {
      throw new ApiError(409, "This PIN range overlaps an existing PIN rule.");
    }

    const overlappingRange = allRules.find(
      (rule) =>
        rule.ruleType === "PIN_RANGE" &&
        rule.id !== ignoreRuleId &&
        !(
          rule.endPin < normalizedPayload.startPin ||
          rule.startPin > normalizedPayload.endPin
        ),
    );

    if (overlappingRange) {
      throw new ApiError(409, "This PIN range overlaps an existing range rule.");
    }
  }
};

const listShippingServiceabilityCountries = async () => {
  const countries = await listCountries();
  return countries.map(serializeCountry);
};

const listCountriesForAdmin = async () => listShippingServiceabilityCountries();

const listStatesForAdmin = async (query = {}) => {
  const states = await listStates(query);
  return states.map(serializeState);
};

const createCountry = async (payload = {}) => {
  const iso2 = normalizeCountryCode(payload.iso2);
  const iso3 = normalizeIso3Code(payload.iso3);
  const name = normalizeText(payload.name);
  const isActive = normalizeBoolean(payload.isActive, true);

  if (!name) {
    throw new ApiError(400, "Country name is required.");
  }

  const existingIso2 = await findCountryByCode(iso2);
  const existingIso3 = await findCountryByCode(iso3);

  if (existingIso2 || existingIso3) {
    throw new ApiError(409, "Country already exists.");
  }

  const country = await createCountryRecord({
    iso2,
    iso3,
    name,
    isActive,
    createdAt: new Date(),
  });

  return serializeCountry(country);
};

const updateCountry = async (countryId, payload = {}) => {
  const currentCountry = await findCountryById(countryId);

  if (!currentCountry) {
    throw new ApiError(404, "Country not found.");
  }

  const iso2 = payload.iso2 !== undefined ? normalizeCountryCode(payload.iso2) : currentCountry.iso2;
  const iso3 = payload.iso3 !== undefined ? normalizeIso3Code(payload.iso3) : currentCountry.iso3;
  const name = payload.name !== undefined ? normalizeText(payload.name) : currentCountry.name;
  const isActive =
    payload.isActive !== undefined
      ? normalizeBoolean(payload.isActive, currentCountry.isActive)
      : currentCountry.isActive;

  if (!name) {
    throw new ApiError(400, "Country name is required.");
  }

  const nextCountry = await updateCountryRecord(countryId, {
    iso2,
    iso3,
    name,
    isActive,
  });

  return serializeCountry(nextCountry);
};

const deleteCountry = async (countryId) => {
  const deletedCountry = await deleteCountryRecord(countryId);

  if (!deletedCountry) {
    throw new ApiError(404, "Country not found.");
  }

  return deletedCountry;
};

const createState = async (payload = {}) => {
  const country = await resolveCountryFromPayload(payload);
  const code = normalizeStateCode(payload.code);
  const name = normalizeText(payload.name);
  const isActive = normalizeBoolean(payload.isActive, true);

  if (!name) {
    throw new ApiError(400, "State name is required.");
  }

  const existingState = await findStateByCode(country.id, code);
  if (existingState) {
    throw new ApiError(409, "State already exists for this country.");
  }

  const state = await createStateRecord({
    countryId: country.id,
    code,
    name,
    isActive,
    createdAt: new Date(),
  });

  const nextRegion = await createShippingRegionRecord({
    stateId: state.id,
    defaultService: false,
    isActive: true,
    createdAt: new Date(),
  });

  return serializeState(state, nextRegion);

};

const updateState = async (stateId, payload = {}) => {
  const currentState = await findStateById(stateId);
  if (!currentState) {
    throw new ApiError(404, "State not found.");
  }

  const country = payload.countryCode
    ? await resolveCountryFromPayload(payload)
    : await findCountryById(currentState.countryId);

  const code = payload.code !== undefined ? normalizeStateCode(payload.code) : currentState.code;
  const name = payload.name !== undefined ? normalizeText(payload.name) : currentState.name;
  const isActive =
    payload.isActive !== undefined
      ? normalizeBoolean(payload.isActive, currentState.isActive)
      : currentState.isActive;

  if (!name) {
    throw new ApiError(400, "State name is required.");
  }

  const duplicateState = await findStateByCode(country.id, code);
  if (duplicateState && duplicateState.id !== currentState.id) {
    throw new ApiError(409, "State already exists for this country.");
  }

  const nextState = await updateStateRecord(stateId, {
    countryId: country.id,
    code,
    name,
    isActive,
  });

  return serializeState(nextState);
};

const deleteState = async (stateId) => {
  const deletedState = await deleteStateRecord(stateId);

  if (!deletedState) {
    throw new ApiError(404, "State not found.");
  }

  return deletedState;
};

const listShippingServiceabilityStates = async (countryCode) => {
  const country = await findCountryByCode(countryCode);
  if (!country) {
    throw new ApiError(404, "Country not found.");
  }

  const states = await listStatesByCountryId(country.id);
  return states.map(serializeState);
};

const resolveCountryFromPayload = async (payload = {}) => {
  if (payload.countryId) {
    const country = await findCountryById(payload.countryId);
    if (!country) {
      throw new ApiError(404, "Country not found.");
    }

    return country;
  }

  if (payload.countryCode) {
    const country = await findCountryByCode(payload.countryCode);
    if (!country) {
      throw new ApiError(404, "Country not found.");
    }

    return country;
  }

  throw new ApiError(400, "Country is required.");
};

const listShippingServiceabilityRegions = async (query = {}) => {
  const regions = await listShippingRegions({
    ...query,
    isActive: parseBooleanLike(query.isActive),
  });
  return regions.map(serializeRegion);
};

const listShippingServiceabilityRules = async (query = {}) => {
  const rules = await listShippingRules(query);
  return rules.map(serializeRule);
};

const checkShippingServiceability = async ({
  country: queryCountryCode,
  state: queryStateCode,
  countryCode,
  stateCode,
  pin,
} = {}) => {
  const normalizedCountryCode = normalizeCountryCode(
    countryCode ?? queryCountryCode,
  );
  const normalizedStateCode = normalizeStateCode(stateCode ?? queryStateCode);
  const normalizedPin = normalizePinCode(pin);

  if (!normalizedCountryCode) {
    return {
      serviceable: false,
      reason: "Country is required for serviceability check.",
      matchedRule: null,
    };
  }

  if (!normalizedStateCode) {
    return {
      serviceable: false,
      reason: "State is required for serviceability check.",
      matchedRule: null,
    };
  }

  const country = await findCountryByCode(normalizedCountryCode);
  if (!country || !country.isActive) {
    return {
      serviceable: false,
      reason: "Country is not serviceable.",
      matchedRule: null,
    };
  }

  const state = await findStateByCode(country.id, normalizedStateCode);
  if (!state || !state.isActive) {
    return {
      serviceable: false,
      reason: "State is not serviceable.",
      matchedRule: null,
    };
  }

  const region = await findShippingRegionByStateId(state.id);
  if (!region || !region.isActive) {
    return {
      serviceable: false,
      reason: "Shipping is not available in this region.",
      matchedRule: null,
    };
  }

  const rules = await listShippingRulesByRegionId(region.id);

  const findExactMatch = (action) =>
    normalizedPin
      ? rules.find(
          (rule) =>
            rule.action === action &&
            rule.ruleType === "PIN" &&
            rule.pin === normalizedPin,
        ) || null
      : null;

  const findRangeMatch = (action) =>
    normalizedPin
      ? rules.find(
          (rule) =>
            rule.action === action &&
            rule.ruleType === "PIN_RANGE" &&
            pinMatchesRange(normalizedPin, rule.startPin, rule.endPin),
        ) || null
      : null;

  if (region.defaultService) {
    const matchedRule = findExactMatch("BLOCK") || findRangeMatch("BLOCK");

    if (matchedRule) {
      return {
        serviceable: false,
        reason: matchedRule.reason || "Courier unavailable in this area.",
        matchedRule: serializeRule(matchedRule),
      };
    }

    return {
      serviceable: true,
      reason: null,
      matchedRule: null,
    };
  }

  if (!normalizedPin) {
    return {
      serviceable: false,
      reason: "PIN code is required to confirm service in this state.",
      matchedRule: null,
    };
  }

  const matchedRule = findExactMatch("ALLOW") || findRangeMatch("ALLOW");

  if (matchedRule) {
    return {
      serviceable: true,
      reason: null,
      matchedRule: serializeRule(matchedRule),
    };
  }

  return {
    serviceable: false,
    reason: "Courier unavailable in this area.",
    matchedRule: null,
  };
};

const createShippingRule = async (payload = {}) => {
  const normalizedPayload = await normalizeRulePayload(payload);
  await assertNoDuplicateRule(normalizedPayload);

  const rule = await createShippingRuleRecord({
    ...normalizedPayload,
    createdAt: new Date(),
  });

  return serializeRule(rule);
};

const updateShippingRule = async (ruleId, payload = {}) => {
  const currentRule = await findShippingRuleById(ruleId);

  if (!currentRule) {
    throw new ApiError(404, "Shipping rule not found.");
  }

  const normalizedPayload = await normalizeRulePayload(payload, currentRule);
  await assertNoDuplicateRule(normalizedPayload, ruleId);

  const nextRule = await updateShippingRuleRecord(ruleId, normalizedPayload);
  return serializeRule(nextRule);
};

const deleteShippingRule = async (ruleId) => {
  const deletedRule = await deleteShippingRuleRecord(ruleId);

  if (!deletedRule) {
    throw new ApiError(404, "Shipping rule not found.");
  }

  return deletedRule;
};

const updateShippingRegion = async (regionId, payload = {}) => {
  const currentRegion = await findShippingRegionById(regionId);

  if (!currentRegion) {
    throw new ApiError(404, "Shipping region not found.");
  }

  const nextRegion = await updateShippingRegionRecord(regionId, {
    defaultService: payload.defaultService,
    isActive: payload.isActive,
  });

  return serializeRegion(nextRegion);
};

module.exports = {
  checkShippingServiceability,
  createCountry,
  createState,
  createShippingRule,
  deleteCountry,
  deleteState,
  deleteShippingRule,
  listCountriesForAdmin,
  listStatesForAdmin,
  listShippingServiceabilityCountries,
  listShippingServiceabilityRegions,
  listShippingServiceabilityRules,
  listShippingServiceabilityStates,
  serializeRegion,
  serializeRule,
  updateShippingRegion,
  updateCountry,
  updateState,
  updateShippingRule,
};
