const request = require('supertest');
const express = require('express');
const { createRateLimiter } = require('../../src/middleware/rateLimiter');

// In the test environment the limiter uses an in-memory store (no Redis),
// so these tests are hermetic.
describe('Rate limiter middleware', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
  });

  const buildApp = (max) => {
    const app = express();
    // Optionally attach a user from a header so we can test per-user keys.
    app.use((req, _res, next) => {
      if (req.headers['x-user']) req.user = { id: req.headers['x-user'], role: 'USER' };
      next();
    });
    app.use(createRateLimiter({ windowMs: 60_000, max, prefix: 'test' }));
    app.get('/ping', (_req, res) => res.json({ success: true, data: 'pong' }));
    return app;
  };

  it('allows requests up to the limit then returns 429', async () => {
    const app = buildApp(2);

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);

    const res = await request(app).get('/ping');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: 'Too many requests, please try again later',
      errors: [],
    });
  });

  it('counts limits independently per user id', async () => {
    const app = buildApp(1);

    // user A consumes their single allowance
    await request(app).get('/ping').set('x-user', 'user-A').expect(200);
    await request(app).get('/ping').set('x-user', 'user-A').expect(429);

    // user B is unaffected
    await request(app).get('/ping').set('x-user', 'user-B').expect(200);
  });

  it('sets standard RateLimit headers', async () => {
    const app = buildApp(5);
    const res = await request(app).get('/ping');
    expect(res.headers['ratelimit-limit']).toBe('5');
  });
});
