const winston = require('winston');
const { get } = require('./requestContext');

/**
 * Injects the request-scoped correlation id into every log record that
 * doesn't already carry one, so the requestId flows through EVERY log line
 * (controllers, models, services, the worker) without being passed by hand.
 */
const injectRequestId = winston.format((info) => {
  if (!info.requestId) {
    const { requestId } = get();
    if (requestId) info.requestId = requestId;
  }
  return info;
});

/**
 * Application-wide Winston logger.
 * - JSON format in production for log aggregation
 * - Colorized, human-readable format in development
 * - Timestamp on every log entry
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    injectRequestId(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
            const rid = requestId ? ` [${requestId}]` : '';
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}${rid}: ${message}${extra}`;
          }),
        ),
  ),
  defaultMeta: { service: 'task-management-api' },
  transports: [new winston.transports.Console()],
  silent: process.env.NODE_ENV === 'test',
});

module.exports = logger;
