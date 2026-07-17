const fs = require("fs/promises");
const path = require("path");
const { createSha256Hash } = require("../utils/crypto");

const MIGRATION_LOCK_KEY = 48372651;
const LEGACY_SCHEMA_FILE = path.resolve(
  __dirname,
  "..",
  "..",
  "docker",
  "postgres",
  "init",
  "001_schema.sql",
);
const MIGRATION_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "docker",
  "postgres",
  "migrations",
);

const MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const collectMigrationFiles = async () => {
  const files = [LEGACY_SCHEMA_FILE];

  try {
    const entries = await fs.readdir(MIGRATION_DIR, { withFileTypes: true });
    const sqlFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
      .map((entry) => path.resolve(MIGRATION_DIR, entry.name))
      .sort((left, right) => left.localeCompare(right, "en"));

    files.push(...sqlFiles);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return files;
};

const ensureMigrationTable = async (client) => {
  await client.query(MIGRATIONS_TABLE_SQL);
};

const runPostgresMigrations = async () => {
  const { getPostgresPool } = require("./postgres");
  const client = await getPostgresPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await ensureMigrationTable(client);

    const appliedResult = await client.query(
      "SELECT filename, checksum FROM schema_migrations",
    );
    const appliedMap = new Map(
      appliedResult.rows.map((row) => [row.filename, row.checksum]),
    );

    const migrationFiles = await collectMigrationFiles();

    for (const filePath of migrationFiles) {
      const filename = path.basename(filePath);
      const migrationSql = await fs.readFile(filePath, "utf8");
      const checksum = createSha256Hash(migrationSql);
      const appliedChecksum = appliedMap.get(filename);

      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          if (filename === path.basename(LEGACY_SCHEMA_FILE)) {
            console.warn(
              `Legacy migration ${filename} checksum changed after it was applied. Skipping because incremental migrations handle schema updates.`,
            );
            continue;
          }

          throw new Error(
            `Migration ${filename} was already applied with a different checksum. Reset or create a new migration instead of editing applied SQL.`,
          );
        }

        continue;
      }

      await client.query(migrationSql);
      await client.query(
        "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
        [filename, checksum],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  runPostgresMigrations,
};
