const { ApiError } = require("../utils/apiError");
const {
  createDeliveryChargeSlab: createDeliveryChargeSlabRecord,
  deleteDeliveryChargeSlab: deleteDeliveryChargeSlabRecord,
  findDeliveryChargeProfileByCode,
  findDeliveryChargeProfileById,
  findDeliveryChargeSlabById,
  findDeliveryChargeSlabByRuleKey,
  listDeliveryChargeProfiles: listDeliveryChargeProfileRecords,
  listDeliveryChargeSlabs: listDeliveryChargeSlabRecords,
  upsertDeliveryChargeProfile,
  updateDeliveryChargeProfile: updateDeliveryChargeProfileRecord,
  updateDeliveryChargeSlab: updateDeliveryChargeSlabRecord,
} = require("../repositories/delivery-charge.repository");

const DEFAULT_PROFILE_CODES = {
  panIndia: "pan_india",
  northEast: "north_east",
};

const DEFAULT_DELIVERY_CHARGE_PROFILES = [
  {
    code: DEFAULT_PROFILE_CODES.panIndia,
    name: "Pan India",
    description: "Default delivery slabs for Assam, Jharkhand, Bihar, and West Bengal.",
    isActive: true,
    sortOrder: 10,
    metadata: {
      states: ["assam", "jharkhand", "bihar", "west bengal"],
    },
  },
  {
    code: DEFAULT_PROFILE_CODES.northEast,
    name: "North East",
    description:
      "Default delivery slabs for Meghalaya, Mizoram, Nagaland, Tripura, Arunachal Pradesh, Manipur, and Sikkim.",
    isActive: true,
    sortOrder: 20,
    metadata: {
      states: [
        "meghalaya",
        "mizoram",
        "nagaland",
        "tripura",
        "arunachal pradesh",
        "manipur",
        "sikkim",
      ],
    },
  },
];

