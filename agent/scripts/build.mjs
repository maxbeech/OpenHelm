import { build, context } from "esbuild";
import { copyFileSync, chmodSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/agent.js",
  external: ["better-sqlite3", "@xenova/transformers", "onnxruntime-node", "sharp"],
  loader: { ".sql": "text" },
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'module';\nconst require = createRequire(import.meta.url);",
  },
  sourcemap: true,
  logLevel: "info",
};

/** Copy built agent to Tauri sidecar binaries directory */
function copySidecarBinaries() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dist = resolve(__dirname, "..", "dist", "agent.js");
  const binDir = resolve(__dirname, "..", "..", "src-tauri", "binaries");
  if (!existsSync(binDir)) return;

  for (const target of ["agent-aarch64-apple-darwin", "agent-x86_64-apple-darwin"]) {
    const dest = resolve(binDir, target);
    copyFileSync(dist, dest);
    chmodSync(dest, 0o755);
    // Ad-hoc codesign so macOS allows execution (provenance attribute blocks unsigned files)
    try { execFileSync("codesign", ["--force", "--sign", "-", dest]); } catch { /* ok on non-macOS */ }
  }
  console.error("[agent] copied to src-tauri/binaries/");
}

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.error("[agent] watching for changes...");
} else {
  await build(options);
  copySidecarBinaries();

  // Upload source maps to Sentry (only in CI/release with auth token present)
  if (process.env.SENTRY_AUTH_TOKEN) {
    const { execFileSync } = await import("child_process");
    try {
      execFileSync(
        "sentry-cli",
        [
          "sourcemaps",
          "upload",
          "--org",
          "openhelm",
          "--project",
          "openhelm-agent",
          "dist/",
        ],
        { stdio: "inherit", env: process.env },
      );
    } catch (e) {
      console.error(
        "[agent] source map upload failed (non-fatal):",
        e.message,
      );
    }
  }
}
