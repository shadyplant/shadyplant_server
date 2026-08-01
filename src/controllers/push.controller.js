const { registerPushDeviceToken } = require("../services/push-device.service");
const { asyncHandler } = require("../utils/asyncHandler");

const registerDevicePushToken = asyncHandler(async (req, res) => {
  const result = await registerPushDeviceToken({
    payload: req.body,
  });

  res.status(200).json(result);
});

module.exports = {
  registerDevicePushToken,
};
