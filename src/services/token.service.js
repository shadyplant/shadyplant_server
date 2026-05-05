const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { ApiError } = require("../utils/apiError");

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      provider: user.authProvider,
      type: "access",
    },
    env.auth.accessTokenSecret,
    { expiresIn: env.auth.accessTokenTtl },
  );

const signStaffAccessToken = (staffAccount) =>
  jwt.sign(
    {
      sub: staffAccount.id,
      email: staffAccount.email,
      organizationId: staffAccount.organizationId,
      role: staffAccount.role,
      type: "staff_access",
    },
    env.staff.accessTokenSecret,
    { expiresIn: env.staff.accessTokenTtl },
  );

const signRefreshToken = ({ sessionId, userId }) =>
  jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      type: "refresh",
    },
    env.auth.refreshTokenSecret,
    { expiresIn: env.auth.refreshTokenTtl },
  );

const signPasswordResetToken = ({ userId, identifier }) =>
  jwt.sign(
    {
      sub: userId,
      identifier,
      type: "password_reset",
    },
    env.auth.passwordResetTokenSecret,
    { expiresIn: env.auth.passwordResetTokenTtl },
  );

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.auth.accessTokenSecret);
  } catch (error) {
    throw new ApiError(401, "Access token is invalid or expired.");
  }
};

const verifyStaffAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, env.staff.accessTokenSecret);

    if (payload.type !== "staff_access") {
      throw new Error("Invalid staff access token type.");
    }

    return payload;
  } catch (error) {
    throw new ApiError(401, "Staff access token is invalid or expired.");
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.auth.refreshTokenSecret);
  } catch (error) {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }
};

const verifyPasswordResetToken = (token) => {
  try {
    const payload = jwt.verify(token, env.auth.passwordResetTokenSecret);

    if (payload.type !== "password_reset") {
      throw new Error("Invalid password reset token type.");
    }

    return payload;
  } catch (error) {
    throw new ApiError(401, "Password reset token is invalid or expired.");
  }
};

module.exports = {
  signAccessToken,
  signStaffAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyStaffAccessToken,
  verifyRefreshToken,
};
