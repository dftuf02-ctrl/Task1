-- ============================================================
-- Deleted Tasks Log
-- Records a row every time a task is deleted, so the
-- dashboard can show a "Recently Deleted" activity log.
-- ============================================================

-- Reuse the task_status enum created in 001_create_tasks.sql.
-- (Created defensively here in case this migration runs standalone.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS deleted_tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL,                 -- original task id
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  status      task_status NOT NULL,
  due_date    TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Most-recent-first lookups for the log view
CREATE INDEX IF NOT EXISTS idx_deleted_tasks_deleted_at
  ON deleted_tasks(deleted_at DESC);

-- Match the RLS posture of the tasks table (public API)
ALTER TABLE deleted_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on deleted_tasks" ON deleted_tasks;
CREATE POLICY "Allow all operations on deleted_tasks" ON deleted_tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);
