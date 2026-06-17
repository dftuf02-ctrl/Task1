const { hashPassword, verifyPassword } = require('../../src/utils/password');

describe('Password utilities', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
    process.env.BCRYPT_ROUNDS = '4'; // keep tests fast
  });

  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('s3cret-password');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword('s3cret-password', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
