const logger = require('../utils/logger');
const { sendError } = require('../utils/responseHelper');

/**
 * Global error handling middleware.
 * - Logs the full error internally
 * - Returns a safe, consistent error response to the client
 * - Never leaks stack traces or internal details in production
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const requestId = req.requestId || 'unknown';

  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response — never expose internals in production
  const isProduction = process.env.NODE_ENV === 'production';
  const message = statusCode === 500 && isProduction
    ? 'An unexpected error occurred'
    : err.message || 'Internal server error';

  const errors = err.errors || [];

  return sendError(res, message, errors, statusCode);
};

module.exports = errorHandler;
