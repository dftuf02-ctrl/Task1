const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} = require('../../src/utils/jwt');

describe('JWT utilities', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  const user = { id: 'u1', email: 'a@example.com', role: 'ADMIN' };

  it('signs and verifies an access token carrying identity + role', () => {
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@example.com');
    expect(payload.role).toBe('ADMIN');
    expect(payload.type).toBe('access');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(user);
    const payload = verifyRefreshToken(token);

    expect(payload.sub).toBe('u1');
    expect(payload.type).toBe('refresh');
    expect(payload.jti).toBeDefined();
  });

  it('rejects a token signed with a different secret (access vs refresh)', () => {
    const refresh = signRefreshToken(user);
    expect(() => verifyAccessToken(refresh)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(user);
    expect(() => verifyAccessToken(token + 'x')).toThrow();
  });

  it('hashToken is deterministic and produces a 64-char hex digest', () => {
    const a = hashToken('some-token');
    const b = hashToken('some-token');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken('other')).not.toBe(a);
  });
});
