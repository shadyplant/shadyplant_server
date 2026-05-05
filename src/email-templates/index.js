const { renderGreetingsTemplate } = require("./greetings.template");
const { renderOffersTemplate } = require("./offers.template");
const { renderOtpTemplate } = require("./otp.template");

const templateRenderers = {
  greetings: renderGreetingsTemplate,
  offers: renderOffersTemplate,
  otp: renderOtpTemplate,
};

module.exports = {
  renderGreetingsTemplate,
  renderOffersTemplate,
  renderOtpTemplate,
  templateRenderers,
};
