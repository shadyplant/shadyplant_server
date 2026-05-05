const {
  createUser,
  findUserByEmail,
  findUserByGoogleUid,
  findUserById,
  findUserByPhone,
  updateUser,
} = require("../repositories/user.repository");
const {
  createSession,
  findSessionById,
  revokeAllSessionsForUser,
  revokeSession,
  updateSession,
} = require("../repositories/session.repository");
const {
  clearOtpRecord,
  findOtpRecord,
  incrementOtpAttempts,
  OTP_PURPOSES,
  saveOtpRecord,
} = require("../repositories/reset-otp.repository");
const { initializeFirebase } = require("../config/firebase");
const { env } = require("../config/env");
const { sendOtpEmail } = require("../mailer");
const { ApiError } = require("../utils/apiError");
const { createSha256Hash, generateOtp } = require("../utils/crypto");
const {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} = require("../utils/password");
const {
  isValidEmail,
  isValidPostalCode,
  isValidPhoneNumber,
  normalizeEmail,
} = require("../utils/validators");
const {
  signAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyPasswordResetToken,
} = require("./token.service");

const getUserAuthMethods = (user) => ({
  hasPasswordLogin: Boolean(user?.passwordHash),
  hasGoogleLogin: Boolean(user?.googleUid),
});

const deriveAuthProvider = ({ passwordHash, googleUid }) => {
  if (passwordHash && googleUid) {
    return "hybrid";
  }

  if (googleUid) {
    return "google";
  }

  return "local";
};

const sanitizeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  email: user.email,
  authProvider: user.authProvider,
  authMethods: getUserAuthMethods(user),
  profileImage: user.profileImage,
  isVerified: Boolean(user.isVerified),
  deliveryAddress: {
    formattedAddress: user.deliveryAddress?.formattedAddress || "",
    line1: user.deliveryAddress?.line1 || "",
    line2: user.deliveryAddress?.line2 || "",
    city: user.deliveryAddress?.city || "",
    state: user.deliveryAddress?.state || "",
    postalCode: user.deliveryAddress?.postalCode || "",
    landmark: user.deliveryAddress?.landmark || "",
    notes: user.deliveryAddress?.notes || "",
  },
  billingDetails: {
    name: user.billingDetails?.name || "",
    contact: user.billingDetails?.contact || "",
    gstin: user.billingDetails?.gstin || "",
    state: user.billingDetails?.state || "",
    city: user.billingDetails?.city || "",
    address: user.billingDetails?.address || "",
  },
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const normalizeDeliveryAddress = (deliveryAddress = {}) => ({
  formattedAddress: String(
    deliveryAddress.formattedAddress || deliveryAddress.address || "",
  ).trim(),
  line1: String(deliveryAddress.line1 || "").trim(),
  line2: String(deliveryAddress.line2 || "").trim(),
  city: String(deliveryAddress.city || "").trim(),
  state: String(deliveryAddress.state || "").trim(),
  postalCode: String(deliveryAddress.postalCode || "").trim(),
  landmark: String(deliveryAddress.landmark || "").trim(),
  notes: String(deliveryAddress.notes || "").trim(),
});

const normalizeBillingDetails = (billingDetails = {}) => ({
  name: String(billingDetails.name || billingDetails.fullName || "").trim(),
  contact: String(
    billingDetails.contact || billingDetails.phoneNumber || "",
  ).trim(),
  gstin: String(billingDetails.gstin || "").trim(),
  state: String(billingDetails.state || "").trim(),
  city: String(billingDetails.city || "").trim(),
  address: String(billingDetails.address || "").trim(),
});

const validateRegistrationPayload = ({ fullName, phoneNumber, email, password }) => {
  if (!fullName?.trim()) {
    throw new ApiError(400, "Full name is required.");
  }

  if (!phoneNumber?.trim()) {
    throw new ApiError(400, "Phone number is required.");
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(400, "Phone number format is invalid.");
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Email format is invalid.");
  }

  if (!validatePasswordStrength(password || "")) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    );
  }
};

