/**
 * pnpm check:data [--allow-unverified] [--report]
 * Validates every data file and its verification status. Exits 1 on errors.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { validateDataset } from "../src/data/validate.ts";
import { loadDataset, VERIFY_DIR } from "./lib.ts";

const args = new Set(process.argv.slice(2));
const input = loadDataset();
if (!input.glottolog) console.warn("! Glottolog cache missing: run `pnpm glotto fetch` to check glottocodes.");
const result = validateDataset(input, { allowUnverified: args.has("--allow-unverified") });

const errors = result.issues.filter(i => i.level === "error");
const warnings = result.issues.filter(i => i.level === "warning");
const showWarnings = args.has("--warnings");
for (const i of errors) console.log(`✗ ${i.where}: ${i.message}`);
if (showWarnings) for (const i of warnings) console.log(`! ${i.where}: ${i.message}`);

const count = (s: string) => result.claims.filter(c => c.status === s).length;
const languoids = result.families.reduce((n, f) => n + f.data.languoids.length, 0);
const works = result.families.reduce((n, f) => n + f.data.languoids.reduce((m, l) => m + l.works.length, 0), 0);
console.log(
  `\n${result.families.length} family files, ${languoids} languoids, ${works} works, ${result.journeys.length} journeys` +
    `\nclaims: ${result.claims.length} total · ${count("verified")} verified · ${count("unverified")} unverified · ${count("stale")} stale · ${count("rejected")} rejected` +
    `\n${errors.length} errors, ${warnings.length} warnings${showWarnings ? "" : " (--warnings to list)"}`
);

if (args.has("--report")) {
  const lines = ["# Verification report", "", `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm check:data --report\`.`, ""];
  lines.push("| File | Claims | Verified | Unverified | Stale | Rejected |", "|---|---|---|---|---|---|");
  const keys = [...new Set(result.claims.map(c => c.key))];
  for (const k of keys) {
    const cs = result.claims.filter(c => c.key === k);
    const n = (s: string) => cs.filter(c => c.status === s).length;
    lines.push(`| ${k} | ${cs.length} | ${n("verified")} | ${n("unverified")} | ${n("stale")} | ${n("rejected")} |`);
  }
  lines.push("", "Corrections and notes from verifiers live in `verification/<kind>/<file>.json` (`note` fields).", "");
  mkdirSync(VERIFY_DIR, { recursive: true });
  writeFileSync(join(VERIFY_DIR, "REPORT.md"), lines.join("\n"));
  console.log("wrote verification/REPORT.md");
}
process.exit(errors.length ? 1 : 0);