const DEFAULT_DELIVERY_CHARGE_SLABS = {
  [DEFAULT_PROFILE_CODES.panIndia]: [
    {
      ruleKey: "light_goods_base",
      name: "Light goods base",
      description: "Light goods slab for 1 to 800 kg and 60 to 1200 km.",
      notes: "Charges are calculated per 20 kg unit.",
      sortOrder: 10,
      calculationMode: "per_weight_unit",
      rate: 1200,
      weightUnitKg: 20,
      minWeightKg: 1,
      minWeightInclusive: true,
      maxWeightKg: 800,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_25000_plus",
      name: "Heavy goods above 25000 kg",
      description: "Rate for weights above 25000 kg.",
      sortOrder: 20,
      calculationMode: "per_distance",
      rate: 136,
      minWeightKg: 25000,
      minWeightInclusive: false,
      maxWeightKg: null,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_18000_to_25000",
      name: "Heavy goods 18000 to 25000 kg",
      description: "Rate for weights between 18000 and 25000 kg.",
      sortOrder: 30,
      calculationMode: "per_distance",
      rate: 112,
      minWeightKg: 18000,
      minWeightInclusive: false,
      maxWeightKg: 25000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_12500_to_18000",
      name: "Heavy goods 12500 to 18000 kg",
      description: "Rate for weights between 12500 and 18000 kg.",
      sortOrder: 40,
      calculationMode: "per_distance",
      rate: 165,
      minWeightKg: 12500,
      minWeightInclusive: false,
      maxWeightKg: 18000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_7500_to_12500",
      name: "Heavy goods 7500 to 12500 kg",
      description: "Rate for weights between 7500 and 12500 kg.",
      sortOrder: 50,
      calculationMode: "per_distance",
      rate: 96,
      minWeightKg: 7500,
      minWeightInclusive: false,
      maxWeightKg: 12500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_5000_to_7500",
      name: "Heavy goods 5000 to 7500 kg",
      description: "Rate for weights between 5000 and 7500 kg.",
      sortOrder: 60,
      calculationMode: "per_distance",
      rate: 80,
      minWeightKg: 5000,
      minWeightInclusive: false,
      maxWeightKg: 7500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_2500_to_5000",
      name: "Heavy goods 2500 to 5000 kg",
      description: "Rate for weights between 2500 and 5000 kg.",
      sortOrder: 70,
      calculationMode: "per_distance",
      rate: 69,
      minWeightKg: 2500,
      minWeightInclusive: false,
      maxWeightKg: 5000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_1500_to_2500_short_distance",
      name: "Heavy goods 1500 to 2500 kg for short distance",
      description: "Special rate for 1500 to 2500 kg when distance is 60 to 300 km.",
      sortOrder: 80,
      calculationMode: "per_distance",
      rate: 42,
      minWeightKg: 1500,
      minWeightInclusive: false,
      maxWeightKg: 2500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 300,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_800_to_2500",
      name: "Heavy goods 800 to 2500 kg",
      description: "Fallback heavy goods rate for weights above 800 kg.",
      sortOrder: 90,
      calculationMode: "per_distance",
      rate: 53,
      minWeightKg: 800,
      minWeightInclusive: false,
      maxWeightKg: 2500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
  ],
  [DEFAULT_PROFILE_CODES.northEast]: [
    {
      ruleKey: "light_goods_base",
      name: "Light goods base",
      description: "Light goods slab for 1 to 800 kg and 60 to 1200 km.",
      notes: "Charges are calculated per 20 kg unit.",
      sortOrder: 10,
      calculationMode: "per_weight_unit",
      rate: 1200,
      weightUnitKg: 20,
      minWeightKg: 1,
      minWeightInclusive: true,
      maxWeightKg: 800,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 1200,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_25000_plus",
      name: "Heavy goods above 25000 kg",
      description: "Rate for weights above 25000 kg.",
      sortOrder: 20,
      calculationMode: "per_distance",
      rate: 136,
      minWeightKg: 25000,
      minWeightInclusive: false,
      maxWeightKg: null,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_18000_to_25000",
      name: "Heavy goods 18000 to 25000 kg",
      description: "Rate for weights between 18000 and 25000 kg.",
      sortOrder: 30,
      calculationMode: "per_distance",
      rate: 112,
      minWeightKg: 18000,
      minWeightInclusive: false,
      maxWeightKg: 25000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_12500_to_18000",
      name: "Heavy goods 12500 to 18000 kg",
      description: "Rate for weights between 12500 and 18000 kg.",
      sortOrder: 40,
      calculationMode: "per_distance",
      rate: 165,
      minWeightKg: 12500,
      minWeightInclusive: false,
      maxWeightKg: 18000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_7500_to_12500",
      name: "Heavy goods 7500 to 12500 kg",
      description: "Rate for weights between 7500 and 12500 kg.",
      sortOrder: 50,
      calculationMode: "per_distance",
      rate: 96,
      minWeightKg: 7500,
      minWeightInclusive: false,
      maxWeightKg: 12500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_5000_to_7500",
      name: "Heavy goods 5000 to 7500 kg",
      description: "Rate for weights between 5000 and 7500 kg.",
      sortOrder: 60,
      calculationMode: "per_distance",
      rate: 80,
      minWeightKg: 5000,
      minWeightInclusive: false,
      maxWeightKg: 7500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_2500_to_5000",
      name: "Heavy goods 2500 to 5000 kg",
      description: "Rate for weights between 2500 and 5000 kg.",
      sortOrder: 70,
      calculationMode: "per_distance",
      rate: 69,
      minWeightKg: 2500,
      minWeightInclusive: false,
      maxWeightKg: 5000,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_1500_to_2500_short_distance",
      name: "Heavy goods 1500 to 2500 kg for short distance",
      description: "Special rate for 1500 to 2500 kg when distance is 60 to 300 km.",
      sortOrder: 80,
      calculationMode: "per_distance",
      rate: 42,
      minWeightKg: 1500,
      minWeightInclusive: false,
      maxWeightKg: 2500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 300,
      maxDistanceInclusive: true,
    },
    {
      ruleKey: "heavy_800_to_2500",
      name: "Heavy goods 800 to 2500 kg",
      description: "Fallback heavy goods rate for weights above 800 kg.",
      sortOrder: 90,
      calculationMode: "per_distance",
      rate: 53,
      minWeightKg: 800,
      minWeightInclusive: false,
      maxWeightKg: 2500,
      maxWeightInclusive: true,
      minDistanceKm: 60,
      minDistanceInclusive: true,
      maxDistanceKm: 750,
      maxDistanceInclusive: true,
    },
  ],
};

let deliveryChargeCache = {
  profiles: [],
  profilesByCode: new Map(),
  profilesById: new Map(),
  slabsByProfileCode: new Map(),
  initialized: false,
};

const normalizeString = (value) => String(value || "").trim();

const normalizeKey = (value) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Boolean(value);
};

