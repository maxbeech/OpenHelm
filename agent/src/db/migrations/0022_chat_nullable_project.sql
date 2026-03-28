-- Make conversations.project_id nullable to support an "All Projects" chat thread.
-- SQLite does not support ALTER COLUMN, so we recreate the table.
-- DROP TABLE does not trigger FK cascades in SQLite (only DELETE does).

CREATE TABLE conversations_new (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'app',
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

INSERT INTO conversations_new SELECT * FROM conversations;

--> statement-breakpoint

DROP TABLE conversations;

--> statement-breakpoint

ALTER TABLE conversations_new RENAME TO conversations;

--> statement-breakpoint

CREATE INDEX idx_conversations_project ON conversations(project_id);
