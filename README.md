# TaskFlow — Task Management Application

A production-ready full-stack Task Management application featuring an Express.js (MVC) REST API backend, a premium React.js frontend, and Supabase (PostgreSQL) as the database.

---

## ✨ Features

- **Task CRUD** — create, read, update, and delete tasks with `PENDING` / `IN_PROGRESS` / `COMPLETED` status, due dates, and Zod-validated payloads.
- **Authentication & authorization** — email/password signup & login, JWT access tokens + rotating refresh tokens (stored hashed, revocable), and role-based access (`USER` vs `ADMIN`).
- **Per-user task scoping** — a `USER` sees only their own tasks; an `ADMIN` sees everyone's.
- **Deletion activity log** — every delete is recorded and viewable via `GET /api/v1/tasks/deleted` and the frontend **Deleted Log** panel.
- **Async report generation** — heavy "report every task + email it" work runs off the request path on a Redis-backed **BullMQ** queue, processed by a **separate worker**, with retries, backoff, and idempotency.
- **Rate limiting** — Redis-backed global and per-user/per-auth limits.
- **Production hardening** — Helmet, HPP, CORS allow-list, request IDs, and structured Winston logging.
- **Tested & containerized** — Jest/Supertest suite with coverage, multi-stage Dockerfiles, Docker Compose stack, and a GitHub Actions CI workflow.

---

## 🚀 Production Engineering & Hardening

Beyond the core app, this repo was taken through a full production-readiness
build-out. Each area has its own detailed doc.

### 1. Observability — see [`OBSERVABILITY.md`](./OBSERVABILITY.md)
- **Prometheus metrics** (RED: rate, errors, duration) on the API and worker, exposed at `/metrics`.
- **Grafana dashboard** (auto-provisioned) with request rate, error rate, p50/p95/p99 latency, and Node event-loop lag.
- **Structured logging with a request ID** that flows through *every* log line (API + worker) via `AsyncLocalStorage`.
- **k6 load tests** (`loadtest/`) that found a bottleneck — `bcryptjs` blocking the event loop — fixed by switching to native `bcrypt`. Before/after: **~13 → ~51 req/s, p95 3.4s → 0.7s, event-loop lag 2.42s → 0.017s.**

### 2. Infrastructure as Code — see [`infra/`](./infra)
- **Terraform** provisions networking (VPC/subnets/SGs), **Secrets Manager**, S3, and the app containers — runnable against **LocalStack** (no cloud account).
- `terraform destroy` then `terraform apply` rebuilds everything from scratch; secrets are generated/stored, never hardcoded.

### 3. Kubernetes (minikube) — see [`k8s/README.md`](./k8s/README.md)
- **Deployment / Service / ConfigMap / Secret**, readiness (`/health`) + liveness (TCP) probes.
- **Zero-downtime rolling update** — `maxUnavailable: 0`, readiness-gated cutover, and a `preStop` drain. `prove.ps1` hammers the Service (~600 requests) through a rollout and reports the OK/FAIL split; run it to generate the evidence (no rollout log is committed to this repo).
- **Scaled to 3 replicas** — each response carries an `X-Pod-Name` header, and `prove.ps1` tallies requests per pod to show load-balancing across them.

### 4. Capstone — multi-service system — see [`capstone/README.md`](./capstone/README.md)
- **2 services** (`tasks-service`, `reports-service`) behind an **NGINX Ingress** gateway.
- **Async messaging** between them via **Redis Streams** (publish/consume).
- **Full CI/CD** (`.github/workflows/`): test → secret scan (Gitleaks) → build → **Trivy image/fs scan (fails on HIGH/CRITICAL)** → SBOM → deploy.
- **Deployed via Terraform to Kubernetes**, with monitoring and a defence-grade **security pass**: PSS `restricted`, default-deny **NetworkPolicies**, least-privilege **ServiceAccounts**, non-root/read-only/drop-caps containers, and a **tamper-evident audit log** (request-ID-correlated JSON) of every authn/authz/data-mutation/event. Records are linked in an **HMAC-SHA256 hash chain** (`seq` + `prevHash` + `hash`, key never logged), so any edit, deletion, insertion, or reordering is detectable — verify with `npm run verify:audit` (`backend/scripts/verify-audit.js`). To also catch wholesale truncation of the tail, anchor the latest `hash` in an external append-only store.

