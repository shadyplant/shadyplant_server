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
const {
  clearPendingRegistration,
  findPendingRegistration,
  savePendingRegistration,
} = require("../repositories/pending-registration.repository");
const {
  clearFailedLoginAttempts,
  getLockoutState,
  recordFailedLoginAttempt,
} = require("../repositories/login-attempt.repository");
const { initializeFirebase } = require("../config/firebase");
const { env } = require("../config/env");
const { OAuth2Client } = require("google-auth-library");
const { sendGreetingEmail, sendOtpEmail } = require("../mailer");
const { addBrevoWelcomeContact } = require("./brevo.service");
const { registerPushDeviceToken } = require("./push-device.service");
const { ApiError } = require("../utils/apiError");
const { createSha256Hash, generateId, generateOtp } = require("../utils/crypto");
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
const {
  assertUserAccountIsActive,
  resolveUserPaymentAccess,
} = require("./user-account.service");
const googleOAuthClient = new OAuth2Client();

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
  isVip: Boolean(user.isVip),
  paymentAccess: resolveUserPaymentAccess(user),
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

const getAccountLockoutMessage = (retryAfterSeconds) => {
  const retryAfterMinutes = Math.max(
    1,
    Math.ceil(Number(retryAfterSeconds || 0) / 60),
  );

  return `Too many failed login attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`;
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

  const hasDeliveryAddressField = deliveryAddress !== undefined;
  const normalizedDeliveryAddress = hasDeliveryAddressField
    ? normalizeDeliveryAddress(deliveryAddress)
    : null;
  const hasDeliveryAddress =
    normalizedDeliveryAddress &&
    Object.values(normalizedDeliveryAddress).some(Boolean);

  if (hasDeliveryAddress) {
    const hasFormattedAddress = Boolean(normalizedDeliveryAddress.formattedAddress);
    const hasCompleteStructuredAddress = Boolean(
      normalizedDeliveryAddress.line1 &&
        normalizedDeliveryAddress.city &&
        normalizedDeliveryAddress.state &&
        normalizedDeliveryAddress.postalCode,
    );

    // Checkout and location pickers may provide a reliable formatted address
    // without every structured field, especially postal code. Accept that for
    // profile persistence and only require the full structured set when there
    // is no formatted address to fall back to.
    if (!hasFormattedAddress && !hasCompleteStructuredAddress) {
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

  const hasBillingDetailsField = billingDetails !== undefined;
  const normalizedBillingDetails = hasBillingDetailsField
    ? normalizeBillingDetails(billingDetails)
    : null;
  const hasBillingDetails =
    normalizedBillingDetails &&
    Object.values(normalizedBillingDetails).some(Boolean);

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

  const nextProfile = {
    fullName: fullName.trim(),
    phoneNumber: normalizedPhoneNumber,
  };

  if (hasDeliveryAddressField) {
    nextProfile.deliveryAddress = normalizedDeliveryAddress;
  }

  if (hasBillingDetailsField) {
    nextProfile.billingDetails = normalizedBillingDetails;
  }

  return nextProfile;
};

const getGoogleIdTokenFromPayload = (payload = {}) =>
  String(payload.idToken || payload.id_token || payload.credential || "").trim();

const decodeJwtPayload = (token) => {
  const parts = String(token || "").trim().split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const assertFirebaseGoogleTokenClaims = (decodedToken) => {
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

const assertNativeGoogleTokenClaims = (decodedToken) => {
  const audience = String(decodedToken.aud || "").trim();
  const issuer = String(decodedToken.iss || "").trim();

  if (!env.googleAuth.hasConfiguredClientIds) {
    throw new ApiError(
      503,
      "Google sign-in is not configured on the server. Set GOOGLE_AUTH_CLIENT_IDS.",
    );
  }

  if (!env.googleAuth.clientIds.includes(audience)) {
    throw new ApiError(401, "Google ID token audience is invalid.");
  }

  if (!["accounts.google.com", "https://accounts.google.com"].includes(issuer)) {
    throw new ApiError(401, "Google ID token issuer is invalid.");
  }
};

const verifyGoogleIdentityToken = async (payload) => {
  const idToken = getGoogleIdTokenFromPayload(payload);

  if (!idToken) {
    throw new ApiError(400, "Google ID token is required.");
  }

  const unverifiedPayload = decodeJwtPayload(idToken);
  const unverifiedAudience = String(unverifiedPayload?.aud || "").trim();
  const looksLikeNativeGoogleToken = env.googleAuth.clientIds.includes(
    unverifiedAudience,
  );
  const looksLikeFirebaseToken =
    Boolean(env.firebase.projectId) &&
    unverifiedAudience === env.firebase.projectId;

  let firebaseAuth = null;
  if (!looksLikeNativeGoogleToken || looksLikeFirebaseToken) {
    try {
      firebaseAuth = initializeFirebase();
    } catch {
      firebaseAuth = null;
    }
  }

  let nativeGoogleError = null;
  let firebaseError = null;

  if (looksLikeNativeGoogleToken) {
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: env.googleAuth.clientIds,
      });
      const decodedToken = ticket.getPayload();

      if (!decodedToken) {
        throw new ApiError(401, "Google ID token is invalid.");
      }

      assertNativeGoogleTokenClaims(decodedToken);
      return { decodedToken, tokenSource: "google-oauth" };
    } catch (error) {
      nativeGoogleError = error;
    }
  }

  if (firebaseAuth) {
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
      assertFirebaseGoogleTokenClaims(decodedToken);
      return { decodedToken, tokenSource: "firebase" };
    } catch (error) {
      firebaseError = error;
    }
  }

  if (nativeGoogleError instanceof ApiError) {
    throw nativeGoogleError;
  }

  if (nativeGoogleError?.code === "auth/id-token-expired" || firebaseError?.code === "auth/id-token-expired") {
    throw new ApiError(401, "Google ID token is expired.");
  }

  if (firebaseError instanceof ApiError) {
    throw firebaseError;
  }

  if (nativeGoogleError?.code === "invalid_token" || nativeGoogleError?.code === "GoogleIdTokenError") {
    throw new ApiError(401, "Google ID token is invalid.");
  }

  if (firebaseError?.code === "auth/argument-error" || String(firebaseError?.code || "").startsWith("auth/")) {
    throw new ApiError(401, "Google ID token is invalid.");
  }

  if (looksLikeNativeGoogleToken && !env.googleAuth.hasConfiguredClientIds) {
    throw new ApiError(
      503,
      "Google sign-in is not configured on the server. Set GOOGLE_AUTH_CLIENT_IDS.",
    );
  }

  if (nativeGoogleError) {
    throw nativeGoogleError;
  }

  if (firebaseError) {
    throw firebaseError;
  }

  throw new ApiError(401, "Google ID token is invalid.");
};

