const { ApiError } = require("../utils/apiError");

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
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
