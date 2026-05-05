const crypto = require("crypto");

const createSha256Hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const generateId = () => crypto.randomUUID();

const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString().padStart(6, "0");

module.exports = {
  createSha256Hash,
  generateId,
  generateOtp,
};
