/**
 * pnpm claims families/<name>  [--unverified]
 * Lists every claim in a data file with its id, hash, content and resolved sources (JSON on stdout).
 * Verifiers use this as their checklist. --unverified lists only claims that are not currently verified.
 */
import { validateDataset } from "../src/data/validate.ts";
import { loadDataset } from "./lib.ts";

const [key, flag] = process.argv.slice(2);
if (!key) throw new Error("usage: pnpm claims families/<name> [--unverified]");
const result = validateDataset(loadDataset(), { allowUnverified: true });
const file = result.families.find(f => f.key === key)?.data ?? result.journeys.find(j => j.key === key)?.data ?? result.stories.find(s => s.key === key)?.data;
if (!file) throw new Error(`no valid data file "${key}" (run pnpm check:data --allow-unverified for schema errors)`);
const sources = new Map(file.sources.map(s => [s.id, s]));
const list = result.claims
  .filter(c => c.key === key && (flag !== "--unverified" || c.status !== "verified"))
  .map(c => ({ id: c.claim.id, hash: c.hash, status: c.status, content: c.claim.content, sources: c.claim.sources.map(s => sources.get(s) ?? s) }));
console.log(JSON.stringify(list, null, 1));
