const { createClient } = require("redis");
const { env } = require("./env");

let client;

const getRedisClient = () => {
  if (!client) {
    client = createClient({
      url: env.redis.url,
    });

    client.on("error", (error) => {
      console.error("Redis client error:", error.message);
    });
  }

  return client;
};

const initializeRedis = async () => {
  const redisClient = getRedisClient();

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
};

const closeRedis = async () => {
  if (client?.isOpen) {
    await client.quit();
  }
  client = undefined;
};

module.exports = {
  closeRedis,
  getRedisClient,
  initializeRedis,
};
