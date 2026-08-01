const { initializeFirebaseApp, initializeFirebaseMessaging } = require("../config/firebase");
const { findUsersByEmails } = require("../repositories/user.repository");
const {
  deactivatePushTokensByValues,
  findActivePushTokensByUserIds,
  upsertUserPushToken,
} = require("../repositories/user-push-token.repository");
const { ApiError } = require("../utils/apiError");
const { isValidEmail, normalizeEmail } = require("../utils/validators");

const MAX_FCM_MULTICAST_TOKENS = 500;

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const normalizePushMessagePayload = (payload = {}) => ({
  title: String(payload.title || "").trim(),
  description: String(payload.description || payload.body || "").trim(),
  link: String(payload.link || payload.url || "").trim(),
  buttonLabel: String(payload.buttonLabel || payload.button_text || "Open").trim(),
  buttonColor: String(payload.buttonColor || payload.button_color || "#207958").trim(),
  logoUrl: String(payload.logoUrl || payload.logo || payload.imageUrl || "").trim(),
  imageUrl: String(payload.imageUrl || payload.bannerImageUrl || payload.heroImageUrl || "").trim(),
  vibrate:
    typeof payload.vibrate === "boolean"
      ? payload.vibrate
      : ["true", "1", "yes", "on"].includes(String(payload.vibrate || "").trim().toLowerCase()),
});

const buildPushDataPayload = ({
  title,
  description,
  link,
  buttonLabel,
  buttonColor,
  logoUrl,
  imageUrl,
  vibrate,
}) => ({
  title,
  description,
  link,
  buttonLabel,
  buttonColor,
  logoUrl,
  imageUrl,
  vibrate: vibrate ? "true" : "false",
  notificationType: "admin_push",
});

const resolveUsersByRecipientEmails = async (recipients = []) => {
  const normalizedEmails = [...new Set(
    (Array.isArray(recipients) ? recipients : [])
      .map((entry) => normalizeEmail(String(entry || "").trim()))
      .filter(Boolean),
  )];

  if (!normalizedEmails.length) {
    return [];
  }

  const users = await findUsersByEmails(normalizedEmails);

  return users.filter(Boolean);
};

const registerUserPushToken = async (userId, payload = {}) => {
  const token = String(payload.token || payload.fcmToken || "").trim();

  if (!token) {
    throw new ApiError(400, "FCM token is required.");
  }

  const record = await upsertUserPushToken({
    userId,
    token,
    platform: payload.platform || "android",
    deviceId: payload.deviceId || payload.device_id || "default",
    deviceName: payload.deviceName || payload.device_name || "",
    appVersion: payload.appVersion || payload.app_version || "",
    isActive: payload.isActive !== false,
  });

  return {
    message: "Push token registered successfully.",
    data: { token: record },
  };
};

const sendPushNotificationToRecipients = async ({
  recipients = [],
  title,
  description,
  link,
  buttonLabel,
  buttonColor,
  logoUrl,
  imageUrl,
  vibrate,
  source = "admin-push",
}) => {
  const normalizedRecipients = [...new Set(
    (Array.isArray(recipients) ? recipients : [])
      .map((entry) => normalizeEmail(String(entry || "").trim()))
      .filter((entry) => isValidEmail(entry)),
  )];

  if (!normalizedRecipients.length) {
    throw new ApiError(400, "At least one recipient email is required for push notifications.");
  }

  const normalizedTitle = String(title || "").trim();
  const normalizedDescription = String(description || "").trim();
  const normalizedLink = String(link || "").trim();

  if (!normalizedTitle) {
    throw new ApiError(400, "Notification title is required.");
  }

  if (!normalizedDescription) {
    throw new ApiError(400, "Notification description is required.");
  }

  const users = await resolveUsersByRecipientEmails(normalizedRecipients);
  if (!users.length) {
    return {
      skipped: true,
      reason: "no-matching-users",
      matchedRecipients: normalizedRecipients,
      delivered: false,
      successCount: 0,
      failureCount: 0,
      tokenCount: 0,
      recipients: normalizedRecipients,
    };
  }

  const pushTokens = await findActivePushTokensByUserIds(users.map((user) => user.id));
  if (!pushTokens.length) {
    return {
      skipped: true,
      reason: "no-active-push-tokens",
      matchedRecipients: normalizedRecipients,
      delivered: false,
      successCount: 0,
      failureCount: 0,
      tokenCount: 0,
      recipients: normalizedRecipients,
      userCount: users.length,
    };
  }

  const messaging = initializeFirebaseMessaging();
  const dataPayload = buildPushDataPayload({
    title: normalizedTitle,
    description: normalizedDescription,
    link: normalizedLink,
    buttonLabel,
    buttonColor,
    logoUrl,
    imageUrl,
    vibrate,
  });
  const tokens = [...new Set(pushTokens.map((entry) => entry.token).filter(Boolean))];
  const tokenChunks = chunkArray(tokens, MAX_FCM_MULTICAST_TOKENS);
  const invalidTokens = new Set();

  let successCount = 0;
  let failureCount = 0;

  for (const chunk of tokenChunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: normalizedTitle,
        body: normalizedDescription,
        imageUrl: imageUrl || logoUrl || undefined,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(dataPayload).map(([key, value]) => [key, String(value || "")]),
        ),
      },
      android: {
        priority: "high",
        notification: {
          sound: vibrate ? "default" : undefined,
          imageUrl: imageUrl || logoUrl || undefined,
        },
      },
      webpush: {
        notification: {
          icon: logoUrl || undefined,
          image: imageUrl || logoUrl || undefined,
        },
      },
    });

    successCount += response.successCount || 0;
    failureCount += response.failureCount || 0;

    response.responses.forEach((entry, index) => {
      if (!entry.success) {
        const code = String(entry?.error?.code || "").toLowerCase();
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          invalidTokens.add(chunk[index]);
        }
      }
    });
  }

  if (invalidTokens.size) {
    await deactivatePushTokensByValues([...invalidTokens]);
  }

  return {
    delivered: successCount > 0,
    skipped: false,
    source,
    recipients: normalizedRecipients,
    userCount: users.length,
    tokenCount: tokens.length,
    successCount,
    failureCount,
    invalidTokenCount: invalidTokens.size,
    push: dataPayload,
  };
};

module.exports = {
  registerUserPushToken,
  sendPushNotificationToRecipients,
};
