const { ApiError } = require("../utils/apiError");

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  if (error instanceof Error && error.message === "CORS origin denied.") {
    res.status(403).json({
      message: "Origin is not allowed.",
      details: null,
    });
    return;
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    res.status(400).json({
      message: "Malformed JSON payload.",
      details: null,
    });
    return;
  }

  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500
      ? "Something went wrong on the server."
      : error.message || "Request failed.";

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    details: error.details || null,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