### 5. Security hardening (defence-grade)
All 18 review findings plus an attack-surface audit were resolved (see [`SECURITY-FIXES.md`](./SECURITY-FIXES.md)). Highlights:
- **Locked down RLS** and switched the backend to the **service-role key** — the anon/publishable key can no longer read or write the database (previously it exposed password hashes and refresh tokens). *Verified live: anon key now returns HTTP 401.*
- Pinned JWT algorithm (`HS256`); JWT secrets **required in every environment**.
- `trust proxy` set so rate limiting works behind an ingress.
- **Constant-time login** (no account-enumeration timing oracle).
- **Atomic deletion logging** via a DB trigger; `deleted_tasks → users` foreign key.
- Per-user report idempotency keys; sanitized job errors; SMTP **fails loudly** in production.
- Comprehensive `.gitignore` for secrets, Terraform state/vars, and keys; `coverage/` un-tracked.

---

## 🧰 Tech Stack

| Layer        | Technologies |
|--------------|--------------|
| **Backend**  | Node.js, Express.js, Zod, JWT (`jsonwebtoken`), `bcryptjs`, BullMQ + `ioredis`, `nodemailer`, Helmet, HPP, Winston |
| **Frontend** | React 18, Vite, native Fetch API |
| **Database** | Supabase (PostgreSQL) |
| **Infra**    | Redis, Docker / Docker Compose, Nginx (frontend serving), GitHub Actions (CI) |
| **Testing**  | Jest, Supertest |

---

## 🏗️ Architecture: MVC

This project is built using a clean Model-View-Controller pattern:
- **Model** (`backend/src/models/task.model.js`): Manages data access to Supabase PostgreSQL database and validates payloads using Zod schemas.
- **Controller** (`backend/src/controllers/task.controller.js`): Handles request parsing, triggers validations, calls models, and formats responses.
- **View** (`frontend/src/`): React dashboard providing visual interfaces. Communicates with backend endpoints.

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

Create a `.env` file in the `backend/` directory:

```env
PORT=3001
NODE_ENV=development

# Supabase database config
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# CORS configuration
CORS_ORIGIN=http://localhost:5173

# JWT / Auth (REQUIRED in production — set strong random secrets)
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
REFRESH_EXPIRY_DAYS=7
BCRYPT_ROUNDS=10

# Redis (REQUIRED — backs rate limiting, no in-memory fallback)
REDIS_URL=redis://localhost:6379

# Security rate limits
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10

# Winston logs
LOG_LEVEL=info
```

> **Auth & roles:** Users sign up / log in for a JWT **access token** (short-lived) plus a **refresh token** (stored hashed in the DB, rotated on each refresh and revocable). Tasks are scoped by role — a `USER` sees only their own tasks, an `ADMIN` sees everyone's. Promote a user to admin by setting `role = 'ADMIN'` on their row in the `users` table.

> **Redis is required.** Rate limiting is backed by Redis with no fallback, so a Redis instance must be running for the API to serve traffic (locally: `docker run -p 6379:6379 redis:7-alpine`, or use `docker-compose` which now includes a `redis` service).

---

## 🗄️ Database Setup (Supabase / PostgreSQL)

Run the SQL migration in `supabase/migrations/001_create_tasks.sql` inside your Supabase SQL Editor:

