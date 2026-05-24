const crypto = require("crypto");

const COUPON_TYPES = {
  adjust: "adjust",
  discount: "discount",
};

const COUPON_STATUSES = {
  active: "active",
  inactive: "inactive",
  used: "used",
  expired: "expired",
};

const COUPON_USAGE_MODES = {
  oneTime: "one_time",
};

const normalizeCouponType = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeCouponStatus = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeCouponCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeWholeAmount = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return NaN;
  }

  return Math.max(0, Math.round(parsedValue));
};

const normalizeDiscountPercent = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return NaN;
  }

  return Number(parsedValue.toFixed(2));
};

const generateCouponCode = (type = COUPON_TYPES.adjust) => {
  const prefix =
    normalizeCouponType(type) === COUPON_TYPES.discount ? "DISC" : "ADJ";
  const randomValue = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 8);

  return `GGN-${prefix}-${randomValue}`;
};

const calculateCouponApplication = ({
  type,
  adjustAmount = 0,
  discountPercent = 0,
  totalProductsPrice = 0,
  totalPayableAmount = 0,
}) => {
  const normalizedProductTotal = Math.max(0, Number(totalProductsPrice || 0));
  const normalizedTotalPayable = Math.max(0, Number(totalPayableAmount || 0));

  if (normalizeCouponType(type) === COUPON_TYPES.adjust) {
    const discountValue = Math.min(
      normalizedTotalPayable,
      Math.max(0, Number(adjustAmount || 0)),
    );

    return {
      appliesTo: "total_payable",
      discountValue: Number(discountValue.toFixed(2)),
      adjustedProductTotal: Number(normalizedProductTotal.toFixed(2)),
      adjustedTotalPayable: Number(
        Math.max(0, normalizedTotalPayable - discountValue).toFixed(2),
      ),
    };
  }

  const rawDiscountValue =
    normalizedProductTotal * (Math.max(0, Number(discountPercent || 0)) / 100);
  const discountValue = Math.min(normalizedProductTotal, rawDiscountValue);

  return {
    appliesTo: "product_total",
    discountValue: Number(discountValue.toFixed(2)),
    adjustedProductTotal: Number(
      Math.max(0, normalizedProductTotal - discountValue).toFixed(2),
    ),
    adjustedTotalPayable: Number(
      Math.max(0, normalizedTotalPayable - discountValue).toFixed(2),
    ),
  };
};

const resolveCouponEffectiveStatus = (coupon) => {
  const redeemedCount = Math.max(0, Number(coupon?.totalUsesRedeemed || 0));
  const allowedCount = Math.max(1, Number(coupon?.totalUsesAllowed || 1));

  if (redeemedCount >= allowedCount) {
    return COUPON_STATUSES.used;
  }

  const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt) : null;

  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return COUPON_STATUSES.expired;
  }

  const normalizedStatus = normalizeCouponStatus(coupon?.status);
  return Object.values(COUPON_STATUSES).includes(normalizedStatus)
    ? normalizedStatus
    : COUPON_STATUSES.inactive;
};

module.exports = {
  COUPON_STATUSES,
  COUPON_TYPES,
  COUPON_USAGE_MODES,
  calculateCouponApplication,
  generateCouponCode,
  normalizeCouponCode,
  normalizeCouponStatus,
  normalizeCouponType,
  normalizeDiscountPercent,
  normalizeWholeAmount,
  resolveCouponEffectiveStatus,
};
