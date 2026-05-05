const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapOrganizationRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapStaffRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
};

const createOrganization = async ({ name, slug, status = "active" }) => {
  const id = generateId();
  const now = new Date();

  await query(
    `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name, slug, status, now, now],
  );

  return {
    id,
    name,
    slug,
    status,
    createdAt: now,
    updatedAt: now,
  };
};

const findOrganizationBySlug = async (slug) => {
  const result = await query(
    "SELECT * FROM organizations WHERE LOWER(slug) = LOWER($1) LIMIT 1",
    [slug],
  );

  return mapOrganizationRow(result.rows[0]);
};

const findOrganizationById = async (organizationId) => {
  const result = await query(
    "SELECT * FROM organizations WHERE id = $1 LIMIT 1",
    [organizationId],
  );

  return mapOrganizationRow(result.rows[0]);
};

const findStaffAccountByEmail = async (email) => {
  const result = await query(
    "SELECT * FROM staff_accounts WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email],
  );

  return mapStaffRow(result.rows[0]);
};

const findStaffAccountById = async (staffAccountId) => {
  const result = await query(
    "SELECT * FROM staff_accounts WHERE id = $1 LIMIT 1",
    [staffAccountId],
  );

  return mapStaffRow(result.rows[0]);
};

const createStaffAccount = async ({
  organizationId,
  fullName,
  email,
  passwordHash,
  role,
  status = "active",
}) => {
  const id = generateId();
  const now = new Date();

  await query(
    `INSERT INTO staff_accounts (
      id,
      organization_id,
      full_name,
      email,
      password_hash,
      role,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      organizationId,
      fullName,
      email,
      passwordHash,
      role,
      status,
      now,
      now,
    ],
  );

  return {
    id,
    organizationId,
    fullName,
    email,
    passwordHash,
    role,
    status,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
};

const listStaffAccountsByOrganizationId = async (organizationId) => {
  const result = await query(
    `SELECT *
     FROM staff_accounts
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId],
  );

  return result.rows.map(mapStaffRow).filter(Boolean);
};

const countStaffAccounts = async () => {
  const result = await query("SELECT COUNT(*)::int AS count FROM staff_accounts");
  return Number(result.rows[0]?.count || 0);
};

const updateStaffAccount = async (staffAccountId, updates) => {
  const statement = buildUpdateStatement(
    {
      organizationId: updates.organizationId,
      fullName: updates.fullName,
      email: updates.email,
      passwordHash: updates.passwordHash,
      role: updates.role,
      status: updates.status,
      lastLoginAt: updates.lastLoginAt,
      updatedAt: new Date(),
    },
    {
      organizationId: "organization_id",
      fullName: "full_name",
      passwordHash: "password_hash",
      lastLoginAt: "last_login_at",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findStaffAccountById(staffAccountId);
  }

  await query(
    `UPDATE staff_accounts SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, staffAccountId],
  );

  return findStaffAccountById(staffAccountId);
};

const deleteStaffAccount = async (staffAccountId) => {
  await query("DELETE FROM staff_accounts WHERE id = $1", [staffAccountId]);
};

module.exports = {
  countStaffAccounts,
  createOrganization,
  createStaffAccount,
  deleteStaffAccount,
  findOrganizationById,
  findOrganizationBySlug,
  findStaffAccountByEmail,
  findStaffAccountById,
  listStaffAccountsByOrganizationId,
  updateStaffAccount,
};
