const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const hasConfiguredValue = (value) => {
  const normalizedValue = String(value || "").trim();

  return Boolean(
    normalizedValue &&
      !normalizedValue.toLowerCase().startsWith("replace-with-"),
  );
};

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const parseFloatNumber = (value, fallback) => {
  const parsedValue = Number.parseFloat(value ?? "");
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const parseDurationToMs = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const match = String(value).trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallback;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const normalizedPrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : "";

const auth = {
  accessTokenSecret: getRequiredEnv("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: getRequiredEnv("REFRESH_TOKEN_SECRET"),
  passwordResetTokenSecret:
    process.env.PASSWORD_RESET_TOKEN_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    getRequiredEnv("REFRESH_TOKEN_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",
  passwordResetTokenTtl: process.env.PASSWORD_RESET_TOKEN_TTL || "15m",
  refreshTokenMaxAgeMs: parseDurationToMs(
    process.env.REFRESH_TOKEN_TTL || "7d",
    7 * 24 * 60 * 60 * 1000,
  ),
  cookieName: process.env.COOKIE_NAME || "ggn_refresh_token",
  otpExpiryMinutes: parseInteger(process.env.OTP_EXPIRY_MINUTES, 10),
  otpMaxAttempts: parseInteger(process.env.OTP_MAX_ATTEMPTS, 5),
  exposeDevOtp: parseBoolean(process.env.AUTH_EXPOSE_DEV_OTP, false),
};

const env = {
  appName: String(process.env.APP_NAME || "Grass Green Nursery").trim(),
  port: parseInteger(process.env.PORT, 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigins: getRequiredEnv("CLIENT_ORIGIN")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  auth,
  staff: {
    accessTokenSecret:
      process.env.STAFF_ACCESS_TOKEN_SECRET ||
      process.env.ACCESS_TOKEN_SECRET,
    accessTokenTtl: process.env.STAFF_ACCESS_TOKEN_TTL || "12h",
    bootstrapOrganizationName: String(
      process.env.STAFF_BOOTSTRAP_ORGANIZATION_NAME || "Grass Green Nursery",
    ).trim(),
    bootstrapOrganizationSlug: String(
      process.env.STAFF_BOOTSTRAP_ORGANIZATION_SLUG || "grass-green-nursery",
    ).trim(),
    bootstrapOwnerName: String(process.env.STAFF_BOOTSTRAP_OWNER_NAME || "").trim(),
    bootstrapOwnerEmail: String(
      process.env.STAFF_BOOTSTRAP_OWNER_EMAIL || "",
    ).trim(),
    bootstrapOwnerPassword: String(
      process.env.STAFF_BOOTSTRAP_OWNER_PASSWORD || "",
    ).trim(),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: normalizedPrivateKey,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : "",
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  },
  googleAuth: {
    requiredHostedDomain: String(
      process.env.GOOGLE_REQUIRED_HOSTED_DOMAIN || "",
    ).trim().toLowerCase(),
  },
  googleMaps: {
    serverApiKey: String(
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        "",
    ).trim(),
  },
  mailer: {
    transport: String(
      process.env.MAILER_TRANSPORT ||
        (process.env.NODE_ENV === "production" ? "disabled" : "log"),
    )
      .trim()
      .toLowerCase(),
    fromName: String(process.env.MAILER_FROM_NAME || process.env.APP_NAME || "Grass Green Nursery").trim(),
    fromEmail: String(
      process.env.MAILER_FROM_EMAIL || "no-reply@grassgreen.local",
    ).trim(),
    aliasUser: String(process.env.MAILER_ALIAS_USER || "").trim(),
    replyTo: String(process.env.MAILER_REPLY_TO || "").trim(),
    host: String(process.env.MAILER_HOST || "").trim(),
    port: parseInteger(process.env.MAILER_PORT, 587),
    secure: parseBoolean(process.env.MAILER_SECURE, false),
    user: String(process.env.MAILER_USER || "").trim(),
    pass: String(process.env.MAILER_PASS || "").trim(),
  },
  cashfree: {
    environment: String(
      process.env.CASHFREE_ENVIRONMENT ||
        (process.env.NODE_ENV === "production" ? "production" : "sandbox"),
    )
      .trim()
      .toLowerCase(),
    appId: String(process.env.CASHFREE_APP_ID || "").trim(),
    secretKey: String(process.env.CASHFREE_SECRET_KEY || "").trim(),
    webhookSecret: String(process.env.CASHFREE_WEBHOOK_SECRET || "").trim(),
    apiVersion: String(process.env.CASHFREE_API_VERSION || "2025-01-01").trim(),
    notifyUrl: String(process.env.CASHFREE_NOTIFY_URL || "").trim(),
    webhookToleranceSeconds: parseInteger(
      process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS,
      300,
    ),
  },
  postgres: {
    url:
      process.env.POSTGRES_URL ||
      "postgres://postgres:postgres@localhost:5432/grass_green_nursery",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  mongo: {
    uri:
      process.env.MONGO_URI || "mongodb://localhost:27017/grass_green_nursery",
  },
  delivery: {
    originLat: parseFloatNumber(process.env.DELIVERY_ORIGIN_LAT, 25.5138),
    originLng: parseFloatNumber(process.env.DELIVERY_ORIGIN_LNG, 90.2142),
    quoteTtlMinutes: parseInteger(process.env.CHECKOUT_QUOTE_TTL_MINUTES, 15),
    cartDeliveryOffsetDays: parseInteger(process.env.CART_DELIVERY_OFFSET_DAYS, 5),
  },
};

env.isProduction = env.nodeEnv === "production";
env.isDevelopment = env.nodeEnv === "development";
env.isFirebaseConfigured = Boolean(
  env.firebase.serviceAccountPath ||
    env.firebase.serviceAccountJson ||
    (env.firebase.projectId &&
      env.firebase.clientEmail &&
      env.firebase.privateKey),
);
env.cashfree.environment =
  env.cashfree.environment === "production" ? "production" : "sandbox";
env.cashfree.isCheckoutConfigured = Boolean(
  env.cashfree.appId && env.cashfree.secretKey,
);
env.cashfree.isWebhookConfigured = hasConfiguredValue(
  env.cashfree.webhookSecret,
);
env.cashfree.isConfigured = Boolean(
  env.cashfree.isCheckoutConfigured && env.cashfree.isWebhookConfigured,
);
env.mailer.isEnabled = env.mailer.transport !== "disabled";
env.mailer.hasSmtpCredentials = Boolean(env.mailer.user && env.mailer.pass);
env.mailer.hasSmtpConfig = Boolean(env.mailer.host && env.mailer.port);

module.exports = { env };
