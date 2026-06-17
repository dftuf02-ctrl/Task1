const authenticate = require('../../src/middleware/authenticate');
const authorize = require('../../src/middleware/authorize');
const { signAccessToken } = require('../../src/utils/jwt');

describe('authenticate middleware', () => {
  let res;
  let next;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  it('populates req.user for a valid Bearer token', () => {
    const token = signAccessToken({ id: 'u1', email: 'a@example.com', role: 'USER' });
    const req = { headers: { authorization: `Bearer ${token}` } };

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u1', email: 'a@example.com', role: 'USER' });
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req = { headers: {} };

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed/invalid token', () => {
    const req = { headers: { authorization: 'Bearer not-a-jwt' } };

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('flags an expired token with the TOKEN_EXPIRED code', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { sub: 'u1', email: 'a@example.com', role: 'USER', type: 'access' },
      'test-access-secret',
      { expiresIn: '-1s' }
    );
    const req = { headers: { authorization: `Bearer ${expired}` } };

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: [{ field: 'token', message: 'TOKEN_EXPIRED' }],
      })
    );
  });
});

describe('authorize middleware', () => {
  let res;
  let next;

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  it('allows a user whose role is permitted', () => {
    const req = { user: { id: 'u1', role: 'ADMIN' } };
    authorize('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when the role is not permitted', () => {
    const req = { user: { id: 'u1', role: 'USER' } };
    authorize('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is attached', () => {
    const req = {};
    authorize('USER')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
