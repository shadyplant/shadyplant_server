const bcrypt = require("bcrypt");

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const validatePasswordStrength = (password) => PASSWORD_RULE.test(password);

const hashPassword = async (password) => bcrypt.hash(password, 12);

const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

module.exports = {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
};
