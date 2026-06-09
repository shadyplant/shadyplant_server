const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";

const hasConfiguredValue = (value) => {
  const normalizedValue = String(value || "").trim();

  return Boolean(
    normalizedValue &&
      !normalizedValue.toLowerCase().startsWith("replace-with-"),
  );
};

const isPlaceholderValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  return (
    !normalizedValue ||
    normalizedValue.startsWith("replace-with-") ||
    normalizedValue.includes("your-") ||
    normalizedValue.includes("example.local") ||
    normalizedValue.includes("example.com")
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
    (isProduction ? getRequiredEnv("PASSWORD_RESET_TOKEN_SECRET") : process.env.REFRESH_TOKEN_SECRET) ||
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
  exposeDevOtp: !isProduction && parseBoolean(process.env.AUTH_EXPOSE_DEV_OTP, false),
  loginAttemptWindowMinutes: parseInteger(
    process.env.AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES,
    15,
  ),
  loginMaxAttempts: parseInteger(process.env.AUTH_LOGIN_MAX_ATTEMPTS, 10),
  loginLockoutMinutes: parseInteger(process.env.AUTH_LOGIN_LOCKOUT_MINUTES, 15),
};

const env = {
  appName: String(process.env.APP_NAME || "Grass Green Nursery").trim(),
  port: parseInteger(process.env.PORT, 8080),
  nodeEnv,
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
    accessTokenMaxAgeMs: parseDurationToMs(
      process.env.STAFF_ACCESS_TOKEN_TTL || "12h",
      12 * 60 * 60 * 1000,
    ),
    cookieName: process.env.STAFF_COOKIE_NAME || "ggn_admin_access_token",
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
    loginAttemptWindowMinutes: parseInteger(
      process.env.STAFF_LOGIN_ATTEMPT_WINDOW_MINUTES,
      15,
    ),
    loginMaxAttempts: parseInteger(process.env.STAFF_LOGIN_MAX_ATTEMPTS, 8),
    loginLockoutMinutes: parseInteger(
      process.env.STAFF_LOGIN_LOCKOUT_MINUTES,
      30,
    ),
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
  server: {
    publicBaseUrl: String(process.env.SERVER_PUBLIC_BASE_URL || "").trim(),
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
  paymentGateway: {
    provider: String(process.env.PAYMENT_GATEWAY_PROVIDER || "phonepe")
      .trim()
      .toLowerCase(),
    mode: String(
      process.env.PAYMENT_GATEWAY_MODE ||
        (process.env.NODE_ENV === "production" ? "production" : "sandbox"),
    )
      .trim()
      .toLowerCase(),
    orderExpireAfterSeconds: parseInteger(
      process.env.PAYMENT_GATEWAY_ORDER_EXPIRE_AFTER_SECONDS,
      1200,
    ),
    phonepe: {
      clientId: String(process.env.PHONEPE_CLIENT_ID || "").trim(),
      clientVersion: String(process.env.PHONEPE_CLIENT_VERSION || "1").trim(),
      clientSecret: String(process.env.PHONEPE_CLIENT_SECRET || "").trim(),
      webhookUsername: String(process.env.PHONEPE_WEBHOOK_USERNAME || "").trim(),
      webhookPassword: String(process.env.PHONEPE_WEBHOOK_PASSWORD || "").trim(),
    },
    cashfree: {
      clientId: String(process.env.CASHFREE_CLIENT_ID || "").trim(),
      clientSecret: String(process.env.CASHFREE_CLIENT_SECRET || "").trim(),
      webhookSecret: String(process.env.CASHFREE_WEBHOOK_SECRET || "").trim(),
      apiVersion: String(
        process.env.CASHFREE_API_VERSION || "2025-01-01",
      ).trim(),
    },
  },
  postgres: {
    url:
      process.env.POSTGRES_URL ||
      "postgres://postgres:postgres@localhost:5432/grass_green_nursery",
    ssl: parseBoolean(process.env.POSTGRES_SSL, isProduction),
    sslRejectUnauthorized: parseBoolean(
      process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED,
      true,
    ),
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  productSync: {
    bearerToken: String(process.env.SYNC_PRODUCTS_BEARER_TOKEN || "").trim(),
    rateLimitWindowMs: parseInteger(
      process.env.SYNC_PRODUCTS_RATE_LIMIT_WINDOW_MS,
      60 * 1000,
    ),
    rateLimitMax: parseInteger(process.env.SYNC_PRODUCTS_RATE_LIMIT_MAX, 10),
    maxBatchSize: parseInteger(process.env.SYNC_PRODUCTS_MAX_BATCH_SIZE, 10000),
    bulkWriteChunkSize: parseInteger(
      process.env.SYNC_PRODUCTS_BULK_WRITE_CHUNK_SIZE,
      500,
    ),
    lockTtlSeconds: parseInteger(process.env.SYNC_PRODUCTS_LOCK_TTL_SECONDS, 900),
    replayTtlSeconds: parseInteger(
      process.env.SYNC_PRODUCTS_REPLAY_TTL_SECONDS,
      24 * 60 * 60,
    ),
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
  serverSecurity: {
    trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  },
};

env.isProduction = isProduction;
env.isDevelopment = isDevelopment;
env.isFirebaseConfigured = Boolean(
  env.firebase.serviceAccountPath ||
    env.firebase.serviceAccountJson ||
    (env.firebase.projectId &&
      env.firebase.clientEmail &&
      env.firebase.privateKey),
);
env.paymentGateway.mode =
  env.paymentGateway.mode === "production" ? "production" : "sandbox";
env.paymentGateway.provider = env.paymentGateway.provider || "phonepe";
env.paymentGateway.phonepe.isCheckoutConfigured = Boolean(
  env.paymentGateway.phonepe.clientId &&
    env.paymentGateway.phonepe.clientVersion &&
    env.paymentGateway.phonepe.clientSecret,
);
env.paymentGateway.phonepe.isWebhookConfigured = Boolean(
  hasConfiguredValue(env.paymentGateway.phonepe.webhookUsername) &&
    hasConfiguredValue(env.paymentGateway.phonepe.webhookPassword),
);
env.paymentGateway.cashfree.isCheckoutConfigured = Boolean(
  env.paymentGateway.cashfree.clientId &&
    env.paymentGateway.cashfree.clientSecret &&
    env.paymentGateway.cashfree.apiVersion,
);
env.paymentGateway.cashfree.isWebhookConfigured = Boolean(
  env.paymentGateway.cashfree.webhookSecret &&
    env.paymentGateway.cashfree.apiVersion,
);
env.paymentGateway.isCheckoutConfigured = Boolean(
  env.paymentGateway.phonepe.isCheckoutConfigured ||
    env.paymentGateway.cashfree.isCheckoutConfigured,
);
env.paymentGateway.isWebhookConfigured = Boolean(
  env.paymentGateway.phonepe.isWebhookConfigured ||
    env.paymentGateway.cashfree.isWebhookConfigured,
);
env.paymentGateway.isConfigured = env.paymentGateway.isCheckoutConfigured;
env.mailer.isEnabled = env.mailer.transport !== "disabled";
env.mailer.hasSmtpCredentials = Boolean(env.mailer.user && env.mailer.pass);
env.mailer.hasSmtpConfig = Boolean(env.mailer.host && env.mailer.port);
env.productSync.isConfigured = hasConfiguredValue(env.productSync.bearerToken);

const assertProductionReady = () => {
  if (!env.isProduction) {
    return;
  }

  const errors = [];
  const requireRawEnv = (name) => {
    if (!process.env[name] || isPlaceholderValue(process.env[name])) {
      errors.push(`${name} must be set to a real production value.`);
    }
  };
  const requireStrongSecret = (name) => {
    const value = String(process.env[name] || "");
    if (isPlaceholderValue(value) || value.length < 32) {
      errors.push(`${name} must be at least 32 characters and not a placeholder.`);
    }
  };
  const rejectLocalUrl = (name, value) => {
    const normalizedValue = String(value || "").toLowerCase();
    if (
      normalizedValue.includes("localhost") ||
      normalizedValue.includes("127.0.0.1") ||
      normalizedValue.includes("@localhost")
    ) {
      errors.push(`${name} must not point to localhost in production.`);
    }
  };

  requireStrongSecret("ACCESS_TOKEN_SECRET");
  requireStrongSecret("REFRESH_TOKEN_SECRET");
  requireStrongSecret("PASSWORD_RESET_TOKEN_SECRET");
  if (env.auth.accessTokenSecret === env.auth.refreshTokenSecret) {
    errors.push("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different.");
  }

  requireRawEnv("CLIENT_ORIGIN");
  if (!env.clientOrigins.every((origin) => origin.startsWith("https://"))) {
    errors.push("Every CLIENT_ORIGIN value must use https:// in production.");
  }

  requireRawEnv("SERVER_PUBLIC_BASE_URL");
  if (!env.server.publicBaseUrl.startsWith("https://")) {
    errors.push("SERVER_PUBLIC_BASE_URL must use https:// in production.");
  }

  requireRawEnv("POSTGRES_URL");
  requireRawEnv("REDIS_URL");
  requireRawEnv("MONGO_URI");
  rejectLocalUrl("POSTGRES_URL", env.postgres.url);
  rejectLocalUrl("REDIS_URL", env.redis.url);
  rejectLocalUrl("MONGO_URI", env.mongo.uri);
  if (!env.postgres.ssl) {
    errors.push("POSTGRES_SSL must be true in production when connecting to RDS.");
  }

  if (!env.serverSecurity.trustProxy) {
    errors.push("TRUST_PROXY must be true behind AWS load balancers/App Runner.");
  }

  if (!env.isFirebaseConfigured) {
    errors.push(
      "Firebase Admin must be configured with FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }
  if (env.firebase.serviceAccountPath) {
    errors.push(
      "FIREBASE_SERVICE_ACCOUNT_PATH must not be used in production. Use FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY from a secret store.",
    );
  }
  if (
    env.firebase.serviceAccountJson &&
    isPlaceholderValue(env.firebase.serviceAccountJson)
  ) {
    errors.push("FIREBASE_SERVICE_ACCOUNT_JSON must be a real service-account payload.");
  }

  if (!hasConfiguredValue(env.productSync.bearerToken)) {
    errors.push("SYNC_PRODUCTS_BEARER_TOKEN must be set to a real production token.");
  }

  if (
    env.paymentGateway.mode === "production" &&
    !env.paymentGateway.isCheckoutConfigured
  ) {
    errors.push("A production payment gateway must be configured before accepting orders.");
  }

  if (env.mailer.isEnabled) {
    if (!env.mailer.hasSmtpConfig) {
      errors.push("MAILER_HOST and MAILER_PORT are required when mailer is enabled.");
    }
    if (!env.mailer.hasSmtpCredentials) {
      errors.push("MAILER_USER and MAILER_PASS are required when mailer is enabled.");
    }
  }

  if (env.staff.bootstrapOwnerPassword && env.staff.bootstrapOwnerPassword.length < 12) {
    errors.push("STAFF_BOOTSTRAP_OWNER_PASSWORD must be at least 12 characters when set.");
  }

  if (errors.length) {
    throw new Error(
      `Production configuration is not ready:\n- ${errors.join("\n- ")}`,
    );
  }
};

assertProductionReady();

module.exports = { env };