const normalizeNumber = (value, label) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new ApiError(400, `${label} must be a numeric value.`);
  }

  return parsedValue;
};

const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new ApiError(400, "A range boundary must be a numeric value.");
  }

  return parsedValue;
};

const normalizeInclusiveFlag = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Boolean(value);
};

const normalizeCalculationMode = (value, fallback = "per_distance") => {
  const normalizedValue = normalizeString(value || fallback).toLowerCase();
  const supportedModes = new Set(["flat", "per_distance", "per_weight_unit"]);

  if (!supportedModes.has(normalizedValue)) {
    throw new ApiError(
      400,
      "Calculation mode must be flat, per_distance, or per_weight_unit.",
    );
  }

  return normalizedValue;
};

const serializeProfile = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    code: profile.code,
    name: profile.name,
    description: profile.description || "",
    isActive: Boolean(profile.isActive),
    sortOrder: Number(profile.sortOrder ?? 100),
    metadata: profile.metadata || {},
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

const serializeSlab = (slab) => {
  if (!slab) {
    return null;
  }

  return {
    id: slab.id,
    profileId: slab.profileId,
    profileCode: slab.profileCode,
    profileName: slab.profileName,
    ruleKey: slab.ruleKey,
    name: slab.name,
    description: slab.description || "",
    notes: slab.notes || "",
    isActive: Boolean(slab.isActive),
    sortOrder: Number(slab.sortOrder ?? 100),
    calculationMode: slab.calculationMode,
    rate: Number(slab.rate ?? 0),
    weightUnitKg: Number(slab.weightUnitKg ?? 20),
    minWeightKg: slab.minWeightKg,
    minWeightInclusive: Boolean(slab.minWeightInclusive),
    maxWeightKg: slab.maxWeightKg,
    maxWeightInclusive: Boolean(slab.maxWeightInclusive),
    minDistanceKm: slab.minDistanceKm,
    minDistanceInclusive: Boolean(slab.minDistanceInclusive),
    maxDistanceKm: slab.maxDistanceKm,
    maxDistanceInclusive: Boolean(slab.maxDistanceInclusive),
    metadata: slab.metadata || {},
    createdAt: slab.createdAt,
    updatedAt: slab.updatedAt,
  };
};

const cloneDefaultProfiles = () =>
  DEFAULT_DELIVERY_CHARGE_PROFILES.map((profile) => ({
    ...profile,
    metadata: { ...(profile.metadata || {}) },
  }));

const cloneDefaultSlabs = () =>
  Object.fromEntries(
    Object.entries(DEFAULT_DELIVERY_CHARGE_SLABS).map(([profileCode, slabs]) => [
      profileCode,
      slabs.map((slab) => ({
        ...slab,
        metadata: { ...(slab.metadata || {}) },
      })),
    ]),
  );

