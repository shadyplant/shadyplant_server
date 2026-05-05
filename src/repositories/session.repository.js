const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapSessionRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    expiresAt: row.expires_at,
    replacedBySessionId: row.replaced_by_session_id,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createSession = async (sessionData) => {
  const id = generateId();
  const session = {
    userId: sessionData.userId,
    tokenHash: sessionData.tokenHash || "",
    ipAddress: sessionData.ipAddress || "unknown",
    userAgent: sessionData.userAgent || "unknown",
    expiresAt: sessionData.expiresAt,
    replacedBySessionId: null,
    revokedAt: null,
    revokeReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await query(
    `INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      ip_address,
      user_agent,
      expires_at,
      replaced_by_session_id,
      revoked_at,
      revoke_reason,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )`,
    [
      id,
      session.userId,
      session.tokenHash,
      session.ipAddress,
      session.userAgent,
      session.expiresAt,
      session.replacedBySessionId,
      session.revokedAt,
      session.revokeReason,
      session.createdAt,
      session.updatedAt,
    ],
  );

  return {
    id,
    ...session,
  };
};

const findSessionById = async (id) => {
  const result = await query(
    "SELECT * FROM sessions WHERE id = $1 LIMIT 1",
    [id],
  );
  return mapSessionRow(result.rows[0]);
};

const updateSession = async (id, updates) => {
  const currentSession = await findSessionById(id);
  if (!currentSession) {
    return null;
  }

  const nextSession = {
    ...currentSession,
    ...updates,
    updatedAt: new Date(),
  };

  const statement = buildUpdateStatement(
    {
      userId: nextSession.userId,
      tokenHash: nextSession.tokenHash,
      ipAddress: nextSession.ipAddress,
      userAgent: nextSession.userAgent,
      expiresAt: nextSession.expiresAt,
      replacedBySessionId: nextSession.replacedBySessionId,
      revokedAt: nextSession.revokedAt,
      revokeReason: nextSession.revokeReason,
      updatedAt: nextSession.updatedAt,
    },
    {
      userId: "user_id",
      tokenHash: "token_hash",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      expiresAt: "expires_at",
      replacedBySessionId: "replaced_by_session_id",
      revokedAt: "revoked_at",
      revokeReason: "revoke_reason",
      updatedAt: "updated_at",
    },
  );

  await query(
    `UPDATE sessions SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, id],
  );

  return nextSession;
};

const revokeSession = async (id, reason = "revoked") =>
  updateSession(id, {
    revokedAt: new Date(),
    revokeReason: reason,
  });

const revokeAllSessionsForUser = async (userId, reason = "revoked") => {
  await query(
    `UPDATE sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = $2,
         updated_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason],
  );
};

module.exports = {
  createSession,
  findSessionById,
  revokeAllSessionsForUser,
  revokeSession,
  updateSession,
};
