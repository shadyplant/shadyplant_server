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

const getStaffAccessCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "strict" : "lax",
  path: "/api/v1/admin",
  maxAge: env.staff.accessTokenMaxAgeMs,
});

const attachStaffAccessCookie = (res, accessToken) => {
  res.cookie(
    env.staff.cookieName,
    accessToken,
    getStaffAccessCookieOptions(),
  );
};

const clearStaffAccessCookie = (res) => {
  res.clearCookie(env.staff.cookieName, getStaffAccessCookieOptions());
};

module.exports = {
  attachRefreshCookie,
  attachStaffAccessCookie,
  clearRefreshCookie,
  clearStaffAccessCookie,
};
