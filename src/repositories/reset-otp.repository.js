const { getRedisClient } = require("../config/redis");

const OTP_PURPOSES = {
  registration: "registration",
  passwordReset: "password_reset",
};

const getOtpKey = (identifier, purpose) => `otp:${purpose}:${identifier}`;

const withDate = (value) => (value ? new Date(value) : null);

const saveOtpRecord = async ({ identifier, purpose, otpHash, expiresAt }) => {
  const redisClient = getRedisClient();
  const record = {
    otpHash,
    expiresAt,
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ttlSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
  );

  await redisClient.set(
    getOtpKey(identifier, purpose),
    JSON.stringify(record),
    {
      EX: ttlSeconds,
    },
  );

  return {
    identifier,
    purpose,
    ...record,
  };
};

const findOtpRecord = async (identifier, purpose) => {
  const redisClient = getRedisClient();
  const payload = await redisClient.get(getOtpKey(identifier, purpose));

  if (!payload) {
    return null;
  }

  const record = JSON.parse(payload);

  return {
    identifier,
    purpose,
    ...record,
    expiresAt: withDate(record.expiresAt),
    createdAt: withDate(record.createdAt),
    updatedAt: withDate(record.updatedAt),
  };
};

const incrementOtpAttempts = async (identifier, purpose) => {
  const redisClient = getRedisClient();
  const currentRecord = await findOtpRecord(identifier, purpose);
  if (!currentRecord) {
    return null;
  }

  const nextRecord = {
    ...currentRecord,
    attempts: currentRecord.attempts + 1,
    updatedAt: new Date(),
  };

  const ttlSeconds = await redisClient.ttl(getOtpKey(identifier, purpose));
  const options = ttlSeconds > 0 ? { EX: ttlSeconds } : undefined;

  await redisClient.set(
    getOtpKey(identifier, purpose),
    JSON.stringify({
      otpHash: nextRecord.otpHash,
      expiresAt: nextRecord.expiresAt,
      attempts: nextRecord.attempts,
      createdAt: nextRecord.createdAt,
      updatedAt: nextRecord.updatedAt,
    }),
    options,
  );

  return nextRecord;
};

const clearOtpRecord = async (identifier, purpose) => {
  await getRedisClient().del(getOtpKey(identifier, purpose));
};

module.exports = {
  clearOtpRecord,
  findOtpRecord,
  incrementOtpAttempts,
  OTP_PURPOSES,
  saveOtpRecord,
};
