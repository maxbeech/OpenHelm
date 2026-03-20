import { defineConfig } from "drizzle-kit";
import { join } from "path";
import { homedir } from "os";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(
      process.env.OPENHELM_DATA_DIR || join(homedir(), ".openhelm"),
      "openhelm.db",
    ),
  },
});
