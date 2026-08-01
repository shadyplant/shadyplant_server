const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");
const {
  DEFAULT_PAYMENT_ACCESS,
  normalizeUserPaymentAccess,
} = require("../services/user-account.service");

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

const EMPTY_PAYMENT_ACCESS = {
  ...DEFAULT_PAYMENT_ACCESS,
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
    paymentAccess: normalizeUserPaymentAccess({
      ...EMPTY_PAYMENT_ACCESS,
      ...(row.payment_access || {}),
    }),
    isVerified: Boolean(row.is_verified),
    isVip: Boolean(row.is_vip),
    customerCategory: row.customer_category || "normal",
    accountStatus: row.account_status || "active",
    bannedUntil:
      row.banned_until instanceof Date
        ? row.banned_until.toISOString()
        : row.banned_until || null,
    banReason: row.ban_reason || "",
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
    paymentAccess: normalizeUserPaymentAccess({
      ...EMPTY_PAYMENT_ACCESS,
      ...(userData.paymentAccess || {}),
    }),
    isVerified:
      typeof userData.isVerified === "boolean" ? userData.isVerified : false,
    isVip: typeof userData.isVip === "boolean" ? userData.isVip : false,
    customerCategory: userData.customerCategory || "normal",
    accountStatus: userData.accountStatus || "active",
    bannedUntil: userData.bannedUntil || null,
    banReason: userData.banReason || "",
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
      payment_access,
      is_verified,
      is_vip,
      customer_category,
      account_status,
      banned_until,
      ban_reason,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19
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
      JSON.stringify(user.paymentAccess),
      user.isVerified,
      user.isVip,
      user.customerCategory,
      user.accountStatus,
      user.bannedUntil,
      user.banReason,
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

const findUsersByEmails = async (emails = []) => {
  const normalizedEmails = [...new Set(
    (Array.isArray(emails) ? emails : [])
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean),
  )];

  if (!normalizedEmails.length) {
    return [];
  }

  const result = await query(
    "SELECT * FROM users WHERE LOWER(email) = ANY($1::text[])",
    [normalizedEmails],
  );

  return result.rows.map(mapUserRow).filter(Boolean);
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
    deliveryAddress: updates.deliveryAddress !== undefined
      ? {
          ...EMPTY_DELIVERY_ADDRESS,
          ...(currentUser.deliveryAddress || {}),
          ...updates.deliveryAddress,
        }
      : {
          ...EMPTY_DELIVERY_ADDRESS,
          ...(currentUser.deliveryAddress || {}),
        },
    billingDetails: updates.billingDetails !== undefined
      ? {
          ...EMPTY_BILLING_DETAILS,
          ...(currentUser.billingDetails || {}),
          ...updates.billingDetails,
        }
      : {
          ...EMPTY_BILLING_DETAILS,
          ...(currentUser.billingDetails || {}),
        },
    paymentAccess:
      updates.paymentAccess !== undefined
        ? normalizeUserPaymentAccess({
            ...(currentUser.paymentAccess || EMPTY_PAYMENT_ACCESS),
            ...updates.paymentAccess,
          })
        : normalizeUserPaymentAccess(currentUser.paymentAccess || EMPTY_PAYMENT_ACCESS),
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
      paymentAccess: JSON.stringify(nextUser.paymentAccess),
      isVerified: nextUser.isVerified,
      isVip: nextUser.isVip,
      customerCategory: nextUser.customerCategory,
      accountStatus: nextUser.accountStatus,
      bannedUntil: nextUser.bannedUntil,
      banReason: nextUser.banReason,
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
      paymentAccess: { column: "payment_access", cast: "jsonb" },
      isVerified: "is_verified",
      isVip: "is_vip",
      customerCategory: "customer_category",
      accountStatus: "account_status",
      bannedUntil: "banned_until",
      banReason: "ban_reason",
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
  findUsersByEmails,
  findUserByGoogleUid,
  findUserById,
  findUserByPhone,
  listUsers,
  updateUser,
};
