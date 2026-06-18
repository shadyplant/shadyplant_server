require("dotenv").config();
const axios = require("axios");

const BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts";

const normalizeString = (value) => String(value || "").trim();

const parseBrevoListIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((entry) => Number.parseInt(String(entry || "").trim(), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0),
    )];
  }

  return String(value || "")
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
};

const getBrevoApiKey = () => normalizeString(process.env.BREVO_API_KEY);

const getWelcomeBrevoListIds = () =>
  parseBrevoListIds(
    process.env.BREVO_WELCOME_LIST_ID ||
      process.env.BREVO_WELCOME_LIST_IDS ||
      process.env.BREVO_DEFAULT_LIST_ID ||
      "",
  );

const buildBrevoContactPayload = ({
  email,
  firstName,
  lastName,
  attributes = {},
  listIds = [],
  extId,
  updateEnabled = true,
}) => {
  const normalizedEmail = normalizeString(email).toLowerCase();
  const normalizedAttributes =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? Object.entries(attributes).reduce((accumulator, [key, value]) => {
          const normalizedKey = normalizeString(key);
          if (!normalizedKey) {
            return accumulator;
          }

          if (value === undefined || value === null) {
            return accumulator;
          }

          accumulator[normalizedKey] = value;
          return accumulator;
        }, {})
      : {};

  const normalizedListIds = parseBrevoListIds(listIds);
  const payload = {
    email: normalizedEmail,
    updateEnabled: Boolean(updateEnabled),
  };

  if (firstName !== undefined) {
    normalizedAttributes.FIRSTNAME = normalizeString(firstName);
  }

  if (lastName !== undefined) {
    normalizedAttributes.LASTNAME = normalizeString(lastName);
  }

  if (Object.keys(normalizedAttributes).length > 0) {
    payload.attributes = normalizedAttributes;
  }

  if (normalizedListIds.length > 0) {
    payload.listIds = normalizedListIds;
  }

  if (normalizeString(extId)) {
    payload.ext_id = normalizeString(extId);
  }

  return payload;
};

const upsertBrevoContact = async ({
  email,
  firstName,
  lastName,
  attributes = {},
  listIds = [],
  extId,
  updateEnabled = true,
} = {}) => {
  const apiKey = getBrevoApiKey();
  const payload = buildBrevoContactPayload({
    email,
    firstName,
    lastName,
    attributes,
    listIds,
    extId,
    updateEnabled,
  });

  if (!apiKey) {
    console.warn("[Brevo] Skipping contact upsert: BREVO_API_KEY is missing.", {
      email: payload.email || normalizeString(email),
      extId: payload.ext_id || null,
    });
    return null;
  }

  if (!payload.email) {
    console.warn("[Brevo] Skipping contact upsert: email is missing.", {
      extId: payload.ext_id || null,
    });
    return null;
  }

  console.info("[Brevo] Upserting contact", {
    email: payload.email,
    extId: payload.ext_id || null,
    listIds: payload.listIds || [],
    attributeKeys: payload.attributes ? Object.keys(payload.attributes) : [],
  });

  try {
    const response = await axios.post(BREVO_CONTACTS_URL, payload, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
    });

    console.info("[Brevo] Contact upsert succeeded", {
      email: payload.email,
      extId: payload.ext_id || null,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    console.error("[Brevo] Contact upsert failed", {
      email: payload.email,
      extId: payload.ext_id || null,
      status: error?.response?.status || null,
      data: error?.response?.data || null,
      message: error?.message || String(error),
    });
    return null;
  }
};

const addBrevoWelcomeContact = async ({
  id,
  email,
  fullName,
  firstName,
  lastName,
  attributes = {},
  listIds,
} = {}) => {
  const normalizedFullName = normalizeString(fullName);
  const [derivedFirstName, ...restNameParts] = normalizedFullName.split(/\s+/).filter(Boolean);
  const derivedLastName = restNameParts.join(" ");
  const resolvedFirstName =
    normalizeString(firstName) || derivedFirstName || "Customer";
  const resolvedLastName =
    normalizeString(lastName) || derivedLastName || "";
  const resolvedListIds = parseBrevoListIds(listIds).length
    ? parseBrevoListIds(listIds)
    : getWelcomeBrevoListIds();

  return upsertBrevoContact({
    email,
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    attributes: {
      ...attributes,
      FULLNAME: normalizedFullName || `${resolvedFirstName} ${resolvedLastName}`.trim(),
    },
    listIds: resolvedListIds,
    extId: id,
    updateEnabled: true,
  });
};

module.exports = {
  addBrevoWelcomeContact,
  buildBrevoContactPayload,
  getWelcomeBrevoListIds,
  parseBrevoListIds,
  upsertBrevoContact,
};
