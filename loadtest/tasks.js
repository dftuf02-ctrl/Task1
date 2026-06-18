import http from 'k6/http';
import { check } from 'k6';

/**
 * Task CRUD load test — authenticates once, then drives the read/write task
 * endpoints. Useful for surfacing the SECONDARY bottleneck: external
 * Supabase round-trips (every read/write is a network hop, and update/delete
 * do find-then-mutate = two hops).
 *
 * Run:
 *   k6 run loadtest/tasks.js
 *
 * NOTE: raise RATE_LIMIT_MAX for the test or the per-user limiter returns
 * 429 after RATE_LIMIT_MAX requests in the window.
 */
const BASE = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export const options = {
  scenarios: {
    task_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '1m', target: 75 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function setup() {
  const creds = { email: `loadtest_tasks_${Date.now()}@test.com`, password: 'password123' };
  const res = http.post(`${BASE}/auth/signup`, JSON.stringify(creds), { headers: JSON_HEADERS });
  check(res, { 'setup: signed up': (r) => r.status === 201 || r.status === 409 });
  const body = res.json();
  const token = body && body.data && body.data.accessToken;
  return { token };
}

export default function (data) {
  const authHeaders = { headers: { ...JSON_HEADERS, Authorization: `Bearer ${data.token}` } };

  // Create
  const created = http.post(
    `${BASE}/tasks`,
    JSON.stringify({ title: `task-${__VU}-${__ITER}`, status: 'PENDING' }),
    authHeaders,
  );
  check(created, { 'create 201': (r) => r.status === 201 });

  // List
  const list = http.get(`${BASE}/tasks`, authHeaders);
  check(list, { 'list 200': (r) => r.status === 200 });

  // Update the just-created task, then delete it.
  const id = created.json('data.id');
  if (id) {
    const updated = http.put(
      `${BASE}/tasks/${id}`,
      JSON.stringify({ status: 'COMPLETED' }),
      authHeaders,
    );
    check(updated, { 'update 200': (r) => r.status === 200 });

    const deleted = http.del(`${BASE}/tasks/${id}`, null, authHeaders);
    check(deleted, { 'delete 200': (r) => r.status === 200 });
  }
}
