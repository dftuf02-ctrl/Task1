const { v4: uuidv4 } = require('uuid');

/**
 * Middleware that attaches a unique correlation ID to every request.
 * Uses the incoming x-request-id header if present, otherwise generates a new UUID.
 * The ID is also set on the response header for client-side correlation.
 */
const requestIdMiddleware = (req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  _res.setHeader('x-request-id', req.requestId);
  next();
};

module.exports = requestIdMiddleware;