const buildCache = (profiles = [], slabs = []) => {
  const profilesByCode = new Map();
  const profilesById = new Map();
  const slabsByProfileCode = new Map();

  const orderedProfiles = profiles
    .map(serializeProfile)
    .filter(Boolean)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.name.localeCompare(right.name);
    });

  for (const profile of orderedProfiles) {
    profilesByCode.set(profile.code, profile);
    profilesById.set(profile.id, profile);
    slabsByProfileCode.set(profile.code, []);
  }

  for (const slab of slabs.map(serializeSlab).filter(Boolean)) {
    if (!slabsByProfileCode.has(slab.profileCode)) {
      slabsByProfileCode.set(slab.profileCode, []);
    }

    slabsByProfileCode.get(slab.profileCode).push(slab);
  }

  for (const [profileCode, profileSlabs] of slabsByProfileCode.entries()) {
    profileSlabs.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.name.localeCompare(right.name);
    });
    slabsByProfileCode.set(profileCode, profileSlabs);
  }

  return {
    profiles: orderedProfiles,
    profilesByCode,
    profilesById,
    slabsByProfileCode,
    initialized: true,
  };
};

const getDeliveryChargeConfigurationSnapshot = () => ({
  profiles: deliveryChargeCache.profiles.map((profile) => ({ ...profile })),
  slabs: Array.from(deliveryChargeCache.slabsByProfileCode.entries()).reduce(
    (accumulator, [profileCode, slabs]) => {
      accumulator[profileCode] = slabs.map((slab) => ({ ...slab }));
      return accumulator;
    },
    {},
  ),
});

const refreshDeliveryChargeCache = async () => {
  const profiles = await listDeliveryChargeProfileRecords();
  const slabs = await listDeliveryChargeSlabRecords({ includeInactive: true });

  deliveryChargeCache = buildCache(profiles, slabs);
  return getDeliveryChargeConfigurationSnapshot();
};

const seedDefaultDeliveryChargeConfiguration = async () => {
  const existingProfiles = await listDeliveryChargeProfileRecords();

  if (existingProfiles.length > 0) {
    return false;
  }

  for (const profile of cloneDefaultProfiles()) {
    await upsertDeliveryChargeProfile({
      code: profile.code,
      name: profile.name,
      description: profile.description,
      isActive: profile.isActive,
      sortOrder: profile.sortOrder,
      metadata: profile.metadata,
    });
  }

  for (const [profileCode, slabs] of Object.entries(cloneDefaultSlabs())) {
    const profile = await findDeliveryChargeProfileByCode(profileCode);
    if (!profile) {
      continue;
    }

    for (const slab of slabs) {
      const existing = await findDeliveryChargeSlabByRuleKey(
        profile.id,
        slab.ruleKey,
      );
      if (existing) {
        continue;
      }

      await createDeliveryChargeSlabRecord({
        profileId: profile.id,
        ruleKey: slab.ruleKey,
        name: slab.name,
        description: slab.description,
        notes: slab.notes,
        isActive: true,
        sortOrder: slab.sortOrder,
        calculationMode: slab.calculationMode,
        rate: slab.rate,
        weightUnitKg: slab.weightUnitKg,
        minWeightKg: slab.minWeightKg,
        minWeightInclusive: slab.minWeightInclusive,
        maxWeightKg: slab.maxWeightKg,
        maxWeightInclusive: slab.maxWeightInclusive,
        minDistanceKm: slab.minDistanceKm,
        minDistanceInclusive: slab.minDistanceInclusive,
        maxDistanceKm: slab.maxDistanceKm,
        maxDistanceInclusive: slab.maxDistanceInclusive,
        metadata: slab.metadata || {},
      });
    }
  }

  return true;
};

const bootstrapDeliveryChargeConfiguration = async () => {
  await seedDefaultDeliveryChargeConfiguration();
  await refreshDeliveryChargeCache();
};

