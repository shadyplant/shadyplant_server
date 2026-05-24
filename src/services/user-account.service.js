const { ApiError } = require("../utils/apiError");

const CUSTOMER_CATEGORIES = {
  normal: "normal",
  nurseryOwner: "nursery_owner",
  gardenContractor: "garden_contractor",
};

const USER_ACCOUNT_STATUSES = {
  active: "active",
  bannedTemporary: "banned_temporary",
  bannedPermanent: "banned_permanent",
};

const DEFAULT_PAYMENT_ACCESS = {
  cashOnDelivery: true,
  onlinePayment: true,
  emi: false,
};

const PAYMENT_METHODS = {
  cashOnDelivery: "cash_on_delivery",
  onlinePayment: "online_payment",
  emi: "emi",
};

const normalizeCustomerCategory = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (Object.values(CUSTOMER_CATEGORIES).includes(normalizedValue)) {
    return normalizedValue;
  }

  return CUSTOMER_CATEGORIES.normal;
};

const normalizeUserAccountStatus = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (Object.values(USER_ACCOUNT_STATUSES).includes(normalizedValue)) {
    return normalizedValue;
  }

  return USER_ACCOUNT_STATUSES.active;
};

const resolveEffectiveUserAccountStatus = (user = {}) => {
  const accountStatus = normalizeUserAccountStatus(user.accountStatus);

  if (accountStatus !== USER_ACCOUNT_STATUSES.bannedTemporary) {
    return accountStatus;
  }

  const bannedUntil = user.bannedUntil ? new Date(user.bannedUntil) : null;

  if (!bannedUntil || Number.isNaN(bannedUntil.getTime())) {
    return USER_ACCOUNT_STATUSES.active;
  }

  return bannedUntil.getTime() > Date.now()
    ? USER_ACCOUNT_STATUSES.bannedTemporary
    : USER_ACCOUNT_STATUSES.active;
};

const assertUserAccountIsActive = (user = {}) => {
  const effectiveStatus = resolveEffectiveUserAccountStatus(user);

  if (effectiveStatus === USER_ACCOUNT_STATUSES.bannedPermanent) {
    throw new ApiError(
      403,
      "This account has been permanently blocked. Contact support for assistance.",
    );
  }

  if (effectiveStatus === USER_ACCOUNT_STATUSES.bannedTemporary) {
    throw new ApiError(
      403,
      "This account is temporarily blocked right now. Please contact support or try again later.",
    );
  }

  return true;
};

const normalizeUserPaymentAccess = (value = {}) => ({
  cashOnDelivery:
    value.cashOnDelivery !== undefined
      ? Boolean(value.cashOnDelivery)
      : DEFAULT_PAYMENT_ACCESS.cashOnDelivery,
  onlinePayment:
    value.onlinePayment !== undefined
      ? Boolean(value.onlinePayment)
      : DEFAULT_PAYMENT_ACCESS.onlinePayment,
  emi: value.emi !== undefined ? Boolean(value.emi) : DEFAULT_PAYMENT_ACCESS.emi,
});

const resolveUserPaymentAccess = (user = {}) =>
  normalizeUserPaymentAccess(user.paymentAccess || {});

const assertUserCanUsePaymentMethod = (user = {}, paymentMethod = "") => {
  const paymentAccess = resolveUserPaymentAccess(user);
  const normalizedPaymentMethod = String(paymentMethod || "").trim().toLowerCase();

  if (
    normalizedPaymentMethod === PAYMENT_METHODS.cashOnDelivery &&
    !paymentAccess.cashOnDelivery
  ) {
    throw new ApiError(
      403,
      "Cash on delivery is not available for this customer account.",
    );
  }

  if (
    normalizedPaymentMethod === PAYMENT_METHODS.onlinePayment &&
    !paymentAccess.onlinePayment
  ) {
    throw new ApiError(
      403,
      "Online payment is not available for this customer account.",
    );
  }

  if (normalizedPaymentMethod === PAYMENT_METHODS.emi && !paymentAccess.emi) {
    throw new ApiError(403, "EMI is not available for this customer account.");
  }

  return paymentAccess;
};

module.exports = {
  DEFAULT_PAYMENT_ACCESS,
  CUSTOMER_CATEGORIES,
  PAYMENT_METHODS,
  USER_ACCOUNT_STATUSES,
  assertUserAccountIsActive,
  assertUserCanUsePaymentMethod,
  normalizeCustomerCategory,
  normalizeUserPaymentAccess,
  normalizeUserAccountStatus,
  resolveUserPaymentAccess,
  resolveEffectiveUserAccountStatus,
};
