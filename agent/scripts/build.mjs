import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/agent.mjs",
  external: ["better-sqlite3"],
  banner: {
    js: [
      '// ESM ↔ CJS bridge for native modules',
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join("\n"),
  },
  sourcemap: true,
  logLevel: "info",
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.error("[agent] watching for changes...");
} else {
  await build(options);
}
