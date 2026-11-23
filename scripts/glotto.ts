/**
 * pnpm glotto fetch            download the Glottolog CLDF languages table (CC-BY 4.0) into data/glottolog/.cache
 * pnpm glotto find <text>      search names (case-insensitive substring) -> glottocode, level, family, coords
 * pnpm glotto code <code>      show one entry
 * pnpm glotto snapshot         write data/glottolog/snapshot.json for glottocodes used in data (coords for the app)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GLOTTO_CACHE, GLOTTO_SNAPSHOT, loadDataset, loadGlottolog } from "./lib.ts";

const URL_CSV = "https://raw.githubusercontent.com/glottolog/glottolog-cldf/master/cldf/languages.csv";
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "fetch") {
  const res = await fetch(URL_CSV);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  mkdirSync(dirname(GLOTTO_CACHE), { recursive: true });
  writeFileSync(GLOTTO_CACHE, await res.text());
  console.log(`saved ${GLOTTO_CACHE}`);
} else {
  const g = loadGlottolog();
  if (!g) throw new Error("run `pnpm glotto fetch` first");
  if (cmd === "find") {
    const q = rest.join(" ").toLowerCase();
    const hits = [...g].filter(([, e]) => e.name.toLowerCase().includes(q)).slice(0, 40);
    for (const [code, e] of hits) console.log(`${code}\t${e.level}\t${e.name}\tfamily=${e.family || "-"}\t${e.lat ?? ""},${e.lng ?? ""}`);
    if (!hits.length) console.log("no match");
  } else if (cmd === "code") {
    console.log(rest[0], g.get(rest[0]) ?? "not found");
  } else if (cmd === "snapshot") {
    const ds = loadDataset();
    const out: Record<string, { name: string; lat: number | null; lng: number | null }> = {};
    for (const f of ds.families) {
      for (const l of (f.raw as { languoids: { glottocode: string | null }[] }).languoids) {
        const e = l.glottocode ? g.get(l.glottocode) : undefined;
        if (e && l.glottocode) out[l.glottocode] = { name: e.name, lat: e.lat, lng: e.lng };
      }
    }
    writeFileSync(GLOTTO_SNAPSHOT, JSON.stringify(out, null, 1));
    console.log(`wrote ${Object.keys(out).length} entries to ${GLOTTO_SNAPSHOT}`);
  } else {
    console.log("usage: pnpm glotto fetch|find <text>|code <code>|snapshot");
  }
}
