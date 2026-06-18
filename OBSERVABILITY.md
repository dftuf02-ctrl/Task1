# Observability & Load Testing — TaskFlow

This document covers the observability stack added to the API (Prometheus
metrics, Grafana dashboard, request-ID-correlated structured logs) and the
k6 load test used to find, fix, and measure a performance bottleneck.

---

## 1. What was added

| Area | What | Where |
|---|---|---|
| **Metrics** | `prom-client` registry, default Node metrics, RED metrics (`http_requests_total`, `http_request_duration_seconds`), worker job metrics | `backend/src/config/metrics.js`, `backend/src/middleware/metrics.js` |
| **`/metrics` endpoint** | Exposed on the API (port 3001) and the worker (port 9101), outside auth + rate limiting | `backend/src/app.js`, `backend/src/workers/metricsServer.js` |
| **Request-ID logging** | `AsyncLocalStorage` context so the `requestId` flows through **every** log line automatically (API and worker) | `backend/src/utils/requestContext.js`, `logger.js`, `middleware/requestId.js` |
| **Dashboards** | Prometheus + Grafana services, auto-provisioned datasource + RED dashboard | `docker-compose.yml`, `observability/` |
| **Load test** | k6 scripts (JavaScript) for auth and task CRUD | `loadtest/auth.js`, `loadtest/tasks.js` |
| **The fix (toggle)** | `PASSWORD_HASH=bcryptjs` (baseline) vs `native` (fix) — no code change between runs | `backend/src/utils/password.js`, `config/env.js` |

### Request ID flows through every log line
Previously the `requestId` only appeared where a controller passed it by
hand. Now `requestId` middleware opens an `AsyncLocalStorage` context, and the
Winston logger injects that id into every record — so logs from models,
services, and the worker are all correlated without threading the id through
function signatures. The worker re-opens the context from `job.data.requestId`,
so background-job logs share the same correlation id as the API request that
enqueued them.

---

## 2. Run the stack with dashboards

```bash
# from repo root — needs SUPABASE_URL / SUPABASE_ANON_KEY / JWT secrets in .env
docker compose up -d --build
```

- API:        http://localhost:3001  ·  metrics: http://localhost:3001/metrics
- Worker:     metrics on http://localhost:9101/metrics (in-network)
- Prometheus: http://localhost:9090  (Status → Targets should show both UP)
- Grafana:    http://localhost:3000  → dashboard **“TaskFlow — API Observability (RED)”**

> Local (non-Docker) alternative: `npm run dev` + `npm run worker` in `backend/`,
> run Prometheus/Grafana pointed at `localhost:3001` / `localhost:9101`.

---

## 3. Install k6 (load generator)

k6 test scripts are plain JavaScript (matches this stack); the runner itself
is a standalone binary:

```bash
winget install k6          # Windows
# choco install k6         # or Chocolatey
# brew install k6          # macOS
```

---

## 4. Produce before/after numbers

The bottleneck is password hashing on the Node event loop: the project uses
**`bcryptjs` (pure-JS)**, so every `login`/`signup` hash runs on the single
event-loop thread and serializes the whole process under load. The fix is
**native `bcrypt`**, which runs hashing on the libuv threadpool.

> Install native bcrypt first so the fix run has it available:
> `cd backend && npm install` (it's an optionalDependency; needs build tools).

### Run A — baseline (bcryptjs)
```bash
# raise rate limits for the test + select baseline hashing
PASSWORD_HASH=bcryptjs docker compose \
  -f docker-compose.yml -f docker-compose.loadtest.yml up -d --build

k6 run loadtest/auth.js
```
Watch in Grafana: **p95/p99 latency** climbs, **event-loop lag** spikes,
throughput plateaus. k6 thresholds (`p95<500ms`) will FAIL.

### Run B — fix (native bcrypt)
```bash
PASSWORD_HASH=native docker compose \
  -f docker-compose.yml -f docker-compose.loadtest.yml up -d --build

k6 run loadtest/auth.js
```
Throughput rises, p99 drops, event-loop lag stays flat, thresholds PASS.

### Record the result
Take these from the k6 summary (`http_reqs` rate, `http_req_duration` p95/p99,
`http_req_failed`) and the Grafana event-loop panel:

| Metric | Baseline (bcryptjs) | After fix (native bcrypt) |
|---|---|---|
| Throughput (req/s) | … | … |
| p95 latency | … | … |
| p99 latency | … | … |
| Error rate | … | … |
| Event-loop lag (p99) | … | … |

---

## 5. Methodology notes (so the numbers are honest)
- **Change one variable.** Keep rate limits, VU profile, and env identical
  across runs; only `PASSWORD_HASH` changes.
- **The rate limiter is a *false* bottleneck.** Without the loadtest override
  you'd hit `429` after `AUTH_RATE_LIMIT_MAX` (10) requests and "find" the
  limiter instead of the real issue — hence `docker-compose.loadtest.yml`.
- **Secondary bottleneck:** `loadtest/tasks.js` stresses Supabase round-trips
  (network-bound; update/delete do find-then-mutate = two hops). Use it to
  show the next ceiling once hashing is fixed.
- **Cardinality:** HTTP metrics are labeled by route *template*
  (`/api/v1/tasks/:id`), never the raw URL, to keep Prometheus series bounded.
