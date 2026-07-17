const {
  calculateTransportChargeForProfile,
} = require("./delivery-charge");

const calculateTransportChargeForPanIndia = (weight, distance) =>
  calculateTransportChargeForProfile("pan_india", weight, distance);

module.exports = {
  calculateTransportChargeForPanIndia,
};
