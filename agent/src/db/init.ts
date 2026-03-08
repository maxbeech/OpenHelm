import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as schema from "./schema.js";

const DATA_DIR = join(homedir(), ".openorchestra");
const DB_PATH = join(DATA_DIR, "openorchestra.db");

export function initDatabase() {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  // Enforce foreign key constraints
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Run migrations
  const migrationsPath =
    process.env.OPENORCHESTRA_MIGRATIONS_PATH ||
    join(import.meta.dirname, "migrations");

  migrate(db, { migrationsFolder: migrationsPath });

  console.error(`[agent] database initialized at ${DB_PATH}`);
  return db;
}