const listDeliveryChargeProfiles = async (query = {}) => {
  const { profiles } = getDeliveryChargeConfigurationSnapshot();
  const normalizedQuery = normalizeString(query?.search || query?.q);
  const normalizedCode = normalizeKey(query?.code);
  const normalizedActive = query?.isActive;

  return profiles
    .filter((profile) => {
      if (normalizedCode && normalizeKey(profile.code) !== normalizedCode) {
        return false;
      }

      if (normalizedActive !== undefined && normalizedActive !== null && normalizedActive !== "") {
        const nextActive = String(normalizedActive).toLowerCase();
        if (nextActive === "true" || nextActive === "false") {
          if (Boolean(profile.isActive) !== (nextActive === "true")) {
            return false;
          }
        }
      }

      if (normalizedQuery) {
        const haystack = [
          profile.code,
          profile.name,
          profile.description,
          JSON.stringify(profile.metadata || {}),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery.toLowerCase());
      }

      return true;
    })
    .map((profile) => ({ ...profile }));
};

const getDeliveryChargeProfile = async (profileCode) => {
  const normalizedProfileCode = normalizeKey(profileCode);
  if (!normalizedProfileCode) {
    return null;
  }

  const { profiles } = getDeliveryChargeConfigurationSnapshot();
  const profile = profiles.find((entry) => normalizeKey(entry.code) === normalizedProfileCode);
  return profile ? { ...profile } : null;
};

const updateDeliveryChargeProfile = async (profileCode, payload = {}) => {
  const normalizedProfileCode = normalizeKey(profileCode);
  const currentProfile = await findDeliveryChargeProfileByCode(normalizedProfileCode);

  if (!currentProfile) {
    throw new ApiError(404, "Delivery charge profile not found.");
  }

  const nextProfile = await updateDeliveryChargeProfileRecord(currentProfile.id, {
    name: payload.name !== undefined ? normalizeString(payload.name) : currentProfile.name,
    description:
      payload.description !== undefined
        ? normalizeString(payload.description)
        : currentProfile.description,
    isActive:
      payload.isActive !== undefined
        ? normalizeBoolean(payload.isActive, currentProfile.isActive)
        : currentProfile.isActive,
    sortOrder:
      payload.sortOrder !== undefined
        ? Math.floor(normalizeNumber(payload.sortOrder, "Sort order"))
        : currentProfile.sortOrder,
    metadata:
      payload.metadata !== undefined
        ? payload.metadata && typeof payload.metadata === "object"
          ? payload.metadata
          : {}
        : currentProfile.metadata || {},
  });

  await refreshDeliveryChargeCache();
  return serializeProfile(nextProfile);
};

const listDeliveryChargeSlabs = async (query = {}) => {
  const { slabs } = getDeliveryChargeConfigurationSnapshot();
  const normalizedQuery = normalizeString(query?.search || query?.q);
  const normalizedProfileCode = normalizeKey(query?.profileCode || query?.profile_code);

  const flattenedSlabs = Object.entries(slabs).flatMap(([profileCode, profileSlabs]) =>
    profileSlabs.map((slab) => ({
      ...slab,
      profileCode,
    })),
  );

  return flattenedSlabs
    .filter((slab) => {
      if (normalizedProfileCode && normalizeKey(slab.profileCode) !== normalizedProfileCode) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        slab.ruleKey,
        slab.name,
        slab.description,
        slab.notes,
        slab.profileCode,
        JSON.stringify(slab.metadata || {}),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery.toLowerCase());
    })
    .map((slab) => ({ ...slab }));
};

const getDeliveryChargeSlab = async (slabId) => {
  const { slabs } = getDeliveryChargeConfigurationSnapshot();
  const flattenedSlabs = Object.values(slabs).flat();
  const slab = flattenedSlabs.find((entry) => String(entry.id || "").trim() === String(slabId || "").trim());
  return slab ? { ...slab } : null;
};

