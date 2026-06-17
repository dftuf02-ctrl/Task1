const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/responseHelper');

/**
 * Authentication middleware.
 * Expects an `Authorization: Bearer <accessToken>` header.
 * On success attaches `req.user = { id, email, role }`.
 * Distinguishes an expired token (401 + code TOKEN_EXPIRED) from
 * an otherwise invalid/missing token so the client knows to refresh.
 */
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return sendError(res, 'Authentication required', [], 401);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Access token expired', [{ field: 'token', message: 'TOKEN_EXPIRED' }], 401);
    }
    return sendError(res, 'Invalid access token', [], 401);
  }
};

module.exports = authenticate;
