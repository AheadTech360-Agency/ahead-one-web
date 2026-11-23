// Copies the API's generated TypeScript types into src/lib/api/generated.
// Expects ahead-one-api checked out next to this repo, or set API_REPO=/path/to/ahead-one-api.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRepo = resolve(process.env.API_REPO ?? join(root, "..", "ahead-one-api"));
const src = join(apiRepo, "bindings");
const dest = join(root, "src", "lib", "api", "generated");
if (!existsSync(join(src, "index.ts"))) {
  console.error(`No bindings found at ${src}. Run \`cargo test && node scripts/gen-index.mjs\` in ahead-one-api first.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Synced API types from ${src}`);