```sql
-- Create task status enum
CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- Create tasks table
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  status      task_status NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize queries with indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Automated trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Then run the remaining migrations **in order** in the same SQL Editor:
- `supabase/migrations/002_create_deleted_tasks.sql` — deletion activity log
- `supabase/migrations/003_create_auth.sql` — `users`, `refresh_tokens`, and task ownership (`tasks.user_id`)
- `supabase/migrations/004_security_hardening.sql` — **required**: atomic deletion logging (trigger), `deleted_tasks → users` FK, and **locks down RLS** so the anon key grants no access

> **Use the service-role key, not the anon key.** The backend must be run with
> `SUPABASE_SERVICE_ROLE_KEY` (server-side only). After migration 004 the anon
> key can read/write nothing, so password hashes and refresh tokens are no
> longer reachable via the public REST API. `SUPABASE_SERVICE_ROLE_KEY` is
> **required in production** (the app refuses to start on the anon key).

To populate your database with dummy data, execute the contents of `supabase/seed.sql`.

---

## 🚀 Running the Project

### Method 1: Docker Compose (Recommended)

1. Ensure Docker Desktop is installed and running.
2. In the root directory, create a `.env` file (or expose them as environment variables) containing:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Run the following command to spin up the entire application stack:
   ```bash
   docker-compose up --build
   ```
4. Access the applications:
   - **Frontend Dashboard**: [http://localhost](http://localhost)
   - **Backend API**: [http://localhost:3001](http://localhost:3001)

#### Useful Docker Commands:
- **Stop containers**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **Inspect health status**: `docker-compose ps`

---

### Method 2: Manual Local Development

#### 1. Start the Backend:
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:3001`.

#### 2. Start the Background Worker (required for report jobs):
```bash
cd backend
npm run worker        # or: npm run worker:dev (nodemon)
```
The worker is a **separate process** from the API. It consumes report jobs
from the Redis queue, so it needs the same `REDIS_URL` and Supabase config.
(Under Docker Compose this runs automatically as the `worker` service.)

#### 3. Start the Frontend:
```bash
cd frontend
npm install
npm run dev
```
The React development server will run on `http://localhost:5173`.

---

## 🧪 Running Tests

A comprehensive test suite using Jest and Supertest validates the API endpoints, controller responses, error handling, request parameter formatting, and input validations.

```bash
cd backend

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration/E2E tests only
npm run test:e2e
```

---

## 📡 API Reference

### Response Formats

#### Success Example:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Build production API",
    "status": "PENDING"
  }
}
```

#### Error Example:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

---

### Authentication

All `/api/v1/tasks` endpoints require an `Authorization: Bearer <accessToken>` header. Obtain tokens via the auth endpoints below.

#### Sign up
`POST /api/v1/auth/signup`
```bash
curl -i -X POST http://localhost:3001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

#### Log in
`POST /api/v1/auth/login`
```bash
curl -i -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```
Both return `{ user, accessToken, refreshToken }`.

#### Refresh tokens
`POST /api/v1/auth/refresh` — rotates the refresh token and returns a new pair.
```bash
curl -i -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>"}'
```

#### Logout / Profile
`POST /api/v1/auth/logout` (revokes a refresh token) · `GET /api/v1/auth/me` (current user; requires access token).

---

### Endpoints & CURL Examples

> Replace `$TOKEN` with an access token from login/signup.

#### 1. Health Status
`GET /health`
```bash
curl -i http://localhost:3001/health
```

#### 2. Get All Tasks
`GET /api/v1/tasks` — returns the caller's tasks (all tasks for admins).
```bash
curl -i http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Get Deletion Log
`GET /api/v1/tasks/deleted` — returns the log of deleted tasks (scoped by role).
```bash
curl -i http://localhost:3001/api/v1/tasks/deleted \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Create Task
`POST /api/v1/tasks`
```bash
curl -i -X POST http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement Docker Containerization", "description": "Configure multi-stage Dockerfiles and compose configuration", "status": "IN_PROGRESS"}'
```