const normalizeSlabPayload = async (payload = {}, existingSlab = null) => {
  const profileCode = normalizeKey(payload.profileCode || payload.profile_code);
  const profileId = normalizeString(payload.profileId || payload.profile_id);
  const resolvedProfile =
    profileId || profileCode
      ? profileId
        ? await findDeliveryChargeProfileById(profileId)
        : await findDeliveryChargeProfileByCode(profileCode)
      : existingSlab
        ? await findDeliveryChargeProfileByCode(existingSlab.profileCode)
        : null;

  if (!resolvedProfile) {
    throw new ApiError(400, "A valid delivery charge profile is required.");
  }

  const ruleKey = normalizeKey(payload.ruleKey || payload.rule_key || existingSlab?.ruleKey);
  const name = normalizeString(payload.name ?? existingSlab?.name);

  if (!ruleKey) {
    throw new ApiError(400, "Rule key is required.");
  }

  if (!name) {
    throw new ApiError(400, "Slab name is required.");
  }

  const calculationMode = normalizeCalculationMode(
    payload.calculationMode || payload.calculation_mode,
    existingSlab?.calculationMode || "per_distance",
  );
  const rate = normalizeNumber(payload.rate ?? existingSlab?.rate ?? 0, "Rate");
  const weightUnitKg = normalizeNumber(
    payload.weightUnitKg ?? payload.weight_unit_kg ?? existingSlab?.weightUnitKg ?? 20,
    "Weight unit",
  );
  const minWeightKg = normalizeOptionalNumber(
    payload.minWeightKg ?? payload.min_weight_kg ?? existingSlab?.minWeightKg,
  );
  const maxWeightKg = normalizeOptionalNumber(
    payload.maxWeightKg ?? payload.max_weight_kg ?? existingSlab?.maxWeightKg,
  );
  const minDistanceKm = normalizeOptionalNumber(
    payload.minDistanceKm ?? payload.min_distance_km ?? existingSlab?.minDistanceKm,
  );
  const maxDistanceKm = normalizeOptionalNumber(
    payload.maxDistanceKm ?? payload.max_distance_km ?? existingSlab?.maxDistanceKm,
  );
  const metadata =
    payload.metadata !== undefined
      ? payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : {}
      : existingSlab?.metadata || {};

  if (minWeightKg !== null && maxWeightKg !== null && minWeightKg > maxWeightKg) {
    throw new ApiError(400, "Minimum weight cannot be greater than maximum weight.");
  }

  if (minDistanceKm !== null && maxDistanceKm !== null && minDistanceKm > maxDistanceKm) {
    throw new ApiError(400, "Minimum distance cannot be greater than maximum distance.");
  }

  return {
    profileId: resolvedProfile.id,
    ruleKey,
    name,
    description:
      payload.description !== undefined
        ? normalizeString(payload.description)
        : normalizeString(existingSlab?.description),
    notes:
      payload.notes !== undefined
        ? normalizeString(payload.notes)
        : normalizeString(existingSlab?.notes),
    isActive:
      payload.isActive !== undefined
        ? normalizeBoolean(payload.isActive, existingSlab?.isActive ?? true)
        : existingSlab?.isActive ?? true,
    sortOrder:
      payload.sortOrder !== undefined
        ? Math.floor(normalizeNumber(payload.sortOrder, "Sort order"))
        : existingSlab?.sortOrder ?? 100,
    calculationMode,
    rate,
    weightUnitKg,
    minWeightKg,
    minWeightInclusive: normalizeInclusiveFlag(
      payload.minWeightInclusive ?? payload.min_weight_inclusive,
      existingSlab?.minWeightInclusive ?? true,
    ),
    maxWeightKg,
    maxWeightInclusive: normalizeInclusiveFlag(
      payload.maxWeightInclusive ?? payload.max_weight_inclusive,
      existingSlab?.maxWeightInclusive ?? true,
    ),
    minDistanceKm,
    minDistanceInclusive: normalizeInclusiveFlag(
      payload.minDistanceInclusive ?? payload.min_distance_inclusive,
      existingSlab?.minDistanceInclusive ?? true,
    ),
    maxDistanceKm,
    maxDistanceInclusive: normalizeInclusiveFlag(
      payload.maxDistanceInclusive ?? payload.max_distance_inclusive,
      existingSlab?.maxDistanceInclusive ?? true,
    ),
    metadata,
  };
};

