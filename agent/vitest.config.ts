import { defineConfig, type Plugin } from "vitest/config";

// Treat .sql files as plain text strings (mirrors esbuild's `loader: { '.sql': 'text' }`)
const sqlTextPlugin: Plugin = {
  name: "sql-text",
  transform(code, id) {
    if (id.endsWith(".sql")) {
      return { code: `export default ${JSON.stringify(code)}`, map: null };
    }
  },
};

export default defineConfig({
  plugins: [sqlTextPlugin],
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
