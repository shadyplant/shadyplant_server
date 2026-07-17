const {
  calculateTransportChargeForProfile,
} = require("./delivery-charge");

const calculateTransportChargeForNorthEast = (weight, distance) =>
  calculateTransportChargeForProfile("north_east", weight, distance);

module.exports = {
  calculateTransportChargeForNorthEast,
};
