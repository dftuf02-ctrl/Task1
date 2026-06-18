import http from 'k6/http';
import { check } from 'k6';

/**
 * Auth load test — drives /auth/login, which runs bcrypt.compare on every
 * request. With PASSWORD_HASH=bcryptjs (baseline) this hashing happens on
 * the Node event loop and serializes the whole process; watch p95/p99 and
 * the "event-loop lag" Grafana panel climb. With PASSWORD_HASH=native (the
 * fix) hashing moves to the libuv threadpool and throughput recovers.
 *
 * Run:
 *   k6 run loadtest/auth.js
 *   k6 run -e BASE_URL=http://localhost:3001/api/v1 loadtest/auth.js
 *
 * NOTE: raise the API's rate limits for the test (see OBSERVABILITY.md),
 * otherwise the auth limiter returns 429 after AUTH_RATE_LIMIT_MAX requests.
 */
const BASE = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export const options = {
  scenarios: {
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // These intentionally FAIL on the bcryptjs baseline and PASS after the
    // native-bcrypt fix — that contrast is the deliverable.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// setup() runs once: create the user we'll repeatedly log in as.
export function setup() {
  const creds = { email: `loadtest_${Date.now()}@test.com`, password: 'password123' };
  const res = http.post(`${BASE}/auth/signup`, JSON.stringify(creds), JSON_HEADERS);
  check(res, { 'setup: user created or exists': (r) => r.status === 201 || r.status === 409 });
  return creds;
}

export default function (creds) {
  const res = http.post(`${BASE}/auth/login`, JSON.stringify(creds), JSON_HEADERS);
  check(res, {
    'login 200': (r) => r.status === 200,
    'not rate-limited (429)': (r) => r.status !== 429,
  });
}
