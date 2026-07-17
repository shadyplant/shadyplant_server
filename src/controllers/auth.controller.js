const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const {
  getCurrentUser,
  getCurrentUserFromRefreshToken,
  loginManualUser,
  loginWithGoogle,
  logoutUser,
  refreshAuthSession,
  registerManualUser,
  resendRegistrationOtp,
  requestPasswordReset,
  resetPassword,
  updateCurrentUserProfile,
  verifyRegistrationOtp,
  verifyPasswordResetOtp,
} = require("../services/auth.service");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachRefreshCookie, clearRefreshCookie } = require("../utils/cookies");

const getRequestContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const sendAuthResponse = (res, statusCode, payload, message) => {
  attachRefreshCookie(res, payload.refreshToken);

  res.status(statusCode).json({
    message,
    data: {
      accessToken: payload.accessToken,
      user: payload.user,
      expiresIn: env.auth.accessTokenTtl,
    },
  });
};

const getChatbaseIdentityToken = asyncHandler(async (req, res) => {
  if (!env.chatbot.identitySecret) {
    return res.status(503).json({
      message: "Chat support is not configured on the server.",
      data: null,
    });
  }

  const token = jwt.sign(
    {
      user_id: req.auth.userId,
      email: req.auth.email,
      auth_provider: req.auth.provider,
    },
    env.chatbot.identitySecret,
    { expiresIn: "1h" },
  );

  res.status(200).json({
    message: "Chat support identity token generated successfully.",
    data: { token },
  });
});

const register = asyncHandler(async (req, res) => {
  const result = await registerManualUser(req.body, getRequestContext(req));
  res.status(201).json(result);
});

const resendRegisterOtp = asyncHandler(async (req, res) => {
  console.info("[Auth] /register/resend-otp request received", {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    bodyKeys: Object.keys(req.body || {}),
  });

  const result = await resendRegistrationOtp(req.body);

  console.info("[Auth] /register/resend-otp request processed", {
    ipAddress: req.ip,
    message: result?.message,
  });

  res.status(200).json(result);
});

const verifyRegisterOtp = asyncHandler(async (req, res) => {
  const payload = await verifyRegistrationOtp(req.body, getRequestContext(req));
  sendAuthResponse(
    res,
    200,
    payload,
    "Account verified successfully. You are now logged in.",
  );
});

const login = asyncHandler(async (req, res) => {
  const payload = await loginManualUser(req.body, getRequestContext(req));
  sendAuthResponse(res, 200, payload, "Login successful.");
});

const googleLogin = asyncHandler(async (req, res) => {
  const payload = await loginWithGoogle(req.body, getRequestContext(req));
  sendAuthResponse(res, 200, payload, "Google login successful.");
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[env.auth.cookieName];

  if (!refreshToken) {
    return res.status(200).json({
      message: "No active session.",
      data: null,
    });
  }

  const payload = await refreshAuthSession(refreshToken, getRequestContext(req));
  sendAuthResponse(res, 200, payload, "Session refreshed.");
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[env.auth.cookieName];

  try {
    await logoutUser(refreshToken);
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out." });
  }

  clearRefreshCookie(res);
  return res.status(200).json({ message: "Logged out." });
});

const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.auth.userId);
  res.status(200).json({
    message: "Current user fetched successfully.",
    data: { user },
  });
});

const sessionUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[env.auth.cookieName];

  if (!refreshToken) {
    return res.status(200).json({
      message: "No active session.",
      data: null,
    });
  }

  const user = await getCurrentUserFromRefreshToken(refreshToken);

  res.status(200).json({
    message: "Session user fetched successfully.",
    data: { user },
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await updateCurrentUserProfile(req.auth.userId, req.body);
  res.status(200).json({
    message: "Profile updated successfully.",
    data: { user },
  });
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const result = await requestPasswordReset(req.body);
  res.status(200).json(result);
});

const forgotPasswordVerifyOtp = asyncHandler(async (req, res) => {
  const result = await verifyPasswordResetOtp(req.body);
  res.status(200).json(result);
});

const forgotPasswordReset = asyncHandler(async (req, res) => {
  const result = await resetPassword(req.body);
  clearRefreshCookie(res);
  res.status(200).json(result);
});

module.exports = {
  forgotPasswordRequest,
  forgotPasswordReset,
  forgotPasswordVerifyOtp,
  getChatbaseIdentityToken,
  googleLogin,
  login,
  logout,
  me,
  sessionUser,
  refresh,
  register,
  resendRegisterOtp,
  verifyRegisterOtp,
  updateMe,
};
