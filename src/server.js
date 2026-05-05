const { app } = require("./app");
const { env } = require("./config/env");
const { closeMongo, initializeMongo } = require("./config/mongo");
const { closePostgres, initializePostgres } = require("./config/postgres");
const { closeRedis, initializeRedis } = require("./config/redis");
const { bootstrapAdminWorkspace } = require("./services/admin.service");
const { seedHomeCategoryItems } = require("./services/home-category.service");
const { seedProductCatalog } = require("./services/product.service");

let server;

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await Promise.allSettled([closeMongo(), closeRedis(), closePostgres()]);
  process.exit(0);
};

const bootstrap = async () => {
  await initializePostgres();
  await bootstrapAdminWorkspace();
  await initializeRedis();
  await initializeMongo();
  await seedProductCatalog();
  await seedHomeCategoryItems();

  server = app.listen(env.port, () => {
    console.log(
      `Grass Green Nursery server listening on http://localhost:${env.port}`,
    );
  });
};

bootstrap().catch(async (error) => {
  console.error("Failed to start server:", error);
  await Promise.allSettled([closeMongo(), closeRedis(), closePostgres()]);
  process.exit(1);
});

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("Shutdown error:", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("Shutdown error:", error);
    process.exit(1);
  });
});
