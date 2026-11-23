import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatasetInput, GlottoEntry } from "../src/data/validate.ts";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const FAMILIES_DIR = join(ROOT, "data/families");
export const JOURNEYS_DIR = join(ROOT, "data/journeys");
export const STORY_DIR = join(ROOT, "data/story");
export const VERIFY_DIR = join(ROOT, "verification");
export const GLOTTO_CACHE = join(ROOT, "data/glottolog/.cache/languages.csv");
export const GLOTTO_SNAPSHOT = join(ROOT, "data/glottolog/snapshot.json");

const readJsonDir = (dir: string, prefix: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter(f => f.endsWith(".json"))
        .sort()
        .map(f => ({ key: `${prefix}/${basename(f, ".json")}`, raw: JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown }))
    : [];

/** Verification files mirror data paths: verification/families/<name>.json, verification/journeys/<name>.json */
export function loadDataset(): DatasetInput {
  return {
    families: readJsonDir(FAMILIES_DIR, "families"),
    journeys: readJsonDir(JOURNEYS_DIR, "journeys"),
    stories: readJsonDir(STORY_DIR, "story"),
    verifications: [
      ...readJsonDir(join(VERIFY_DIR, "families"), "families"),
      ...readJsonDir(join(VERIFY_DIR, "journeys"), "journeys"),
      ...readJsonDir(join(VERIFY_DIR, "story"), "story")
    ],
    glottolog: loadGlottolog()
  };
}

/** Minimal RFC 4180 CSV parser. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function loadGlottolog(): Map<string, GlottoEntry> | undefined {
  if (!existsSync(GLOTTO_CACHE)) return undefined;
  const [header, ...rows] = parseCsv(readFileSync(GLOTTO_CACHE, "utf8"));
  const col = (n: string) => header.indexOf(n);
  const [iId, iName, iLevel, iFam, iLat, iLng] = ["Glottocode", "Name", "Level", "Family_ID", "Latitude", "Longitude"].map(col);
  const map = new Map<string, GlottoEntry>();
  for (const r of rows) {
    if (!r[iId]) continue;
    map.set(r[iId], {
      name: r[iName],
      level: r[iLevel],
      family: r[iFam],
      lat: r[iLat] ? Number(r[iLat]) : null,
      lng: r[iLng] ? Number(r[iLng]) : null
    });
  }
  return map;
}
