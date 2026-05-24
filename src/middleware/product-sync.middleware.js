const NodeCache = require("node-cache");
const { env } = require("../config/env");
const { getRedisClient } = require("../config/redis");
const { ApiError } = require("../utils/apiError");
const { createSha256Hash, generateId } = require("../utils/crypto");

const fallbackCache = new NodeCache({
  stdTTL: env.productSync.replayTtlSeconds,
  useClones: false,
});

const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return String(forwardedFor[0] || "").trim();
  }

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return String(req.ip || "").trim();
};

const setCacheValue = async (key, value, ttlSeconds) => {
  const redisClient = getRedisClient();

  if (redisClient?.isOpen) {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }

  fallbackCache.set(key, value, ttlSeconds);
};

const getCacheValue = async (key) => {
  const redisClient = getRedisClient();

  if (redisClient?.isOpen) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  return fallbackCache.get(key) || null;
};

const acquireLock = async (key, value, ttlSeconds) => {
  const redisClient = getRedisClient();

  if (redisClient?.isOpen) {
    const result = await redisClient.set(key, value, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === "OK";
  }

  if (fallbackCache.has(key)) {
    return false;
  }

  fallbackCache.set(key, value, ttlSeconds);
  return true;
};

const releaseLock = async (key, value) => {
  const redisClient = getRedisClient();

  if (redisClient?.isOpen) {
    const currentValue = await redisClient.get(key);

    if (currentValue === value) {
      await redisClient.del(key);
    }

    return;
  }

  if (fallbackCache.get(key) === value) {
    fallbackCache.del(key);
  }
};

const attachProductSyncRequestContext = (req, res, next) => {
  const requestId = String(req.headers["x-request-id"] || "").trim() || generateId();
  const idempotencyKey = String(req.headers["x-idempotency-key"] || "").trim();
  const payloadHash = createSha256Hash(req.rawBody || JSON.stringify(req.body || []));

  req.productSyncContext = {
    requestId,
    idempotencyKey: idempotencyKey || payloadHash,
    payloadHash,
    requestIp: getRequestIp(req),
    userAgent: String(req.headers["user-agent"] || "").trim(),
  };

  res.setHeader("x-request-id", requestId);
  next();
};

const requireProductSyncBearerToken = (req, res, next) => {
  if (!env.productSync.isConfigured) {
    return next(new ApiError(503, "Product sync is not configured on the server."));
  }

  const authorization = String(req.headers.authorization || "").trim();

  if (!authorization.startsWith("Bearer ")) {
    return next(new ApiError(401, "Bearer authorization is required."));
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token || token !== env.productSync.bearerToken) {
    return next(new ApiError(401, "Product sync token is invalid."));
  }

  return next();
};

const validateProductSyncPayloadShape = (req, res, next) => {
  const payload = Array.isArray(req.body) ? req.body : req.body?.products;

  if (!Array.isArray(payload)) {
    return next(new ApiError(400, "Request body must be a JSON array of products."));
  }

  if (payload.length > env.productSync.maxBatchSize) {
    return next(
      new ApiError(
        413,
        `Product sync payload exceeds the maximum batch size of ${env.productSync.maxBatchSize}.`,
      ),
    );
  }

  req.productSyncPayload = payload;
  return next();
};

const handleProductSyncIdempotency = async (req, res, next) => {
  try {
    const context = req.productSyncContext;
    const resultCacheKey = `product-sync:result:${context.idempotencyKey}`;
    const requestCacheKey = `product-sync:request:${context.idempotencyKey}`;
    const cachedResponse = await getCacheValue(resultCacheKey);

    if (cachedResponse) {
      res.status(200).json({
        ...cachedResponse,
        replayed: true,
      });
      return;
    }

    const requestLockToken = `${context.requestId}:request`;
    const requestLockAcquired = await acquireLock(
      requestCacheKey,
      requestLockToken,
      env.productSync.lockTtlSeconds,
    );

    if (!requestLockAcquired) {
      return next(
        new ApiError(409, "A matching product sync request is already in progress."),
      );
    }

    const globalLockKey = "product-sync:lock";
    const globalLockToken = `${context.requestId}:global`;
    const globalLockAcquired = await acquireLock(
      globalLockKey,
      globalLockToken,
      env.productSync.lockTtlSeconds,
    );

    if (!globalLockAcquired) {
      await releaseLock(requestCacheKey, requestLockToken);
      return next(new ApiError(409, "Another product sync is already in progress."));
    }

    req.productSyncContext.resultCacheKey = resultCacheKey;
    req.productSyncContext.requestCacheKey = requestCacheKey;
    req.productSyncContext.requestLockToken = requestLockToken;
    req.productSyncContext.globalLockKey = globalLockKey;
    req.productSyncContext.globalLockToken = globalLockToken;

    res.on("finish", () => {
      releaseLock(requestCacheKey, requestLockToken).catch((error) => {
        console.error("Failed to release product sync request lock:", error);
      });
      releaseLock(globalLockKey, globalLockToken).catch((error) => {
        console.error("Failed to release product sync global lock:", error);
      });
    });

    next();
  } catch (error) {
    next(error);
  }
};

const cacheProductSyncResponse = async (context, responsePayload) => {
  if (!context?.resultCacheKey) {
    return;
  }

  await setCacheValue(
    context.resultCacheKey,
    responsePayload,
    env.productSync.replayTtlSeconds,
  );
};

module.exports = {
  attachProductSyncRequestContext,
  cacheProductSyncResponse,
  handleProductSyncIdempotency,
  requireProductSyncBearerToken,
  validateProductSyncPayloadShape,
};
