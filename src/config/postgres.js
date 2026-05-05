const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
const { env } = require("./env");

let pool;

const getPostgresPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: env.postgres.url,
    });
  }

  return pool;
};

const applySchema = async () => {
  const schemaPath = path.resolve(
    __dirname,
    "..",
    "..",
    "docker",
    "postgres",
    "init",
    "001_schema.sql",
  );
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  await getPostgresPool().query(schemaSql);
};

const initializePostgres = async () => {
  const activePool = getPostgresPool();
  await activePool.query("SELECT 1");
  await applySchema();
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