const validateOtpPayload = ({ identifier, otp }) => {
  if (!identifier?.trim()) {
    throw new ApiError(400, "Email or phone number is required.");
  }

  if (!isValidEmail(identifier) && !isValidPhoneNumber(identifier)) {
    throw new ApiError(400, "Email or phone number format is invalid.");
  }

  if (!otp?.trim()) {
    throw new ApiError(400, "OTP is required.");
  }
};

const validatePasswordResetPayload = ({
  resetToken,
  newPassword,
  confirmPassword,
}) => {
  if (!String(resetToken || "").trim()) {
    throw new ApiError(400, "Password reset token is required.");
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "Password confirmation does not match.");
  }

  if (!validatePasswordStrength(newPassword || "")) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    );
  }
};

const normalizeRegistrationPayload = (payload) => ({
  fullName: String(payload.fullName || payload.name || "").trim(),
  phoneNumber: String(payload.phoneNumber || payload.phone || "").trim(),
  email: String(payload.email || "").trim(),
  password: payload.password || "",
});

const getIdentifierFromPayload = (payload) =>
  String(
    payload.emailOrPhone ||
      payload.email_or_phone ||
      payload.identifier ||
      payload.email ||
      payload.phoneNumber ||
      payload.phone ||
      "",
  ).trim();

const resolveUserByIdentifier = async (identifier) => {
  const trimmedIdentifier = String(identifier || "").trim();

  if (!trimmedIdentifier) {
    throw new ApiError(400, "Email or phone number is required.");
  }

  if (isValidEmail(trimmedIdentifier)) {
    const normalizedEmail = normalizeEmail(trimmedIdentifier);
    return {
      lookupIdentifier: normalizedEmail,
      otpIdentifier: normalizedEmail,
      user: await findUserByEmail(normalizedEmail),
    };
  }

  if (isValidPhoneNumber(trimmedIdentifier)) {
    const user = await findUserByPhone(trimmedIdentifier);
    return {
      lookupIdentifier: trimmedIdentifier,
      otpIdentifier: user?.email ? normalizeEmail(user.email) : trimmedIdentifier,
      user,
    };
  }

  throw new ApiError(400, "Email or phone number format is invalid.");
};

const issueOtpForPurpose = async ({ identifier, purpose }) => {
  const otp = generateOtp();

  await saveOtpRecord({
    identifier,
    purpose,
    otpHash: createSha256Hash(otp),
    expiresAt: new Date(Date.now() + env.auth.otpExpiryMinutes * 60 * 1000),
  });

  return otp;
};

const validateLoginPayload = ({ identifier, password }) => {
  if (!identifier?.trim()) {
    throw new ApiError(400, "Email or phone number is required.");
  }

  if (!isValidEmail(identifier) && !isValidPhoneNumber(identifier)) {
    throw new ApiError(400, "Email or phone number format is invalid.");
  }

  if (!password) {
    throw new ApiError(400, "Password is required.");
  }
};

