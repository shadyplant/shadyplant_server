const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const helmet = require("helmet");
const { env } = require("./config/env");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/error.middleware");
const apiRoutes = require("./routes");

const app = express();

const isAllowedOrigin = (origin) =>
  env.clientOrigins.includes(String(origin || "").trim());

const captureRawBody = (req, res, buffer) => {
  if (buffer?.length) {
    req.rawBody = Buffer.from(buffer);
  }
};
const apiRequestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const forwardedFor = req.headers["x-forwarded-for"];
    const requestIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip;

    console.log(
      `[API] ${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms ${requestIp}`,
    );
  });

  next();
};

app.disable("x-powered-by");
if (env.serverSecurity.trustProxy) {
  app.set("trust proxy", 1);
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin denied."));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(
  express.json({
    verify: captureRawBody,
  }),
);
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Shadyplant API is running.",
  });
});

app.use("/api/v1", apiRequestLogger);
app.use("/api/v1", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
