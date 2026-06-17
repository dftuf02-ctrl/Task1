const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getConfig } = require('../config/env');

/**
 * Sign a short-lived access token carrying the user identity & role.
 * @param {{ id: string, email: string, role: string }} user
 * @returns {string} signed JWT
 */
const signAccessToken = (user) => {
  const config = getConfig();
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, type: 'access' },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiry },
  );
};

/**
 * Sign a long-lived refresh token. A random jti is embedded so each
 * issued token is unique even for the same user.
 * @param {{ id: string }} user
 * @returns {string} signed JWT
 */
const signRefreshToken = (user) => {
  const config = getConfig();
  return jwt.sign(
    { sub: user.id, type: 'refresh', jti: crypto.randomUUID() },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiry },
  );
};

/**
 * Verify an access token. Throws (jwt.TokenExpiredError / JsonWebTokenError) on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => {
  const config = getConfig();
  return jwt.verify(token, config.jwtAccessSecret);
};

/**
 * Verify a refresh token. Throws on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  const config = getConfig();
  return jwt.verify(token, config.jwtRefreshSecret);
};

/**
 * Deterministically hash a token for at-rest storage (so a DB leak
 * doesn't expose usable refresh tokens). SHA-256 is sufficient here
 * because the token itself is high-entropy.
 * @param {string} token
 * @returns {string} hex digest
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