const validateProfileUpdatePayload = ({
  fullName,
  phoneNumber,
  deliveryAddress,
  billingDetails,
}) => {
  if (!fullName?.trim()) {
    throw new ApiError(400, "Full name is required.");
  }

  const normalizedPhoneNumber = String(phoneNumber || "").trim();
  if (normalizedPhoneNumber && !isValidPhoneNumber(normalizedPhoneNumber)) {
    throw new ApiError(400, "Phone number format is invalid.");
  }

  const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
  const hasDeliveryAddress = Object.values(normalizedDeliveryAddress).some(Boolean);

  if (hasDeliveryAddress) {
    const hasFormattedOnlyAddress =
      Boolean(normalizedDeliveryAddress.formattedAddress) &&
      !normalizedDeliveryAddress.line1 &&
      !normalizedDeliveryAddress.city &&
      !normalizedDeliveryAddress.state &&
      !normalizedDeliveryAddress.postalCode;

    if (
      !hasFormattedOnlyAddress &&
      (!normalizedDeliveryAddress.line1 ||
        !normalizedDeliveryAddress.city ||
        !normalizedDeliveryAddress.state ||
        !normalizedDeliveryAddress.postalCode)
    ) {
      throw new ApiError(
        400,
        "Complete the main delivery address fields or provide a full formatted address.",
      );
    }

    if (
      normalizedDeliveryAddress.postalCode &&
      !isValidPostalCode(normalizedDeliveryAddress.postalCode)
    ) {
      throw new ApiError(400, "Postal code format is invalid.");
    }
  }

  const normalizedBillingDetails = normalizeBillingDetails(billingDetails);
  const hasBillingDetails = Object.values(normalizedBillingDetails).some(Boolean);

  if (hasBillingDetails) {
    if (!normalizedBillingDetails.name) {
      throw new ApiError(400, "Billing name is required.");
    }

    if (
      !normalizedBillingDetails.contact ||
      !isValidPhoneNumber(normalizedBillingDetails.contact)
    ) {
      throw new ApiError(400, "A valid billing contact number is required.");
    }

    if (!normalizedBillingDetails.address) {
      throw new ApiError(400, "Billing address is required.");
    }

    if (!normalizedBillingDetails.city) {
      throw new ApiError(400, "Billing city is required.");
    }

    if (!normalizedBillingDetails.state) {
      throw new ApiError(400, "Billing state is required.");
    }

    if (
      normalizedBillingDetails.gstin &&
      normalizedBillingDetails.gstin.length !== 15
    ) {
      throw new ApiError(400, "GSTIN must be exactly 15 characters.");
    }
  }

  return {
    fullName: fullName.trim(),
    phoneNumber: normalizedPhoneNumber,
    deliveryAddress: normalizedDeliveryAddress,
    billingDetails: normalizedBillingDetails,
  };
};

const getGoogleIdTokenFromPayload = (payload = {}) =>
  String(payload.idToken || payload.id_token || payload.credential || "").trim();

const assertGoogleTokenClaims = (decodedToken) => {
  const provider = decodedToken.firebase?.sign_in_provider;

  if (provider !== "google.com") {
    throw new ApiError(
      401,
      "Google sign-in must use a Firebase Google provider token.",
    );
  }

  if (env.firebase.projectId) {
    const expectedIssuer = `https://securetoken.google.com/${env.firebase.projectId}`;

    if (decodedToken.aud !== env.firebase.projectId || decodedToken.iss !== expectedIssuer) {
      throw new ApiError(401, "Google ID token audience is invalid.");
    }
  }

  if (
    env.googleAuth.requiredHostedDomain &&
    String(decodedToken.hd || "").trim().toLowerCase() !==
      env.googleAuth.requiredHostedDomain
  ) {
    throw new ApiError(
      403,
      `Google sign-in is restricted to ${env.googleAuth.requiredHostedDomain}.`,
    );
  }
};

const verifyGoogleIdentityToken = async (payload) => {
  const idToken = getGoogleIdTokenFromPayload(payload);

  if (!idToken) {
    throw new ApiError(400, "Google ID token is required.");
  }

  let firebaseAuth;
  try {
    firebaseAuth = initializeFirebase();
  } catch (error) {
    throw new ApiError(503, "Google sign-in is not configured on the server.");
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    assertGoogleTokenClaims(decodedToken);
    return decodedToken;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.code === "auth/id-token-expired") {
      throw new ApiError(401, "Google ID token is expired.");
    }

    if (String(error?.code || "").startsWith("auth/")) {
      throw new ApiError(401, "Google ID token is invalid.");
    }

    throw error;
  }
};

