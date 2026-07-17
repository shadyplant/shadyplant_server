const {
  calculateTransportChargeForProfileCode,
} = require("../services/delivery-charge.service");

const calculateTransportChargeForProfile = (profileCode, weight, distance) =>
  calculateTransportChargeForProfileCode(profileCode, weight, distance);

module.exports = {
  calculateTransportChargeForProfile,
};
