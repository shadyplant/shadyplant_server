const { findUserById } = require("../repositories/user.repository");
const { upsertUserPushToken } = require("../repositories/user-push-token.repository");
const { ApiError } = require("../utils/apiError");

const normalizePushDevicePayload = (payload = {}) => ({
  installId: String(payload.installId || payload.install_id || "").trim(),
  token: String(payload.token || payload.fcmToken || "").trim(),
  platform: String(payload.platform || "android").trim().toLowerCase(),
  deviceId: String(payload.deviceId || payload.device_id || "default").trim() || "default",
  deviceName: String(payload.deviceName || payload.device_name || "").trim(),
  appVersion: String(payload.appVersion || payload.app_version || "").trim(),
  appBuild: String(payload.appBuild || payload.app_build || "").trim(),
  isActive: payload.isActive !== false,
});

const ensureDeviceTokenPayload = (payload = {}) => {
  const normalized = normalizePushDevicePayload(payload);

  if (!normalized.installId) {
    throw new ApiError(400, "Install ID is required.");
  }

  if (!normalized.token) {
    throw new ApiError(400, "FCM token is required.");
  }

  return normalized;
};

const registerPushDeviceToken = async ({ userId = null, payload = {} } = {}) => {
  const normalizedPayload = ensureDeviceTokenPayload(payload);
  const normalizedUserId = String(userId || "").trim();

  if (normalizedUserId) {
    const user = await findUserById(normalizedUserId);

    if (!user) {
      throw new ApiError(404, "Account not found.");
    }
  }

  const token = await upsertUserPushToken({
    userId: normalizedUserId || null,
    installId: normalizedPayload.installId,
    token: normalizedPayload.token,
    platform: normalizedPayload.platform,
    deviceId: normalizedPayload.deviceId,
    deviceName: normalizedPayload.deviceName,
    appVersion: normalizedPayload.appVersion,
    appBuild: normalizedPayload.appBuild,
    isActive: normalizedPayload.isActive,
  });

  return {
    message: "Push token registered successfully.",
    data: { token },
  };
};

module.exports = {
  registerPushDeviceToken,
};