const syncUserFromGoogleIdentity = async (decodedToken) => {
  if (!decodedToken.uid) {
    throw new ApiError(401, "Google ID token is invalid.");
  }

  if (!decodedToken.email || !decodedToken.email_verified) {
    throw new ApiError(400, "Google account email must be verified.");
  }

  const email = normalizeEmail(decodedToken.email);
  const googleUid = decodedToken.uid;
  const userByGoogleUid = await findUserByGoogleUid(googleUid);
  const userByEmail = await findUserByEmail(email);

  if (userByGoogleUid && userByEmail && userByGoogleUid.id !== userByEmail.id) {
    throw new ApiError(
      409,
      "This Google account cannot be linked because the email is already used by another user.",
    );
  }

  if (userByEmail && userByEmail.googleUid && userByEmail.googleUid !== googleUid) {
    throw new ApiError(
      409,
      "This email is already linked to a different Google account.",
    );
  }

  let user = userByGoogleUid || userByEmail;

  if (user) {
    const updates = {
      fullName: decodedToken.name || user.fullName,
      profileImage: decodedToken.picture || user.profileImage,
      googleUid,
      authProvider: deriveAuthProvider({
        passwordHash: user.passwordHash,
        googleUid,
      }),
      isVerified: true,
    };

    if (
      userByGoogleUid &&
      user.email !== email &&
      (!userByEmail || userByEmail.id === user.id)
    ) {
      updates.email = email;
    }

    user = await updateUser(user.id, updates);
    return user;
  }

  return createUser({
    fullName: decodedToken.name || email.split("@")[0],
    email,
    authProvider: "google",
    googleUid,
    profileImage: decodedToken.picture || null,
    isVerified: true,
  });
};

