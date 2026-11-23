/** Loads, validates and indexes all data files in the browser. */
import { validateDataset, type Issue } from "./validate.ts";
import { buildAtlas, type Atlas } from "./model.ts";
import type { VerificationFile } from "./schema.ts";

const familyFiles = import.meta.glob<unknown>("/data/families/*.json", { import: "default" });
const journeyFiles = import.meta.glob<unknown>("/data/journeys/*.json", { import: "default" });
const verificationFiles = import.meta.glob<unknown>("/verification/*/*.json", { import: "default" });
const glottoFiles = import.meta.glob<Atlas["glottolog"]>("/data/glottolog/snapshot.json", { import: "default" });

const keyOf = (path: string, dir: string) => `${dir}/${path.split("/").pop()!.replace(/\.json$/, "")}`;

async function loadDir(files: Record<string, () => Promise<unknown>>, dir: string) {
  return Promise.all(Object.entries(files).map(async ([path, load]) => ({ key: keyOf(path, dir), raw: await load() })));
}

export interface LoadedAtlas {
  atlas: Atlas;
  issues: Issue[];
}

export async function loadAtlas(): Promise<LoadedAtlas> {
  const [families, journeys, verifications, glotto] = await Promise.all([
    loadDir(familyFiles, "families"),
    loadDir(journeyFiles, "journeys"),
    Promise.all(
      Object.entries(verificationFiles).map(async ([path, load]) => {
        const parts = path.split("/");
        return { key: `${parts[parts.length - 2]}/${parts[parts.length - 1].replace(/\.json$/, "")}`, raw: await load() };
      })
    ),
    Promise.all(Object.values(glottoFiles).map(l => l()))
  ]);
  const result = validateDataset({ families, journeys, verifications }, { allowUnverified: true });
  const atlas = buildAtlas({
    families: result.families,
    journeys: result.journeys,
    verifications: verifications.map(v => ({ key: v.key, data: v.raw as VerificationFile })),
    glottolog: glotto[0] ?? {}
  });
  return { atlas, issues: result.issues };
}
