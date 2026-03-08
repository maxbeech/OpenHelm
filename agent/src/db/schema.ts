import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Key-value settings store. Used for user preferences, API keys, etc. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