const createSessionBundle = async (user, sessionMeta) => {
  const session = await createSession({
    userId: user.id,
    expiresAt: new Date(Date.now() + env.auth.refreshTokenMaxAgeMs),
    ipAddress: sessionMeta.ipAddress,
    userAgent: sessionMeta.userAgent,
  });

  const refreshToken = signRefreshToken({
    sessionId: session.id,
    userId: user.id,
  });
  const accessToken = signAccessToken(user);

  await updateSession(session.id, {
    tokenHash: createSha256Hash(refreshToken),
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    user: sanitizeUser(user),
  };
};

const assertOtpIsValid = async (identifier, purpose, otp) => {
  const record = await findOtpRecord(identifier, purpose);

  if (!record) {
    throw new ApiError(400, "OTP is invalid or expired.");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await clearOtpRecord(identifier, purpose);
    throw new ApiError(400, "OTP is invalid or expired.");
  }

  if (record.attempts >= env.auth.otpMaxAttempts) {
    await clearOtpRecord(identifier, purpose);
    throw new ApiError(429, "OTP verification attempt limit reached.");
  }

  if (record.otpHash !== createSha256Hash(otp)) {
    const nextRecord = await incrementOtpAttempts(identifier, purpose);
    if (nextRecord?.attempts >= env.auth.otpMaxAttempts) {
      await clearOtpRecord(identifier, purpose);
    }
    throw new ApiError(400, "OTP is invalid or expired.");
  }

  return record;
};

const sendOtpEmailOrThrow = async ({
  to,
  customerName,
  otp,
  purpose,
  expiresInMinutes,
}) => {
  try {
    await sendOtpEmail({
      to,
      customerName,
      otp,
      purpose,
      expiresInMinutes,
    });
  } catch (error) {
    console.error(`[Mailer] Failed to send ${purpose} OTP to ${to}.`, error);
    throw new ApiError(
      503,
      "We could not send the OTP right now. Please try again in a moment.",
    );
  }
};

const getDevOtpPayload = (otp) =>
  env.auth.exposeDevOtp ? { devOtp: otp } : {};

const registerManualUser = async (payload, sessionMeta) => {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  validateRegistrationPayload(normalizedPayload);

  const email = normalizeEmail(normalizedPayload.email);
  const existingUser = await findUserByEmail(email);
  const existingPhoneUser = await findUserByPhone(normalizedPayload.phoneNumber);

  if (existingUser || existingPhoneUser) {
    throw new ApiError(
      409,
      "An account with this email or phone number already exists.",
    );
  }

  const user = await createUser({
    fullName: normalizedPayload.fullName,
    phoneNumber: normalizedPayload.phoneNumber,
    email,
    passwordHash: await hashPassword(normalizedPayload.password),
    authProvider: "local",
    isVerified: false,
  });

  const otp = await issueOtpForPurpose({
    identifier: user.email,
    purpose: OTP_PURPOSES.registration,
  });

  await sendOtpEmailOrThrow({
    to: user.email,
    customerName: user.fullName,
    otp,
    purpose: "email verification",
    expiresInMinutes: env.auth.otpExpiryMinutes,
  });

  console.info(`[Auth OTP] Registration code for ${user.email}: ${otp}`);

  return {
    message: "OTP sent for verification.",
    ...getDevOtpPayload(otp),
  };
};

const verifyRegistrationOtp = async (payload, sessionMeta) => {
  const identifier = getIdentifierFromPayload(payload);
  validateOtpPayload({ identifier, otp: payload.otp });

  const { otpIdentifier, user } = await resolveUserByIdentifier(identifier);

  if (!user || user.authProvider !== "local") {
    throw new ApiError(400, "Account not found for OTP verification.");
  }

  if (user.isVerified) {
    return createSessionBundle(user, sessionMeta);
  }

  await assertOtpIsValid(
    otpIdentifier,
    OTP_PURPOSES.registration,
    payload.otp.trim(),
  );
  const verifiedUser = await updateUser(user.id, { isVerified: true });
  await clearOtpRecord(otpIdentifier, OTP_PURPOSES.registration);

  return createSessionBundle(verifiedUser, sessionMeta);
};

const loginManualUser = async (payload, sessionMeta) => {
  const identifier = getIdentifierFromPayload(payload);
  validateLoginPayload({ identifier, password: payload.password });

  const lookup = await resolveUserByIdentifier(identifier);
  const user = lookup.user;

  if (!user || !user.passwordHash) {
    console.warn(`Failed login attempt for ${lookup.lookupIdentifier}.`);
    throw new ApiError(401, "Email or password is incorrect.");
  }

  if (user.authProvider === "local" && !user.isVerified) {
    throw new ApiError(403, "Verify your account before logging in.");
  }

  const isPasswordValid = await comparePassword(payload.password, user.passwordHash);
  if (!isPasswordValid) {
    console.warn(`Failed login attempt for ${lookup.lookupIdentifier}.`);
    throw new ApiError(401, "Email or password is incorrect.");
  }

  return createSessionBundle(user, sessionMeta);
};

const loginWithGoogle = async (payload, sessionMeta) => {
  const decodedToken = await verifyGoogleIdentityToken(payload);
  const user = await syncUserFromGoogleIdentity(decodedToken);
  return createSessionBundle(user, sessionMeta);
};

const refreshAuthSession = async (refreshToken, sessionMeta) => {
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is missing.");
  }

  const payload = verifyRefreshToken(refreshToken);
  const session = await findSessionById(payload.sid);

  if (!session || session.userId !== payload.sub) {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  if (session.revokedAt) {
    await revokeAllSessionsForUser(session.userId, "Refresh token reuse detected.");
    throw new ApiError(401, "Refresh token reuse detected. Please log in again.");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await revokeSession(session.id, "Refresh token expired.");
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  if (session.tokenHash !== createSha256Hash(refreshToken)) {
    await revokeAllSessionsForUser(session.userId, "Refresh token hash mismatch.");
    throw new ApiError(401, "Refresh token reuse detected. Please log in again.");
  }

  const user = await findUserById(session.userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const nextBundle = await createSessionBundle(user, sessionMeta);
  await updateSession(session.id, {
    revokedAt: new Date(),
    revokeReason: "Rotated on refresh.",
    replacedBySessionId: nextBundle.sessionId,
  });

  return nextBundle;
};

const logoutUser = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  const session = await findSessionById(payload.sid);

  if (session && !session.revokedAt) {
    await revokeSession(session.id, "Logged out.");
  }
};

const getCurrentUser = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  return sanitizeUser(user);
};

const updateCurrentUserProfile = async (userId, payload) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const nextProfile = validateProfileUpdatePayload(payload);
  const updatedUser = await updateUser(userId, nextProfile);

  return sanitizeUser(updatedUser);
};

