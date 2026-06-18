const bcryptjs = require('bcryptjs');
const { getConfig } = require('../config/env');
const logger = require('./logger');

/**
 * Password hashing with a switchable implementation so the load-test
 * bottleneck and its fix can be compared without code changes:
 *
 *   PASSWORD_HASH=bcryptjs  (default)  pure-JS bcrypt — hashing runs on the
 *                                      Node event loop and serializes all
 *                                      requests under load (the BASELINE).
 *   PASSWORD_HASH=native               native bcrypt — hashing runs on the
 *                                      libuv threadpool, off the event loop
 *                                      (the FIX).
 *
 * Both produce/verify the standard bcrypt `$2*$` format, so hashes created
 * under one implementation verify correctly under the other.
 */

// Native bcrypt needs compilation, so it's an OPTIONAL dependency. If it
// isn't installed we transparently fall back to bcryptjs.
let nativeBcrypt = null;
try {
  // eslint-disable-next-line global-require
  nativeBcrypt = require('bcrypt');
} catch (_err) {
  nativeBcrypt = null;
}

let warnedMissingNative = false;

/** Picks the configured bcrypt implementation for this call. */
const impl = () => {
  const { passwordHashImpl } = getConfig();
  if (passwordHashImpl === 'native') {
    if (nativeBcrypt) return nativeBcrypt;
    if (!warnedMissingNative) {
      warnedMissingNative = true;
      logger.warn(
        'PASSWORD_HASH=native requested but native bcrypt is not installed; ' +
          'falling back to bcryptjs. Run `npm install bcrypt` to enable the fix.',
      );
    }
  }
  return bcryptjs;
};

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} plain
 * @returns {Promise<string>} bcrypt hash
 */
const hashPassword = async (plain) => {
  const { bcryptRounds } = getConfig();
  return impl().hash(plain, bcryptRounds);
};

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (plain, hash) => impl().compare(plain, hash);

// Pre-computed (lazily) dummy hash so the "user not found" path can do the
// same bcrypt work as a real comparison — equalising response time so login
// timing can't reveal which emails are registered.
let dummyHash = null;

/**
 * Burn the same bcrypt cost as a real verify, always returning false.
 * Call this on the no-such-user branch of login.
 * @returns {Promise<boolean>} always false
 */
const fakeVerify = async () => {
  const { bcryptRounds } = getConfig();
  if (!dummyHash) {
    dummyHash = await impl().hash('timing-equalisation-dummy', bcryptRounds);
  }
  await impl().compare('invalid-password', dummyHash);
  return false;
};

module.exports = { hashPassword, verifyPassword, fakeVerify };
