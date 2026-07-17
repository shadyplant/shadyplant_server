const { getRedisClient } = require("../config/redis");

const getPendingRegistrationKey = (token) => `pending_registration:${token}`;

const withDate = (value) => (value ? new Date(value) : null);

const savePendingRegistration = async ({
  token,
  fullName,
  email,
  phoneNumber,
  passwordHash,
  expiresAt,
}) => {
  const redisClient = getRedisClient();
  const record = {
    token,
    fullName,
    email,
    phoneNumber,
    passwordHash,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ttlSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
  );

  await redisClient.set(getPendingRegistrationKey(token), JSON.stringify(record), {
    EX: ttlSeconds,
  });

  return {
    ...record,
  };
};

const findPendingRegistration = async (token) => {
  const redisClient = getRedisClient();
  const payload = await redisClient.get(getPendingRegistrationKey(token));

  if (!payload) {
    return null;
  }

  const record = JSON.parse(payload);

  return {
    ...record,
    expiresAt: withDate(record.expiresAt),
    createdAt: withDate(record.createdAt),
    updatedAt: withDate(record.updatedAt),
  };
};

const clearPendingRegistration = async (token) => {
  await getRedisClient().del(getPendingRegistrationKey(token));
};

module.exports = {
  clearPendingRegistration,
  findPendingRegistration,
  savePendingRegistration,
};
