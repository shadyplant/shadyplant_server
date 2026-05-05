const rateLimit = require("express-rate-limit");

const createAuthLimiter = (message) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
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

module.exports = {
  forgotPasswordLimiter: createAuthLimiter(
    "Too many password reset attempts. Please wait a minute and try again.",
  ),
  loginLimiter: createAuthLimiter(
    "Too many login attempts. Please wait a minute and try again.",
  ),
  refreshLimiter,
  registerLimiter: createAuthLimiter(
    "Too many registration attempts. Please wait a minute and try again.",
  ),
};
