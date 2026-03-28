-- Make inbox_items.run_id nullable to support job-level dashboard items with no associated run.
-- SQLite does not support ALTER COLUMN, so we recreate the table.
-- DROP TABLE does not trigger FK cascades in SQLite (only DELETE does).

CREATE TABLE inbox_items_new (
  id         TEXT PRIMARY KEY NOT NULL,
  run_id     TEXT REFERENCES runs(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

--> statement-breakpoint

INSERT INTO inbox_items_new SELECT * FROM inbox_items;

--> statement-breakpoint

DROP TABLE inbox_items;

--> statement-breakpoint

ALTER TABLE inbox_items_new RENAME TO inbox_items;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_inbox_project_status ON inbox_items(project_id, status);
