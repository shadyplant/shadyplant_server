const { closePostgres, initializePostgres } = require("../config/postgres");

const main = async () => {
  await initializePostgres();
  console.log("Database migrations applied successfully.");
};

main().catch(async (error) => {
  console.error("Database migration failed:", error);
  await Promise.allSettled([closePostgres()]);
  process.exit(1);
});
