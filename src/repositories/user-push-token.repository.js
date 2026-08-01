const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");

const normalizePlatform = (platform) => {
  const normalized = String(platform || "").trim().toLowerCase();

  if (["android", "ios", "web"].includes(normalized)) {
    return normalized;
  }

  return "android";
};

const mapPushTokenRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    installId: row.install_id,
    userId: row.user_id,
    token: row.token,
    platform: row.platform,
    deviceId: row.device_id,
    deviceName: row.device_name,
    appVersion: row.app_version,
    appBuild: row.app_build,
    isActive: Boolean(row.is_active),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const upsertUserPushToken = async ({
  userId = null,
  installId,
  token,
  platform = "android",
  deviceId = "default",
  deviceName = "",
  appVersion = "",
  appBuild = "",
  isActive = true,
}) => {
  const normalizedUserId = String(userId || "").trim();
  const normalizedInstallId = String(installId || "").trim();
  const normalizedToken = String(token || "").trim();
  const normalizedDeviceId = String(deviceId || "default").trim() || "default";
  const userIdValue = normalizedUserId || null;

  if (!normalizedInstallId) {
    throw new Error("installId is required.");
  }

  if (!normalizedToken) {
    throw new Error("token is required.");
  }

  const now = new Date();
  const result = await query(
    `INSERT INTO user_push_tokens (
      id,
      install_id,
      user_id,
      token,
      platform,
      device_id,
      device_name,
      app_version,
      app_build,
      is_active,
      last_seen_at,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11
    )
    ON CONFLICT (install_id, device_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      token = EXCLUDED.token,
      platform = EXCLUDED.platform,
      device_name = EXCLUDED.device_name,
      app_version = EXCLUDED.app_version,
      app_build = EXCLUDED.app_build,
      is_active = EXCLUDED.is_active,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      generateId(),
      normalizedInstallId,
      userIdValue,
      normalizedToken,
      normalizePlatform(platform),
      normalizedDeviceId,
      String(deviceName || "").trim(),
      String(appVersion || "").trim(),
      String(appBuild || "").trim(),
      Boolean(isActive),
      now,
    ],
  );

  return mapPushTokenRow(result.rows[0]);
};

const findActivePushTokensByUserIds = async (userIds = []) => {
  const normalizedUserIds = [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map((userId) => String(userId || "").trim())
      .filter(Boolean),
  )];

  if (!normalizedUserIds.length) {
    return [];
  }

  const result = await query(
    `SELECT *
     FROM user_push_tokens
     WHERE user_id = ANY($1::uuid[])
       AND is_active = TRUE
       AND token <> ''
     ORDER BY last_seen_at DESC, created_at DESC`,
    [normalizedUserIds],
  );

  return result.rows.map(mapPushTokenRow).filter(Boolean);
};

const deactivatePushTokensByValues = async (tokens = []) => {
  const normalizedTokens = [...new Set(
    (Array.isArray(tokens) ? tokens : [])
      .map((token) => String(token || "").trim())
      .filter(Boolean),
  )];

  if (!normalizedTokens.length) {
    return 0;
  }

  const result = await query(
    `UPDATE user_push_tokens
     SET is_active = FALSE,
         updated_at = NOW()
     WHERE token = ANY($1::text[])`,
    [normalizedTokens],
  );

  return result.rowCount || 0;
};

module.exports = {
  deactivatePushTokensByValues,
  findActivePushTokensByUserIds,
  upsertUserPushToken,
};
