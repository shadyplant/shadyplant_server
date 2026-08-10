const { app } = require("./app");
const { env } = require("./config/env");
const { closeMongo, initializeMongo } = require("./config/mongo");
const { closePostgres, initializePostgres } = require("./config/postgres");
const { closeRedis, initializeRedis } = require("./config/redis");
const {
  refreshDeliveryChargeCache,
} = require("./services/delivery-charge.service");
const { bootstrapAdminWorkspace } = require("./services/admin.service");

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
  await refreshDeliveryChargeCache();
  await bootstrapAdminWorkspace();
  await initializeRedis();
  await initializeMongo();

  server = app.listen(env.port, () => {
    console.log(
      `ShadyPlant server listening on http://localhost:${env.port}`,
    );
  });
};

const handleFatalError = async (label, error) => {
  console.error(label, error);

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
  } catch (shutdownError) {
    console.error("Failed during fatal shutdown:", shutdownError);
  } finally {
    await Promise.allSettled([closeMongo(), closeRedis(), closePostgres()]);
  }
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

process.on("uncaughtException", (error) => {
  void handleFatalError("[FATAL] Uncaught exception", error).finally(() => {
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));

  void handleFatalError("[FATAL] Unhandled rejection", error).finally(() => {
    process.exit(1);
  });
});