const requestPasswordReset = async (payload) => {
  const identifier = getIdentifierFromPayload(payload);
  const { otpIdentifier, user } = await resolveUserByIdentifier(identifier);

  if (!user) {
    throw new ApiError(404, "No account found for this email or phone number.");
  }

  if (!user.email) {
    throw new ApiError(
      400,
      "This account does not have an email address available for OTP delivery.",
    );
  }

  const otp = await issueOtpForPurpose({
    identifier: otpIdentifier,
    purpose: OTP_PURPOSES.passwordReset,
  });

  const { hasPasswordLogin, hasGoogleLogin } = getUserAuthMethods(user);

  await sendOtpEmailOrThrow({
    to: user.email,
    customerName: user.fullName,
    otp,
    purpose: hasPasswordLogin ? "password reset" : "password setup",
    expiresInMinutes: env.auth.otpExpiryMinutes,
  });

  console.info(`[Auth OTP] Password reset code for ${otpIdentifier}: ${otp}`);

  return {
    message: hasPasswordLogin
      ? "Password reset OTP sent to your email."
      : hasGoogleLogin
        ? "OTP sent to your email. Verify it to set a password for this Google account."
        : "OTP sent to your email.",
    ...getDevOtpPayload(otp),
    data: {
      authProvider: user.authProvider,
      authMethods: getUserAuthMethods(user),
    },
  };
};

const verifyPasswordResetOtp = async (payload) => {
  const identifier = getIdentifierFromPayload(payload);
  validateOtpPayload({ identifier, otp: payload.otp });

  const { otpIdentifier, user } = await resolveUserByIdentifier(identifier);

  if (!user) {
    throw new ApiError(404, "No account found for this email or phone number.");
  }

  await assertOtpIsValid(
    otpIdentifier,
    OTP_PURPOSES.passwordReset,
    payload.otp.trim(),
  );
  await clearOtpRecord(otpIdentifier, OTP_PURPOSES.passwordReset);

  const resetToken = signPasswordResetToken({
    userId: user.id,
    identifier: otpIdentifier,
  });

  return {
    message: "OTP verified successfully.",
    data: {
      resetToken,
      expiresIn: env.auth.passwordResetTokenTtl,
    },
  };
};

const resetPassword = async (payload) => {
  validatePasswordResetPayload({
    resetToken: payload.resetToken,
    newPassword: payload.newPassword,
    confirmPassword: payload.confirmPassword,
  });

  const decodedToken = verifyPasswordResetToken(String(payload.resetToken).trim());
  const user = await findUserById(decodedToken.sub);

  if (!user) {
    throw new ApiError(404, "Account not found.");
  }

  const expectedIdentifier = user.email ? normalizeEmail(user.email) : "";
  if (!expectedIdentifier || decodedToken.identifier !== expectedIdentifier) {
    throw new ApiError(401, "Password reset token is invalid or expired.");
  }

  const hadPasswordLogin = Boolean(user.passwordHash);
  const passwordHash = await hashPassword(payload.newPassword);
  await updateUser(user.id, {
    passwordHash,
    authProvider: deriveAuthProvider({
      passwordHash,
      googleUid: user.googleUid,
    }),
    isVerified: true,
  });
  await clearOtpRecord(expectedIdentifier, OTP_PURPOSES.passwordReset);
  await revokeAllSessionsForUser(user.id, "Password reset completed.");

  return {
    message: hadPasswordLogin
      ? "Password updated successfully. Please log in again."
      : "Password set successfully. You can now log in with your email and password.",
  };
};

module.exports = {
  getCurrentUser,
  loginManualUser,
  loginWithGoogle,
  logoutUser,
  refreshAuthSession,
  registerManualUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUserProfile,
  verifyRegistrationOtp,
  verifyPasswordResetOtp,
};