const createDeliveryChargeSlab = async (payload = {}) => {
  const normalizedSlab = await normalizeSlabPayload(payload);
  const duplicateSlab = await findDeliveryChargeSlabByRuleKey(
    normalizedSlab.profileId,
    normalizedSlab.ruleKey,
  );

  if (duplicateSlab) {
    throw new ApiError(409, "A delivery charge slab with this rule key already exists.");
  }

  const slab = await createDeliveryChargeSlabRecord({
    ...normalizedSlab,
    metadata: normalizedSlab.metadata || {},
  });

  await refreshDeliveryChargeCache();
  return serializeSlab(slab);
};

const updateDeliveryChargeSlab = async (slabId, payload = {}) => {
  const currentSlab = await findDeliveryChargeSlabById(slabId);

  if (!currentSlab) {
    throw new ApiError(404, "Delivery charge slab not found.");
  }

  const normalizedSlab = await normalizeSlabPayload(payload, currentSlab);
  const duplicateSlab = await findDeliveryChargeSlabByRuleKey(
    normalizedSlab.profileId,
    normalizedSlab.ruleKey,
  );

  if (duplicateSlab && duplicateSlab.id !== slabId) {
    throw new ApiError(409, "A delivery charge slab with this rule key already exists.");
  }

  const nextSlab = await updateDeliveryChargeSlabRecord(slabId, normalizedSlab);
  await refreshDeliveryChargeCache();
  return serializeSlab(nextSlab);
};

const deleteDeliveryChargeSlab = async (slabId) => {
  const deletedSlab = await deleteDeliveryChargeSlabRecord(slabId);

  if (!deletedSlab) {
    throw new ApiError(404, "Delivery charge slab not found.");
  }

  await refreshDeliveryChargeCache();
  return deletedSlab;
};

const resolveDeliveryProfileCodeForState = (state = "", explicitProfileCode = "") => {
  const normalizedExplicitProfileCode = normalizeKey(explicitProfileCode);
  if (normalizedExplicitProfileCode) {
    return normalizedExplicitProfileCode;
  }

  const normalizedState = normalizeString(state).toLowerCase();

  if (!normalizedState) {
    return "";
  }

  const profile = deliveryChargeCache.profilesByCode.get(DEFAULT_PROFILE_CODES.panIndia);
  const northEastProfile = deliveryChargeCache.profilesByCode.get(DEFAULT_PROFILE_CODES.northEast);
  const panIndiaStates = new Set(
    profile?.metadata?.states || DEFAULT_DELIVERY_CHARGE_PROFILES[0].metadata.states,
  );
  const northEastStates = new Set(
    northEastProfile?.metadata?.states || DEFAULT_DELIVERY_CHARGE_PROFILES[1].metadata.states,
  );

  if (panIndiaStates.has(normalizedState) && profile?.isActive !== false) {
    return DEFAULT_PROFILE_CODES.panIndia;
  }

  if (northEastStates.has(normalizedState) && northEastProfile?.isActive !== false) {
    return DEFAULT_PROFILE_CODES.northEast;
  }

  return "";
};

const isValueWithinRange = (value, minValue, minInclusive, maxValue, maxInclusive) => {
  if (minValue !== null && minValue !== undefined) {
    if (minInclusive) {
      if (value < minValue) {
        return false;
      }
    } else if (value <= minValue) {
      return false;
    }
  }

  if (maxValue !== null && maxValue !== undefined) {
    if (maxInclusive) {
      if (value > maxValue) {
        return false;
      }
    } else if (value >= maxValue) {
      return false;
    }
  }

  return true;
};

