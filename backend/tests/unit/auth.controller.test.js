const authController = require('../../src/controllers/auth.controller');
const UserModel = require('../../src/models/user.model');
const password = require('../../src/utils/password');
const jwtUtil = require('../../src/utils/jwt');

jest.mock('../../src/models/user.model');
jest.mock('../../src/utils/password');
jest.mock('../../src/utils/jwt');

describe('Auth Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
  });

  beforeEach(() => {
    mockReq = { body: {}, requestId: 'test-request-id', user: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();

    // Default token-issuing mocks
    jwtUtil.signAccessToken.mockReturnValue('access-token');
    jwtUtil.signRefreshToken.mockReturnValue('refresh-token');
    jwtUtil.hashToken.mockReturnValue('hashed-token');
    UserModel.storeRefreshToken.mockResolvedValue({ data: {}, error: null });
  });

  describe('signup', () => {
    it('creates a user and returns 201 with tokens', async () => {
      mockReq.body = { email: 'new@example.com', password: 'password123' };
      UserModel.findByEmail.mockResolvedValue({ data: null, error: null });
      password.hashPassword.mockResolvedValue('hash');
      UserModel.createUser.mockResolvedValue({
        data: { id: 'u1', email: 'new@example.com', role: 'USER' },
        error: null,
      });

      await authController.signup(mockReq, mockRes, mockNext);

      expect(UserModel.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', role: 'USER' })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: { id: 'u1', email: 'new@example.com', role: 'USER' },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('returns 409 when the email already exists', async () => {
      mockReq.body = { email: 'dup@example.com', password: 'password123' };
      UserModel.findByEmail.mockResolvedValue({ data: { id: 'existing' }, error: null });

      await authController.signup(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(UserModel.createUser).not.toHaveBeenCalled();
    });

    it('returns 403 when a client tries to self-assign ADMIN', async () => {
      mockReq.body = { email: 'a@example.com', password: 'password123', role: 'ADMIN' };

      await authController.signup(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserModel.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      mockReq.body = { email: 'a@example.com', password: 'password123' };
      UserModel.findByEmail.mockResolvedValue({
        data: { id: 'u1', email: 'a@example.com', role: 'USER', password_hash: 'hash' },
        error: null,
      });
      password.verifyPassword.mockResolvedValue(true);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: { id: 'u1', email: 'a@example.com', role: 'USER' },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('returns 401 on wrong password', async () => {
      mockReq.body = { email: 'a@example.com', password: 'wrong' };
      UserModel.findByEmail.mockResolvedValue({
        data: { id: 'u1', email: 'a@example.com', role: 'USER', password_hash: 'hash' },
        error: null,
      });
      password.verifyPassword.mockResolvedValue(false);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 for an unknown email', async () => {
      mockReq.body = { email: 'ghost@example.com', password: 'password123' };
      UserModel.findByEmail.mockResolvedValue({ data: null, error: null });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('refresh', () => {
    it('rotates tokens on a valid refresh token', async () => {
      mockReq.body = { refreshToken: 'good-refresh' };
      jwtUtil.verifyRefreshToken.mockReturnValue({ sub: 'u1' });
      UserModel.findRefreshToken.mockResolvedValue({
        data: { token_hash: 'hashed-token', revoked: false, expires_at: '2999-01-01T00:00:00Z' },
        error: null,
      });
      UserModel.findById.mockResolvedValue({
        data: { id: 'u1', email: 'a@example.com', role: 'USER' },
        error: null,
      });
      UserModel.revokeRefreshToken.mockResolvedValue({ data: {}, error: null });

      await authController.refresh(mockReq, mockRes, mockNext);

      expect(UserModel.revokeRefreshToken).toHaveBeenCalledWith('hashed-token');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 401 on an invalid/expired JWT', async () => {
      mockReq.body = { refreshToken: 'bad' };
      jwtUtil.verifyRefreshToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await authController.refresh(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when the stored token is revoked', async () => {
      mockReq.body = { refreshToken: 'revoked' };
      jwtUtil.verifyRefreshToken.mockReturnValue({ sub: 'u1' });
      UserModel.findRefreshToken.mockResolvedValue({
        data: { token_hash: 'hashed-token', revoked: true, expires_at: '2999-01-01T00:00:00Z' },
        error: null,
      });

      await authController.refresh(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserModel.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the supplied refresh token and returns 200', async () => {
      mockReq.body = { refreshToken: 'tok' };
      UserModel.revokeRefreshToken.mockResolvedValue({ data: {}, error: null });

      await authController.logout(mockReq, mockRes, mockNext);

      expect(UserModel.revokeRefreshToken).toHaveBeenCalledWith('hashed-token');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('me', () => {
    it('returns the authenticated user profile', async () => {
      mockReq.user = { id: 'u1' };
      UserModel.findById.mockResolvedValue({
        data: { id: 'u1', email: 'a@example.com', role: 'ADMIN' },
        error: null,
      });

      await authController.me(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'u1', email: 'a@example.com', role: 'ADMIN' },
      });
    });
  });
});