const syncUserFromGoogleIdentity = async (decodedToken) => {
  const googleUid = String(
    decodedToken.sub || decodedToken.user_id || decodedToken.uid || "",
  ).trim();

  if (!googleUid) {
    throw new ApiError(401, "Google ID token is invalid.");
  }

  if (!decodedToken.email || !decodedToken.email_verified) {
    throw new ApiError(400, "Google account email must be verified.");
  }

  const email = normalizeEmail(decodedToken.email);
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

  const createdUser = await createUser({
    fullName: decodedToken.name || email.split("@")[0],
    email,
    authProvider: "google",
    googleUid,
    profileImage: decodedToken.picture || null,
    isVerified: true,
  });

  // await addBrevoWelcomeContact({
  //   id: createdUser.id,
  //   email: createdUser.email,
  //   fullName: createdUser.fullName,
  // });

  await sendWelcomeEmailBestEffort({
    to: createdUser.email,
    customerName: createdUser.fullName,
    source: "google-signin",
  });

  return createdUser;
};

const createSessionBundle = async (user, sessionMeta) => {
  assertUserAccountIsActive(user);

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

const logOtpForDevelopment = (label, identifier, otp) => {
  if (!env.auth.exposeDevOtp) {
    return;
  }

  console.info(`[Auth OTP] ${label} code for ${identifier}: ${otp}`);
};

const sendWelcomeEmailBestEffort = async ({ to, customerName, source }) => {
  console.info("[Mailer] Sending native welcome email", {
    to,
    source,
  });

  try {
    const result = await sendGreetingEmail({
      to,
      customerName,
      source,
    });

    console.info("[Mailer] Native welcome email finished", {
      to,
      source,
      skipped: Boolean(result?.skipped),
      delivered: Boolean(result?.delivered),
      transport: result?.transport || env.mailer.transport,
    });

    return result;
  } catch (error) {
    console.error("[Mailer] Native welcome email failed", {
      to,
      source,
      message: error?.message || String(error),
      stack: error?.stack || null,
    });

    return null;
  }
};

const getRegistrationTokenFromPayload = (payload = {}) =>
  String(
    payload.registrationToken ||
      payload.registration_token ||
      payload.signupToken ||
      payload.signup_token ||
      "",
  ).trim();

const registerManualUser = async (payload, sessionMeta) => {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  validateRegistrationPayload(normalizedPayload);

  const email = normalizeEmail(normalizedPayload.email);
  const existingUser = await findUserByEmail(email);
  const existingPhoneUser = await findUserByPhone(normalizedPayload.phoneNumber);
  const existingAccount = existingUser || existingPhoneUser;

  if (existingAccount) {
    if (
      existingAccount.authProvider === "local" &&
      !existingAccount.isVerified &&
      existingAccount.email
    ) {
      const otp = await issueOtpForPurpose({
        identifier: normalizeEmail(existingAccount.email),
        purpose: OTP_PURPOSES.registration,
      });

      await sendOtpEmailOrThrow({
        to: existingAccount.email,
        customerName: existingAccount.fullName,
        otp,
        purpose: "email verification",
        expiresInMinutes: env.auth.otpExpiryMinutes,
      });

      logOtpForDevelopment("Registration", existingAccount.email, otp);

      return {
        message: "If the account can be registered, an OTP will be sent for verification.",
        data: {
          email: existingAccount.email,
          expiresInMinutes: env.auth.otpExpiryMinutes,
        },
        ...getDevOtpPayload(otp),
      };
    }

    throw new ApiError(
      409,
      "An account with this email or phone number already exists.",
    );
  }

  const registrationToken = generateId();
  const passwordHash = await hashPassword(normalizedPayload.password);
  const expiresAt = new Date(Date.now() + env.auth.otpExpiryMinutes * 60 * 1000);

  await savePendingRegistration({
    token: registrationToken,
    fullName: normalizedPayload.fullName,
    email,
    phoneNumber: normalizedPayload.phoneNumber,
    passwordHash,
    expiresAt,
  });

  console.info("[Auth] registration pending signup created", {
    email,
    token: registrationToken.slice(0, 8),
    expiresInMinutes: env.auth.otpExpiryMinutes,
  });

  const otp = await issueOtpForPurpose({
    identifier: registrationToken,
    purpose: OTP_PURPOSES.registration,
  });

  await sendOtpEmailOrThrow({
    to: email,
    customerName: normalizedPayload.fullName,
    otp,
    purpose: "email verification",
    expiresInMinutes: env.auth.otpExpiryMinutes,
  });

  console.info("[Auth] registration verification email sent", {
    email,
    token: registrationToken.slice(0, 8),
    transport: env.mailer.transport,
  });

  logOtpForDevelopment("Registration", email, otp);

  return {
    message: "If the account can be registered, an OTP will be sent for verification.",
    data: {
      registrationToken,
      email,
      expiresInMinutes: env.auth.otpExpiryMinutes,
    },
    ...getDevOtpPayload(otp),
  };
};

const resendRegistrationOtp = async (payload = {}) => {
  const registrationToken = getRegistrationTokenFromPayload(payload);
  const identifier = getIdentifierFromPayload(payload);

  console.info("[Auth] resendRegistrationOtp called", {
    hasRegistrationToken: Boolean(registrationToken),
    registrationToken: registrationToken ? registrationToken.slice(0, 8) : "",
    identifier: identifier ? String(identifier).trim() : "",
    hasIdentifier: Boolean(String(identifier || "").trim()),
  });

  if (registrationToken) {
    const pendingRegistration = await findPendingRegistration(registrationToken);

    console.info("[Auth] resendRegistrationOtp pending registration lookup", {
      found: Boolean(pendingRegistration),
      token: registrationToken.slice(0, 8),
    });

    if (!pendingRegistration) {
      throw new ApiError(
        400,
        "Registration session expired. Please sign up again.",
      );
    }

    console.info("[Auth] resendRegistrationOtp using pending signup", {
      email: pendingRegistration.email,
      token: registrationToken.slice(0, 8),
    });

    const otp = await issueOtpForPurpose({
      identifier: registrationToken,
      purpose: OTP_PURPOSES.registration,
    });

    await sendOtpEmailOrThrow({
      to: pendingRegistration.email,
      customerName: pendingRegistration.fullName,
      otp,
      purpose: "email verification",
      expiresInMinutes: env.auth.otpExpiryMinutes,
    });

    console.info("[Auth] resendRegistrationOtp email send complete", {
      identifier: pendingRegistration.email,
      transport: env.mailer.transport,
    });

    logOtpForDevelopment("Registration", pendingRegistration.email, otp);

    return {
      message: "If the account can be registered, an OTP will be sent for verification.",
      data: {
        registrationToken,
        email: pendingRegistration.email,
        expiresInMinutes: env.auth.otpExpiryMinutes,
      },
      ...getDevOtpPayload(otp),
    };
  }

  if (!identifier || !isValidEmail(identifier)) {
    console.warn("[Auth] resendRegistrationOtp rejected invalid identifier", {
      identifier: String(identifier || "").trim(),
    });
    throw new ApiError(400, "Registration session expired. Please sign up again.");
  }

  const normalizedEmail = normalizeEmail(identifier);
  const existingAccount = await findUserByEmail(normalizedEmail);

  console.info("[Auth] resendRegistrationOtp legacy lookup result", {
    identifier: normalizedEmail,
    found: Boolean(existingAccount),
    authProvider: existingAccount?.authProvider || null,
    isVerified: Boolean(existingAccount?.isVerified),
    hasEmail: Boolean(existingAccount?.email),
  });

  if (
    existingAccount &&
    existingAccount.authProvider === "local" &&
    !existingAccount.isVerified &&
    existingAccount.email
  ) {
    const otp = await issueOtpForPurpose({
      identifier: normalizeEmail(existingAccount.email),
      purpose: OTP_PURPOSES.registration,
    });

    await sendOtpEmailOrThrow({
      to: existingAccount.email,
      customerName: existingAccount.fullName,
      otp,
      purpose: "email verification",
      expiresInMinutes: env.auth.otpExpiryMinutes,
    });

    logOtpForDevelopment("Registration", existingAccount.email, otp);

    return {
      message: "If the account can be registered, an OTP will be sent for verification.",
      data: {
        email: existingAccount.email,
        expiresInMinutes: env.auth.otpExpiryMinutes,
      },
      ...getDevOtpPayload(otp),
    };
  }

  throw new ApiError(400, "Registration session expired. Please sign up again.");
};

const verifyRegistrationOtp = async (payload, sessionMeta) => {
  const registrationToken = getRegistrationTokenFromPayload(payload);
  const identifier = getIdentifierFromPayload(payload);
  if (registrationToken) {
    if (!String(payload.otp || "").trim()) {
      throw new ApiError(400, "OTP is required.");
    }
  } else {
    validateOtpPayload({
      identifier,
      otp: payload.otp,
    });
  }

  if (registrationToken) {
    const pendingRegistration = await findPendingRegistration(registrationToken);

    if (!pendingRegistration) {
      throw new ApiError(
        400,
        "Registration session expired. Please sign up again.",
      );
    }

    console.info("[Auth] verifyRegistrationOtp using pending signup", {
      email: pendingRegistration.email,
      token: registrationToken.slice(0, 8),
    });

    await assertOtpIsValid(
      registrationToken,
      OTP_PURPOSES.registration,
      payload.otp.trim(),
    );

    const email = normalizeEmail(pendingRegistration.email);
    const existingUser = await findUserByEmail(email);
    const existingPhoneUser = await findUserByPhone(pendingRegistration.phoneNumber);
    const existingAccount = existingUser || existingPhoneUser;

    let user;

    if (existingAccount) {
      if (existingAccount.isVerified) {
        await clearOtpRecord(registrationToken, OTP_PURPOSES.registration);
        await clearPendingRegistration(registrationToken);
        return createSessionBundle(existingAccount, sessionMeta);
      }

      if (existingAccount.authProvider !== "local") {
        throw new ApiError(
          409,
          "An account with this email or phone number already exists.",
        );
      }

      user = await updateUser(existingAccount.id, {
        fullName: pendingRegistration.fullName,
        phoneNumber: pendingRegistration.phoneNumber,
        passwordHash: pendingRegistration.passwordHash,
        authProvider: "local",
        isVerified: true,
      });
    } else {
      user = await createUser({
        fullName: pendingRegistration.fullName,
        phoneNumber: pendingRegistration.phoneNumber,
        email,
        passwordHash: pendingRegistration.passwordHash,
        authProvider: "local",
        isVerified: true,
      });
    }

    await sendWelcomeEmailBestEffort({
      to: user.email,
      customerName: user.fullName,
      source: "manual-registration",
    });

    await clearOtpRecord(registrationToken, OTP_PURPOSES.registration);
    await clearPendingRegistration(registrationToken);

    console.info("[Auth] verifyRegistrationOtp pending signup completed", {
      email: user.email,
      token: registrationToken.slice(0, 8),
      userId: user.id,
    });

    return createSessionBundle(user, sessionMeta);
  }

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
  const lockoutState = await getLockoutState("customer", lookup.lookupIdentifier);

  if (lockoutState.isLocked) {
    throw new ApiError(429, getAccountLockoutMessage(lockoutState.retryAfterSeconds));
  }

  const user = lookup.user;

  if (!user || !user.passwordHash) {
    console.warn(`Failed login attempt for ${lookup.lookupIdentifier}.`);
    await recordFailedLoginAttempt("customer", lookup.lookupIdentifier, {
      windowMinutes: env.auth.loginAttemptWindowMinutes,
      maxAttempts: env.auth.loginMaxAttempts,
      lockoutMinutes: env.auth.loginLockoutMinutes,
    });
    throw new ApiError(401, "Email or password is incorrect.");
  }

  if (user.authProvider === "local" && !user.isVerified) {
    throw new ApiError(403, "Verify your account before logging in.");
  }

  assertUserAccountIsActive(user);

  const isPasswordValid = await comparePassword(payload.password, user.passwordHash);
  if (!isPasswordValid) {
    console.warn(`Failed login attempt for ${lookup.lookupIdentifier}.`);
    await recordFailedLoginAttempt("customer", lookup.lookupIdentifier, {
      windowMinutes: env.auth.loginAttemptWindowMinutes,
      maxAttempts: env.auth.loginMaxAttempts,
      lockoutMinutes: env.auth.loginLockoutMinutes,
    });
    throw new ApiError(401, "Email or password is incorrect.");
  }

  await clearFailedLoginAttempts("customer", lookup.lookupIdentifier);
  return createSessionBundle(user, sessionMeta);
};

const loginWithGoogle = async (payload, sessionMeta) => {
  const { decodedToken } = await verifyGoogleIdentityToken(payload);
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

  assertUserAccountIsActive(user);

  const nextBundle = await createSessionBundle(user, sessionMeta);
  await updateSession(session.id, {
    revokedAt: new Date(),
    revokeReason: "Rotated on refresh.",
    replacedBySessionId: nextBundle.sessionId,
  });

  return nextBundle;
};

const getCurrentUserFromRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is missing.");
  }

  const payload = verifyRefreshToken(refreshToken);
  const session = await findSessionById(payload.sid);

  if (!session || session.userId !== payload.sub || session.revokedAt) {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  if (session.tokenHash !== createSha256Hash(refreshToken)) {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  return getCurrentUser(session.userId);
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
  assertUserAccountIsActive(user);
  return sanitizeUser(user);
};

const updateCurrentUserProfile = async (userId, payload) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  assertUserAccountIsActive(user);

  const nextProfile = validateProfileUpdatePayload(payload);

  if (nextProfile.phoneNumber) {
    const existingPhoneUser = await findUserByPhone(nextProfile.phoneNumber);

    if (existingPhoneUser && existingPhoneUser.id !== userId) {
      throw new ApiError(
        409,
        "Phone number is already linked to another account.",
      );
    }
  }

  try {
    const updatedUser = await updateUser(userId, nextProfile);
    return sanitizeUser(updatedUser);
  } catch (error) {
    if (
      error?.code === "23505" &&
      String(error.constraint || "").includes("users_phone_number_unique_idx")
    ) {
      throw new ApiError(
        409,
        "Phone number is already linked to another account.",
      );
    }

    throw error;
  }

};

