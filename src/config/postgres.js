const { Pool } = require("pg");
const { env } = require("./env");
const { runPostgresMigrations } = require("./postgres-migrations");

let pool;

const getPostgresPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: env.postgres.url,
      ssl: env.postgres.ssl
        ? {
            rejectUnauthorized: env.postgres.sslRejectUnauthorized,
          }
        : false,
    });
  }

  return pool;
};

const initializePostgres = async () => {
  const activePool = getPostgresPool();
  await activePool.query("SELECT 1");
  await runPostgresMigrations();
  return activePool;
};

const query = async (text, params) => getPostgresPool().query(text, params);

const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

module.exports = {
  closePostgres,
  getPostgresPool,
  initializePostgres,
  query,
};
