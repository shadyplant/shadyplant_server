const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const EMPTY_DELIVERY_ADDRESS = {
  formattedAddress: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  landmark: "",
  notes: "",
};

const EMPTY_BILLING_DETAILS = {
  name: "",
  contact: "",
  gstin: "",
  state: "",
  city: "",
  address: "",
};

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number || "",
    email: row.email,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider,
    googleUid: row.google_uid,
    profileImage: row.profile_image,
    deliveryAddress: {
      ...EMPTY_DELIVERY_ADDRESS,
      ...(row.delivery_address || {}),
    },
    billingDetails: {
      ...EMPTY_BILLING_DETAILS,
      ...(row.billing_details || {}),
    },
    isVerified: Boolean(row.is_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createUser = async (userData) => {
  const id = generateId();
  const user = {
    fullName: userData.fullName,
    phoneNumber: userData.phoneNumber || null,
    email: userData.email,
    passwordHash: userData.passwordHash || null,
    authProvider: userData.authProvider || "local",
    googleUid: userData.googleUid || null,
    profileImage: userData.profileImage || null,
    deliveryAddress: {
      ...EMPTY_DELIVERY_ADDRESS,
      ...(userData.deliveryAddress || {}),
    },
    billingDetails: {
      ...EMPTY_BILLING_DETAILS,
      ...(userData.billingDetails || {}),
    },
    isVerified:
      typeof userData.isVerified === "boolean" ? userData.isVerified : false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await query(
    `INSERT INTO users (
      id,
      full_name,
      phone_number,
      email,
      password_hash,
      auth_provider,
      google_uid,
      profile_image,
      delivery_address,
      billing_details,
      is_verified,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13
    )`,
    [
      id,
      user.fullName,
      user.phoneNumber,
      user.email,
      user.passwordHash,
      user.authProvider,
      user.googleUid,
      user.profileImage,
      JSON.stringify(user.deliveryAddress),
      JSON.stringify(user.billingDetails),
      user.isVerified,
      user.createdAt,
      user.updatedAt,
    ],
  );

  return {
    id,
    ...user,
  };
};

const findUserByEmail = async (email) => {
  const result = await query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email],
  );
  return mapUserRow(result.rows[0]);
};

const findUserByPhone = async (phoneNumber) => {
  const result = await query(
    "SELECT * FROM users WHERE phone_number = $1 LIMIT 1",
    [phoneNumber],
  );
  return mapUserRow(result.rows[0]);
};

const findUserById = async (id) => {
  const result = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return mapUserRow(result.rows[0]);
};

const listUsers = async () => {
  const result = await query(
    "SELECT * FROM users ORDER BY created_at DESC",
    [],
  );

  return result.rows.map(mapUserRow).filter(Boolean);
};

const findUserByGoogleUid = async (googleUid) => {
  const result = await query(
    "SELECT * FROM users WHERE google_uid = $1 LIMIT 1",
    [googleUid],
  );
  return mapUserRow(result.rows[0]);
};

const updateUser = async (id, updates) => {
  const currentUser = await findUserById(id);
  if (!currentUser) {
    return null;
  }

  const nextUser = {
    ...currentUser,
    ...updates,
    deliveryAddress: updates.deliveryAddress
      ? {
          ...EMPTY_DELIVERY_ADDRESS,
          ...(currentUser.deliveryAddress || {}),
          ...updates.deliveryAddress,
        }
      : {
          ...EMPTY_DELIVERY_ADDRESS,
          ...(currentUser.deliveryAddress || {}),
        },
    billingDetails: updates.billingDetails
      ? {
          ...EMPTY_BILLING_DETAILS,
          ...(currentUser.billingDetails || {}),
          ...updates.billingDetails,
        }
      : {
          ...EMPTY_BILLING_DETAILS,
          ...(currentUser.billingDetails || {}),
        },
    phoneNumber:
      updates.phoneNumber !== undefined
        ? updates.phoneNumber || null
        : currentUser.phoneNumber || null,
    updatedAt: new Date(),
  };

  const statement = buildUpdateStatement(
    {
      fullName: nextUser.fullName,
      phoneNumber: nextUser.phoneNumber,
      email: nextUser.email,
      passwordHash: nextUser.passwordHash,
      authProvider: nextUser.authProvider,
      googleUid: nextUser.googleUid,
      profileImage: nextUser.profileImage,
      deliveryAddress: JSON.stringify(nextUser.deliveryAddress),
      billingDetails: JSON.stringify(nextUser.billingDetails),
      isVerified: nextUser.isVerified,
      updatedAt: nextUser.updatedAt,
    },
    {
      fullName: "full_name",
      phoneNumber: "phone_number",
      passwordHash: "password_hash",
      authProvider: "auth_provider",
      googleUid: "google_uid",
      profileImage: "profile_image",
      deliveryAddress: { column: "delivery_address", cast: "jsonb" },
      billingDetails: { column: "billing_details", cast: "jsonb" },
      isVerified: "is_verified",
      updatedAt: "updated_at",
    },
  );

  await query(
    `UPDATE users SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, id],
  );

  return nextUser;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserByGoogleUid,
  findUserById,
  findUserByPhone,
  listUsers,
  updateUser,
};
