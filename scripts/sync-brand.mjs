#!/usr/bin/env node
// Copies brand.css (the source of truth) into the sibling tool repos, which carry a
// vendored copy so the stylesheet is same-origin and cached by their own offline shells.
//
//   node scripts/sync-brand.mjs            copy to every sibling checkout that exists
//   node scripts/sync-brand.mjs --check    exit 1 if any copy has drifted (no writes)
//
// Sibling checkouts are expected next to this one (../quiz_pbefocus_com, ../karaoke_pbefocus_com);
// override with QUIZ_DIR / KARAOKE_DIR.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const targets = [
  process.env.QUIZ_DIR || path.join(root, "..", "quiz_pbefocus_com"),
  process.env.KARAOKE_DIR || path.join(root, "..", "karaoke_pbefocus_com"),
].map((dir) => path.join(dir, "assets", "css", "brand.css"));

const source = await fs.readFile(path.join(root, "brand.css"), "utf8");
let drifted = 0;
for (const target of targets) {
  const have = await fs.readFile(target, "utf8").catch(() => null);
  if (have === source) {
    console.log(`up to date  ${target}`);
  } else if (check) {
    drifted++;
    console.log(`DRIFTED     ${target}${have === null ? " (missing)" : ""}`);
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, source);
    console.log(`copied      ${target}`);
  }
}
if (drifted) process.exit(1);
