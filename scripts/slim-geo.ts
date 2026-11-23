/**
 * pnpm geo
 * Downloads Natural Earth (public domain) 1:50m layers and writes slim basemap files to public/geo/:
 * coordinates rounded to ~1 km, duplicate points dropped, properties stripped,
 * minor lakes and rivers removed. The globe tops out at zoom 8, where this is visually lossless.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.ts";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const CACHE = join(ROOT, ".cache/natural-earth");
const OUT = join(ROOT, "public/geo");

type Pos = number[];
type Geom = { type: string; coordinates: unknown };
type Feature = { type: "Feature"; properties: Record<string, unknown> | null; geometry: Geom | null };

async function load(name: string): Promise<{ features: Feature[] }> {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}.geojson`);
  if (!existsSync(file)) {
    const res = await fetch(`${BASE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function roundLine(line: Pos[], dp: number): Pos[] {
  const f = 10 ** dp;
  const out: Pos[] = [];
  for (const [x, y] of line) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Recursively round any nesting of positions; drop degenerate rings/lines. */
function roundCoords(c: unknown, dp: number, minLen: number): unknown {
  const arr = c as unknown[];
  if (!arr.length) return null;
  if (typeof (arr[0] as unknown[])[0] === "number") {
    const line = roundLine(arr as Pos[], dp);
    return line.length >= minLen ? line : null;
  }
  return arr.map(x => roundCoords(x, dp, minLen)).filter(x => x !== null && (x as unknown[]).length > 0);
}

function slim(fc: { features: Feature[] }, dp: number, keep: (p: Record<string, unknown>) => boolean, polygon: boolean) {
  const features: Feature[] = [];
  for (const f of fc.features) {
    if (!f.geometry || !keep(f.properties ?? {})) continue;
    const coordinates = roundCoords(f.geometry.coordinates, dp, polygon ? 4 : 2);
    if (!coordinates || !(coordinates as unknown[]).length) continue;
    features.push({ type: "Feature", properties: {}, geometry: { type: f.geometry.type, coordinates } });
  }
  return JSON.stringify({ type: "FeatureCollection", features });
}

const rank = (p: Record<string, unknown>) => Number(p.scalerank ?? p.min_zoom ?? 0);

const jobs: [string, string, number, (p: Record<string, unknown>) => boolean, boolean][] = [
  ["ne_50m_land", "land.geojson", 2, () => true, true],
  ["ne_50m_lakes", "lakes.geojson", 2, p => rank(p) <= 3, true],
  ["ne_50m_rivers_lake_centerlines", "rivers.geojson", 2, p => rank(p) <= 5, false]
];

mkdirSync(OUT, { recursive: true });
for (const [src, out, dp, keep, polygon] of jobs) {
  const text = slim(await load(src), dp, keep, polygon);
  writeFileSync(join(OUT, out), text);
  console.log(`${out}: ${(text.length / 1024).toFixed(0)} KB`);
}
