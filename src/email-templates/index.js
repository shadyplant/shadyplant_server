const { renderGreetingsTemplate } = require("./greetings.template");
const { renderOrderStatusTemplate } = require("./order-status.template");
const { renderOffersTemplate } = require("./offers.template");
const { renderOtpTemplate } = require("./otp.template");

const templateRenderers = {
  greetings: renderGreetingsTemplate,
  orderStatus: renderOrderStatusTemplate,
  offers: renderOffersTemplate,
  otp: renderOtpTemplate,
};

module.exports = {
  renderGreetingsTemplate,
  renderOrderStatusTemplate,
  renderOffersTemplate,
  renderOtpTemplate,
  templateRenderers,
};