const registerCurrentUserPushToken = async (userId, payload = {}) => {
  const result = await registerPushDeviceToken({
    userId,
    payload,
  });

  return result;
};

const requestPasswordReset = async (payload) => {
  const identifier = getIdentifierFromPayload(payload);
  const { otpIdentifier, user } = await resolveUserByIdentifier(identifier);

  if (!user) {
    return {
      message:
        "If an account matches that email or phone number, a reset code will be sent.",
      data: {
        accountExists: false,
      },
    };
  }

  if (!user.email) {
    return {
      message:
        "If an account matches that email or phone number, a reset code will be sent.",
      data: {
        accountExists: false,
      },
    };
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

  logOtpForDevelopment("Password reset", otpIdentifier, otp);

  return {
    message:
      "If an account matches that email or phone number, a reset code will be sent.",
    ...getDevOtpPayload(otp),
    data: hasPasswordLogin || hasGoogleLogin
      ? {
          accountExists: true,
          authProvider: user.authProvider,
          authMethods: getUserAuthMethods(user),
        }
      : {
          accountExists: true,
        },
  };
};

const verifyPasswordResetOtp = async (payload) => {
  const identifier = getIdentifierFromPayload(payload);
  validateOtpPayload({ identifier, otp: payload.otp });

  const { otpIdentifier, user } = await resolveUserByIdentifier(identifier);

  if (!user) {
    throw new ApiError(400, "OTP is invalid or expired.");
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
  assertUserAccountIsActive,
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
  registerCurrentUserPushToken,
  updateCurrentUserProfile,
  verifyRegistrationOtp,
  verifyPasswordResetOtp,
};
