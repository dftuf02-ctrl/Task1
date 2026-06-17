const bcrypt = require('bcryptjs');
const { getConfig } = require('../config/env');

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} plain
 * @returns {Promise<string>} bcrypt hash
 */
const hashPassword = async (plain) => {
  const { bcryptRounds } = getConfig();
  return bcrypt.hash(plain, bcryptRounds);
};

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

module.exports = { hashPassword, verifyPassword };
