const { v4: uuidv4 } = require('uuid');
const { run } = require('../utils/requestContext');

/**
 * Middleware that attaches a unique correlation ID to every request.
 * Uses the incoming x-request-id header if present, otherwise generates a new UUID.
 * The ID is also set on the response header for client-side correlation.
 *
 * The rest of the request is run inside an AsyncLocalStorage context holding
 * the requestId, so every downstream log line — in controllers, models,
 * services — picks it up automatically (see utils/logger.js).
 */
const requestIdMiddleware = (req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  _res.setHeader('x-request-id', req.requestId);
  run({ requestId: req.requestId }, () => next());
};

module.exports = requestIdMiddleware;
