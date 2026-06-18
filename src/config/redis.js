const NodeCache = require("node-cache");
const { createClient } = require("redis");
const { env } = require("./env");

const memoryStore = new NodeCache({
  checkperiod: 30,
  useClones: false,
});

let client;

const normalizeKeyList = (keys) => {
  if (Array.isArray(keys)) {
    return keys.map((key) => String(key));
  }

  return [String(keys)];
};

const createMemoryRedisClient = () => {
  const memoryClient = {
    __redisMode: "memory",
    isOpen: true,
    on: () => {},
    async connect() {
      this.isOpen = true;
      return this;
    },
    async quit() {
      this.isOpen = false;
      memoryStore.flushAll();
      return "OK";
    },
    async get(key) {
      const value = memoryStore.get(String(key));
      return value === undefined ? null : value;
    },
    async set(key, value, options = {}) {
      const stringKey = String(key);

      if (options?.NX && memoryStore.has(stringKey)) {
        return null;
      }

      const ttlSeconds = Number.parseInt(options?.EX ?? "", 10);
      const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : undefined;

      memoryStore.set(stringKey, String(value), ttl);
      return "OK";
    },
    async del(keys) {
      let deletedCount = 0;

      for (const key of normalizeKeyList(keys)) {
        deletedCount += memoryStore.del(key);
      }

      return deletedCount;
    },
    async exists(key) {
      return memoryStore.has(String(key)) ? 1 : 0;
    },
    async incr(key) {
      const stringKey = String(key);
      const currentValue = Number.parseInt((await this.get(stringKey)) || "0", 10);
      const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;

      await this.set(stringKey, String(nextValue));
      return nextValue;
    },
    async expire(key, seconds) {
      const stringKey = String(key);
      const ttlSeconds = Number.parseInt(seconds ?? "", 10);

      if (!memoryStore.has(stringKey) || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        return 0;
      }

      const value = await this.get(stringKey);
      memoryStore.set(stringKey, value, ttlSeconds);
      return 1;
    },
    async ttl(key) {
      const ttlMs = memoryStore.getTtl(String(key));

      if (!ttlMs) {
        return -1;
      }

      const remainingMs = ttlMs - Date.now();
      if (remainingMs <= 0) {
        return -2;
      }

      return Math.ceil(remainingMs / 1000);
    },
  };

  return memoryClient;
};

const createRealRedisClient = () => {
  const redisClient = createClient({
    url: env.redis.url,
  });

  redisClient.__redisMode = "redis";
  redisClient.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });

  return redisClient;
};

const useMemoryClient = (reason) => {
  if (!client || client.__redisMode !== "memory") {
    client = createMemoryRedisClient();
    console.warn(
      reason ||
        "Redis is disabled or unavailable. Using in-memory fallback for carts, OTPs, and sync locks.",
    );
  }

  return client;
};

const getRedisClient = () => {
  if (client) {
    return client;
  }

  if (!env.redis.isConfigured) {
    return useMemoryClient();
  }

  client = createRealRedisClient();
  return client;
};

const initializeRedis = async () => {
  if (!env.redis.isConfigured) {
    return useMemoryClient();
  }

  const redisClient = getRedisClient();

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (error) {
      console.warn(
        `Redis connection failed (${error.message}). Falling back to in-memory storage.`,
      );
      return useMemoryClient();
    }
  }

  return redisClient;
};

const closeRedis = async () => {
  if (!client) {
    return;
  }

  if (client.__redisMode === "redis" && client.isOpen) {
    await client.quit();
  }

  if (client.__redisMode === "memory") {
    await client.quit();
  }

  client = undefined;
};

module.exports = {
  closeRedis,
  getRedisClient,
  initializeRedis,
};
