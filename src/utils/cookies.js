const { env } = require("../config/env");

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "strict" : "lax",
  path: "/api/v1/auth",
  maxAge: env.auth.refreshTokenMaxAgeMs,
});

const attachRefreshCookie = (res, refreshToken) => {
  res.cookie(env.auth.cookieName, refreshToken, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(env.auth.cookieName, getRefreshCookieOptions());
};

module.exports = {
  attachRefreshCookie,
  clearRefreshCookie,
};
