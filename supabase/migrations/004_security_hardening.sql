-- ============================================================
-- 004 — Security hardening & data-integrity fixes
--   (#3) atomic delete+log via trigger
--   (#4) FK deleted_tasks.user_id -> users
--   (#5) backfill owners where recoverable
--   (#8/#9) lock down RLS — anon/authenticated get nothing; the backend
--           uses the SERVICE-ROLE key, which bypasses RLS.
-- ============================================================

-- ── (#5) Best-effort owner backfill ─────────────────────────
-- Owners of already-deleted tasks generally can't be recovered (the source
-- row is gone); recover any case where a task with the same id still exists.
UPDATE deleted_tasks d
SET user_id = t.user_id
FROM tasks t
WHERE d.task_id = t.id AND d.user_id IS NULL;

-- ── (#4) Foreign key to users ───────────────────────────────
ALTER TABLE deleted_tasks DROP CONSTRAINT IF EXISTS fk_deleted_tasks_user;
ALTER TABLE deleted_tasks
  ADD CONSTRAINT fk_deleted_tasks_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ── (#3) Atomic deletion logging ────────────────────────────
-- A BEFORE DELETE trigger writes the log row in the SAME transaction as the
-- delete, so the task delete and its log entry can never drift apart (and a
-- log failure rolls the whole delete back). Replaces best-effort app logging.
CREATE OR REPLACE FUNCTION log_task_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deleted_tasks (task_id, title, description, status, due_date, user_id)
  VALUES (OLD.id, OLD.title, OLD.description, OLD.status, OLD.due_date, OLD.user_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_task_deletion ON tasks;
CREATE TRIGGER trg_log_task_deletion
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_deletion();

-- ── (#8/#9) Lock down RLS ───────────────────────────────────
-- Drop the permissive "allow everything" policies. With RLS enabled and no
-- permissive policy, the anon/authenticated roles are denied by default — so
-- a leaked browser (anon) key can read/write NOTHING, including password
-- hashes and refresh tokens. The server's service-role key bypasses RLS.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on tasks" ON tasks;
REVOKE ALL ON tasks FROM anon, authenticated;

ALTER TABLE deleted_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on deleted_tasks" ON deleted_tasks;
REVOKE ALL ON deleted_tasks FROM anon, authenticated;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
REVOKE ALL ON users FROM anon, authenticated;

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on refresh_tokens" ON refresh_tokens;
REVOKE ALL ON refresh_tokens FROM anon, authenticated;