#### 5. Get Task By ID
`GET /api/v1/tasks/{id}`
```bash
curl -i http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Update Task
`PUT /api/v1/tasks/{id}`
```bash
curl -i -X PUT http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}'
```

#### 7. Delete Task
`DELETE /api/v1/tasks/{id}`
```bash
curl -i -X DELETE http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⏳ Background Jobs — Report Generation & Email Notification

Generating a report over every task (and emailing it) is **slow**, so it is
pushed **off the API request path** onto a **Redis-backed queue (BullMQ)** and
processed by a **separate worker process**. The API enqueues the job and
returns immediately; the worker does the work in the background.

```
POST /api/v1/reports ──▶ enqueue on Redis queue ──▶ 202 { jobId }   (returns instantly)
                                  │
                          (separate worker process)
                                  ▼
                    aggregate tasks → send email → store result
                                  │
GET /api/v1/reports/:jobId ◀──────┘  poll: queued → active → completed/failed
```

**What it demonstrates**
- **Off-the-API processing** — the heavy work runs in `backend/worker.js`, a
  process independent of the API. The API never blocks on it.
- **Immediate response** — enqueue returns `202 Accepted` with a `jobId`.
- **Automatic retries** — failed jobs are retried (default 3 attempts) with
  exponential backoff (~2s, 4s, 8s). Set `REPORT_FAIL_RATE=0.5` to watch
  retries happen in the worker logs.
- **Idempotency (runs twice safely)** — two ways:
  1. *Submission* — send an `Idempotency-Key` header; repeating a request with
     the same key returns the **same** job instead of queueing a duplicate.
  2. *Processing* — the email step is guarded by an atomic Redis claim
     (`SET NX`), so even if a job is processed more than once (retry /
     at-least-once delivery) the notification is sent **at most once**.

#### Request a report (enqueue)
`POST /api/v1/reports`
```bash
curl -i -X POST http://localhost:3001/api/v1/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: my-unique-key-123"
# → 202 { "success": true, "data": { "jobId": "...", "status": "queued", "statusUrl": "/api/v1/reports/..." } }
```

#### Poll job status / fetch the report
`GET /api/v1/reports/{jobId}`
```bash
curl -i http://localhost:3001/api/v1/reports/<jobId> \
  -H "Authorization: Bearer $TOKEN"
# while running:  { "status": "active", "progress": 70, "attemptsMade": 1 }
# when done:      { "status": "completed", "report": { "totals": { ... }, "completionRate": 50 } }
```

> The report is scoped like the task list — a `USER` sees only their own
> tasks, an `ADMIN` sees everyone's. Polling another user's job returns 404.

---

## 📁 Project Structure

```
Task1/
├── backend/
│   ├── server.js                 # API entry point
│   ├── worker.js                 # Background worker entry point (report jobs)
│   └── src/
│       ├── app.js                # Express app: security, middleware, routes
│       ├── config/               # env, supabase, redis clients
│       ├── controllers/          # auth, task, report, health
│       ├── middleware/           # authenticate, authorize, rateLimiter, validate, errorHandler, ...
│       ├── models/               # task & user models (Zod schemas + data access)
│       ├── routes/               # auth, task, report, health routers
│       ├── services/             # report.service, email.service
│       ├── queue/                # BullMQ connection + report queue
│       ├── workers/              # report.worker (job processor)
│       └── utils/                # jwt, password, logger, responseHelper
│   └── tests/                    # Jest unit + integration (Supertest) suites
├── frontend/
│   └── src/
│       ├── pages/                # AuthPage, Dashboard
│       ├── components/           # Header, TaskCard, TaskModal, StatusBadge, ConfirmDialog, DeletedLog
│       ├── hooks/                # useAuth, useTasks
│       ├── services/api.js       # backend API client
│       └── styles/index.css
├── supabase/
│   ├── migrations/               # 001 tasks, 002 deleted_tasks, 003 auth
│   └── seed.sql                  # dummy data
├── docker-compose.yml            # redis + api + worker + frontend
└── .github/workflows/ci.yml      # CI pipeline
```
