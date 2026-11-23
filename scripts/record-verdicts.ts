/**
 * pnpm record families/<name> <verdicts.json> [--verifier "<name>"]
 * verdicts.json: { "<claimId>": { "verdict": "verified"|"corrected"|"rejected", "evidence": ["https://..."], "note": "..." } }
 * Stamps each verdict with the claim's CURRENT hash and merges it into verification/<key>.json.
 * Record AFTER applying any correction to the data file, so the hash matches the corrected claim.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateDataset } from "../src/data/validate.ts";
import { loadDataset, VERIFY_DIR } from "./lib.ts";

const argv = process.argv.slice(2);
const [key, verdictPath] = argv;
const verifier = argv.includes("--verifier") ? argv[argv.indexOf("--verifier") + 1] : undefined;
if (!key || !verdictPath) throw new Error("usage: pnpm record families/<name> <verdicts.json>");
type In = { verdict: "verified" | "corrected" | "rejected"; evidence: string[]; note?: string };
const incoming = JSON.parse(readFileSync(verdictPath, "utf8")) as Record<string, In>;
const result = validateDataset(loadDataset(), { allowUnverified: true });
const hashes = new Map(result.claims.filter(c => c.key === key).map(c => [c.claim.id, c.hash]));
if (!hashes.size) throw new Error(`no claims for "${key}"`);

const out = join(VERIFY_DIR, `${key}.json`);
const existing = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { file: `data/${key}.json`, claims: {} };
let n = 0;
for (const [id, v] of Object.entries(incoming)) {
  const hash = hashes.get(id);
  if (!hash) {
    console.warn(`skip unknown claim id ${id}`);
    continue;
  }
  if (!v.evidence?.length && v.verdict !== "rejected") console.warn(`! ${id} has no evidence URLs`);
  existing.claims[id] = { hash, verdict: v.verdict, evidence: v.evidence ?? [], ...(v.note ? { note: v.note } : {}) };
  n++;
}
// drop verdicts for claims that no longer exist
for (const id of Object.keys(existing.claims)) if (!hashes.has(id)) delete existing.claims[id];
existing.verifiedAt = new Date().toISOString();
if (verifier) existing.verifier = verifier;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(existing, null, 1) + "\n");
console.log(`recorded ${n} verdicts -> ${out}`);
