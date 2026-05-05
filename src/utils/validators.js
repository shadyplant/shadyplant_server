const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidPhoneNumber = (phoneNumber) =>
  /^[0-9+\-()\s]{7,20}$/.test(String(phoneNumber || "").trim());

const isValidPostalCode = (postalCode) =>
  /^[A-Za-z0-9\s-]{4,12}$/.test(String(postalCode || "").trim());

module.exports = {
  isValidEmail,
  isValidPhoneNumber,
  isValidPostalCode,
  normalizeEmail,
};
