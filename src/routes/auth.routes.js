const express = require("express");
const {
  forgotPasswordRequest,
  forgotPasswordReset,
  forgotPasswordVerifyOtp,
  getChatbaseIdentityToken,
  googleLogin,
  login,
  logout,
  me,
  sessionUser,
  registerPushToken,
  refresh,
  register,
  resendRegisterOtp,
  verifyRegisterOtp,
  updateMe,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  forgotPasswordLimiter,
  loginLimiter,
  refreshLimiter,
  registerResendLimiter,
  registerLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/register/resend-otp", registerResendLimiter, resendRegisterOtp);
router.post("/register/verify-otp", registerLimiter, verifyRegisterOtp);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleLogin);
router.get("/chatbase-token", requireAuth, getChatbaseIdentityToken);
router.post("/push-token", requireAuth, registerPushToken);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", refreshLimiter, logout);
router.get("/session-user", refreshLimiter, sessionUser);
router.get("/me", requireAuth, me);
router.put("/me", requireAuth, updateMe);
router.post("/forgot-password/request", forgotPasswordLimiter, forgotPasswordRequest);
router.post("/forgot-password/verify-otp", forgotPasswordLimiter, forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordLimiter, forgotPasswordReset);

module.exports = router;
