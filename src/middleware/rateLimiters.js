const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const createAuthLimiter = (message) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
  });

const createAdminAuthLimiter = (message, limit = 5) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
  });

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many refresh attempts. Please try again shortly." },
});

const productSyncLimiter = rateLimit({
  windowMs: env.productSync.rateLimitWindowMs,
  limit: env.productSync.rateLimitMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many product sync requests. Please try again shortly.",
  },
});

module.exports = {
  adminLoginLimiter: createAdminAuthLimiter(
    "Too many admin login attempts. Please wait 15 minutes and try again.",
  ),
  adminSetupLimiter: createAdminAuthLimiter(
    "Too many admin setup attempts. Please wait 15 minutes and try again.",
    3,
  ),
  forgotPasswordLimiter: createAuthLimiter(
    "Too many password reset attempts. Please wait a minute and try again.",
  ),
  loginLimiter: createAuthLimiter(
    "Too many login attempts. Please wait a minute and try again.",
  ),
  productSyncLimiter,
  refreshLimiter,
  registerLimiter: createAuthLimiter(
    "Too many registration attempts. Please wait a minute and try again.",
  ),
};
