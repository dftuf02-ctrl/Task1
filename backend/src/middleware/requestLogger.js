const logger = require('../utils/logger');

/**
 * HTTP request/response logger middleware.
 * Logs: method, path, status code, response time, and request ID.
 */
const requestLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture the original end method to log after response is sent
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', logData);
    } else {
      logger.info('Request completed', logData);
    }

    originalEnd.apply(res, args);
  };

  next();
};

module.exports = requestLoggerMiddleware;
