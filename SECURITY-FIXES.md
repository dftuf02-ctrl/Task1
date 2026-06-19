# Security Fixes & Hardening

All 18 review findings, plus an additional attack-surface audit, resolved and
(where possible) verified against the live system.

## Critical
- **#8/#9 — RLS lockdown + service-role key.** The backend used the Supabase
  *anon* (browser) key while every RLS policy allowed everything, so anyone
  with the anon key could read/write the whole database — including password
  hashes and refresh tokens. Fixed in migration `004`: dropped the permissive
  policies and revoked `anon`/`authenticated`; the backend now uses the
  **service-role** key. **Verified live:** the anon key now returns `HTTP 401`
  on `users` and `refresh_tokens`; the service-role path works.

## Task 1 — Core API
- **#1** Removed the committed `coverage/` build output from git; added to `.gitignore`.
- **#2** `coverage/` was a stray local artifact (now untracked) — not a built page.
- **#3** Deletion + log are now **atomic**: a `BEFORE DELETE` trigger (migration `004`) writes `deleted_tasks` in the same transaction, so they can't drift and a log failure rolls the delete back.
- **#4** Added FK `deleted_tasks.user_id → users(id)`.
- **#5** Best-effort owner backfill for existing `deleted_tasks` rows (migration `004`).
- **#6** Added a real-Redis integration test (`tests/integration/eventStream.integration.test.js`).
- **#7** CI now runs an integration job with **real Redis + Postgres** service containers (not mocked).

## Task 2 — Auth & Security
- **#10** JWT verification pins `{ algorithms: ['HS256'] }`.
- **#11** JWT secrets are **required in every environment** (no hardcoded defaults).
- **#12** `app.set('trust proxy', …)` so `req.ip` is the real client IP behind an ingress (rate limiting works).
- **#13** **Constant-time login** — a dummy bcrypt compare runs on the no-such-user path (no timing oracle for account enumeration).
- **#14** Frontend: on genuine session end the UI logs the user out (no stranded "logged-in" state).
- **#15** Frontend: a transient network blip during refresh no longer logs the user out permanently.

## Task 3 — Async Reports
- **#16** Idempotency key is scoped per-user (`report:<userId>:<key>`) — no cross-user collisions.
- **#17** Job failures are logged server-side; the client gets a generic message (no raw internal error).
- **#18** Missing `SMTP_URL` in production **fails loudly** instead of silently using the no-op transport.

## Additional audit (no-bypass / no-injection)
- **Mass assignment** blocked: `validate` replaces `req.body` with Zod-parsed data (unknown keys stripped); `user_id`/`role` can't be injected — ownership is always set from the JWT.
- **Injection**: all DB access is parameterized via the Supabase client; Redis uses arg-separated commands. No string concatenation.
- **Secrets in git**: none tracked; comprehensive `.gitignore` for `.env`, Terraform `*.tfstate`/`*.tfvars`, and keys/certs across all directories.
- **Audit logging**: tamper-evident structured records for every authn, authz-deny, data mutation, and consumed async event. Records are linked in an HMAC-SHA256 hash chain (`seq`/`prevHash`/`hash`, key never logged), so any edit/deletion/reordering is detectable via `npm run verify:audit`. (Anchor the latest hash externally to also detect tail-truncation; a WORM store still adds availability/retention guarantees.)

## Required for production
- Set `SUPABASE_SERVICE_ROLE_KEY` (server-side only) and run migration `004`.
- The backend refuses to start on the anon key in `NODE_ENV=production` — by design.
