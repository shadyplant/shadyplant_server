const { getRedisClient } = require("../config/redis");

const getFailureKey = (scope, identifier) =>
  `auth:${scope}:failures:${String(identifier || "").trim().toLowerCase()}`;

const getLockKey = (scope, identifier) =>
  `auth:${scope}:lock:${String(identifier || "").trim().toLowerCase()}`;

const getLockoutState = async (scope, identifier) => {
  try {
    const redisClient = getRedisClient();
    const lockKey = getLockKey(scope, identifier);
    const isLocked = await redisClient.exists(lockKey);

    if (!isLocked) {
      return {
        isLocked: false,
        retryAfterSeconds: 0,
      };
    }

    const retryAfterSeconds = await redisClient.ttl(lockKey);

    return {
      isLocked: true,
      retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : 0,
    };
  } catch (error) {
    console.error("Login lockout state lookup failed:", error.message);
    return {
      isLocked: false,
      retryAfterSeconds: 0,
    };
  }
};

const recordFailedLoginAttempt = async (
  scope,
  identifier,
  {
    windowMinutes,
    maxAttempts,
    lockoutMinutes,
  },
) => {
  try {
    const redisClient = getRedisClient();
    const failureKey = getFailureKey(scope, identifier);
    const lockKey = getLockKey(scope, identifier);
    const attempts = await redisClient.incr(failureKey);

    if (attempts === 1) {
      await redisClient.expire(failureKey, Math.max(60, windowMinutes * 60));
    }

    if (attempts >= maxAttempts) {
      await redisClient.set(lockKey, "1", {
        EX: Math.max(60, lockoutMinutes * 60),
      });
    }

    return {
      attempts,
      isLocked: attempts >= maxAttempts,
    };
  } catch (error) {
    console.error("Failed to record login attempt:", error.message);
    return {
      attempts: 0,
      isLocked: false,
    };
  }
};

const clearFailedLoginAttempts = async (scope, identifier) => {
  try {
    const redisClient = getRedisClient();

    await redisClient.del([
      getFailureKey(scope, identifier),
      getLockKey(scope, identifier),
    ]);
  } catch (error) {
    console.error("Failed to clear login attempts:", error.message);
  }
};

module.exports = {
  clearFailedLoginAttempts,
  getLockoutState,
  recordFailedLoginAttempt,
};
