const express = require("express");
const {
  forgotPasswordRequest,
  forgotPasswordReset,
  forgotPasswordVerifyOtp,
  googleLogin,
  login,
  logout,
  me,
  refresh,
  register,
  verifyRegisterOtp,
  updateMe,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  forgotPasswordLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/register/verify-otp", registerLimiter, verifyRegisterOtp);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleLogin);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", refreshLimiter, logout);
router.get("/me", requireAuth, me);
router.put("/me", requireAuth, updateMe);
router.post("/forgot-password/request", forgotPasswordLimiter, forgotPasswordRequest);
router.post("/forgot-password/verify-otp", forgotPasswordLimiter, forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordLimiter, forgotPasswordReset);

module.exports = router;
