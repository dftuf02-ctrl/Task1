const UserModel = require('../models/user.model');
const { hashPassword, verifyPassword, fakeVerify } = require('../utils/password');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/jwt');
const { getConfig } = require('../config/env');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { audit, fromRequest } = require('../utils/audit');

/**
 * Issues a fresh access + refresh token pair and persists the
 * (hashed) refresh token so it can be rotated / revoked.
 */
const issueTokens = async (user) => {
  const config = getConfig();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const expiresAt = new Date(Date.now() + config.refreshExpiryDays * 24 * 60 * 60 * 1000);
  await UserModel.storeRefreshToken({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt.toISOString(),
  });

  return { accessToken, refreshToken };
};

const publicUser = (user) => ({ id: user.id, email: user.email, role: user.role });

/**
 * POST /api/v1/auth/signup
 */
const signup = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Prevent privilege escalation: clients cannot self-assign ADMIN.
    if (role && role === 'ADMIN') {
      audit({ action: 'auth.signup', result: 'FAILURE', context: fromRequest(req), metadata: { email, reason: 'admin-self-assign' } });
      return sendError(res, 'Cannot self-assign the ADMIN role', [], 403);
    }

    const { data: existing, error: lookupError } = await UserModel.findByEmail(email);
    if (lookupError) {
      logger.error('Signup lookup failed', { requestId: req.requestId, error: lookupError.message });
      return sendError(res, 'Failed to create account', [], 500);
    }
    if (existing) {
      return sendError(res, 'An account with this email already exists', [], 409);
    }

    const password_hash = await hashPassword(password);
    const { data: user, error } = await UserModel.createUser({ email, password_hash, role: 'USER' });
    if (error || !user) {
      logger.error('Signup create failed', { requestId: req.requestId, error: error && error.message });
      return sendError(res, 'Failed to create account', [], 500);
    }

    const tokens = await issueTokens(user);
    audit({ action: 'auth.signup', result: 'SUCCESS', actor: { id: user.id, role: user.role, email: user.email }, context: fromRequest(req) });
    logger.info('User signed up', { requestId: req.requestId, userId: user.id });
    return sendSuccess(res, { user: publicUser(user), ...tokens }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await UserModel.findByEmail(email);
    if (error) {
      logger.error('Login lookup failed', { requestId: req.requestId, error: error.message });
      return sendError(res, 'Failed to log in', [], 500);
    }

    // Use a generic message to avoid leaking which emails exist — AND run a
    // dummy bcrypt comparison so the no-such-user path costs the same time as
    // a real one (no timing oracle for account enumeration).
    if (!user) {
      await fakeVerify();
      audit({ action: 'auth.login', result: 'FAILURE', context: fromRequest(req), metadata: { email } });
      return sendError(res, 'Invalid email or password', [], 401);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      audit({ action: 'auth.login', result: 'FAILURE', context: fromRequest(req), metadata: { email } });
      return sendError(res, 'Invalid email or password', [], 401);
    }

    const tokens = await issueTokens(user);
    logger.info('User logged in', { requestId: req.requestId, userId: user.id });
    audit({
      action: 'auth.login',
      result: 'SUCCESS',
      actor: { id: user.id, role: user.role },
      context: fromRequest(req),
    });
    return sendSuccess(res, { user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token: the presented token is revoked and a
 * new pair is issued.
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return sendError(res, 'Invalid or expired refresh token', [], 401);
    }

    const tokenHash = hashToken(refreshToken);
    const { data: stored, error: findError } = await UserModel.findRefreshToken(tokenHash);
    if (findError) {
      logger.error('Refresh lookup failed', { requestId: req.requestId, error: findError.message });
      return sendError(res, 'Failed to refresh token', [], 500);
    }

    // Must exist, not be revoked, not expired.
    if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
      return sendError(res, 'Invalid or expired refresh token', [], 401);
    }

    const { data: user, error: userError } = await UserModel.findById(payload.sub);
    if (userError || !user) {
      return sendError(res, 'Invalid or expired refresh token', [], 401);
    }

    // Rotate: revoke the old token, issue a new pair.
    await UserModel.revokeRefreshToken(tokenHash);
    const tokens = await issueTokens(user);

    return sendSuccess(res, { user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 *
 * Revokes the supplied refresh token (best-effort).
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await UserModel.revokeRefreshToken(hashToken(refreshToken));
    }
    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 */
const me = async (req, res, next) => {
  try {
    const { data: user, error } = await UserModel.findById(req.user.id);
    if (error || !user) {
      return sendError(res, 'User not found', [], 404);
    }
    return sendSuccess(res, publicUser(user));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
};
