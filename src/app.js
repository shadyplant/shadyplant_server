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
app.use(
  cors({
    origin(origin, callback) {
      return callback(null, true);
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
    message: "Grass Green Nursery API is running.",
  });
});

app.use("/api/v1", apiRequestLogger);
app.use("/api/v1", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