const calculateCostForSlab = (slab, weight, distance) => {
  if (slab.calculationMode === "flat") {
    return {
      cost: Math.round(Number(slab.rate || 0)),
      rate: Number(slab.rate || 0),
      units: null,
    };
  }

  if (slab.calculationMode === "per_weight_unit") {
    const units = Math.max(1, Math.ceil(weight / Number(slab.weightUnitKg || 20)));
    const cost = units * Number(slab.rate || 0);

    return {
      cost: Math.round(cost),
      rate: Number(slab.rate || 0),
      units,
    };
  }

  const cost = Number(slab.rate || 0) * distance;
  return {
    cost: Math.round(cost),
    rate: Number(slab.rate || 0),
    units: null,
  };
};

const calculateTransportChargeForProfileCode = (profileCode, weight, distance) => {
  const normalizedProfileCode = normalizeKey(profileCode);
  const profile = deliveryChargeCache.profilesByCode.get(normalizedProfileCode);

  if (!profile) {
    return {
      success: false,
      message: `Unsupported delivery profile: ${profileCode}.`,
    };
  }

  const slabs = deliveryChargeCache.slabsByProfileCode.get(normalizedProfileCode) || [];

  for (const slab of slabs) {
    if (!slab.isActive) {
      continue;
    }

    if (
      !isValueWithinRange(
        weight,
        slab.minWeightKg,
        slab.minWeightInclusive,
        slab.maxWeightKg,
        slab.maxWeightInclusive,
      )
    ) {
      continue;
    }

    if (
      !isValueWithinRange(
        distance,
        slab.minDistanceKm,
        slab.minDistanceInclusive,
        slab.maxDistanceKm,
        slab.maxDistanceInclusive,
      )
    ) {
      continue;
    }

    const calculation = calculateCostForSlab(slab, weight, distance);

    return {
      success: true,
      cost: calculation.cost,
      rate: calculation.rate,
      units: calculation.units,
      profileCode: profile.code,
      profileName: profile.name,
      slabId: slab.id,
      slabKey: slab.ruleKey,
      slabName: slab.name,
      message:
        slab.calculationMode === "per_weight_unit"
          ? `Response Done - ${slab.name}: ${calculation.units} unit(s) x ${calculation.rate} = ${calculation.cost}`
          : `Response Done - ${slab.name}: rate ${calculation.rate} x ${distance} km = ${calculation.cost}`,
    };
  }

  return {
    success: false,
    message: `No active delivery slab matched the selected shipment parameters for ${profile.name}.`,
  };
};

const calculateTransportCharge = (weight, distance, stateOrOptions = {}) => {
  const options =
    typeof stateOrOptions === "string"
      ? { state: stateOrOptions }
      : stateOrOptions || {};
  const state = options.state || "";
  const profileCode = resolveDeliveryProfileCodeForState(state, options.profileCode);

  if (!profileCode) {
    return {
      success: false,
      message: `Unsupported delivery state: ${state}.`,
    };
  }

  return calculateTransportChargeForProfileCode(profileCode, weight, distance);
};

const listDeliveryChargeProfilesForAdmin = async (query = {}) => listDeliveryChargeProfiles(query);

const listDeliveryChargeSlabsForAdmin = async (query = {}) => listDeliveryChargeSlabs(query);

const getDeliveryChargeProfilesSnapshotForAdmin = () => getDeliveryChargeConfigurationSnapshot();

module.exports = {
  bootstrapDeliveryChargeConfiguration,
  calculateTransportCharge,
  calculateTransportChargeForProfileCode,
  createDeliveryChargeSlab,
  deleteDeliveryChargeSlab,
  getDeliveryChargeConfigurationSnapshot,
  getDeliveryChargeProfile,
  getDeliveryChargeProfilesSnapshotForAdmin,
  getDeliveryChargeSlab,
  listDeliveryChargeProfilesForAdmin,
  listDeliveryChargeSlabsForAdmin,
  refreshDeliveryChargeCache,
  resolveDeliveryProfileCodeForState,
  updateDeliveryChargeProfile,
  updateDeliveryChargeSlab,
};
