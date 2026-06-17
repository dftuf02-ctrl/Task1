const { sendError } = require('../utils/responseHelper');

/**
 * Authorization middleware factory — restricts a route to the given roles.
 * Must run after `authenticate` (which populates req.user).
 *
 * @param {...string} roles - allowed roles, e.g. authorize('ADMIN')
 * @returns {import('express').RequestHandler}
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', [], 401);
  }
  if (!roles.includes(req.user.role)) {
    return sendError(res, 'Insufficient permissions', [], 403);
  }
  return next();
};

module.exports = authorize;
