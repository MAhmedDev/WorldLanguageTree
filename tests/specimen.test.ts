import { describe, expect, it } from "vitest";
import { validateDataset } from "../src/data/validate.ts";
import { buildAtlas } from "../src/data/model.ts";
import { pickSpecimen } from "../src/story/Specimen.tsx";
import { loadDataset } from "../scripts/lib.ts";

describe("story specimens", () => {
  const r = validateDataset(loadDataset(), { allowUnverified: true });
  const atlas = buildAtlas({ families: r.families, stories: r.stories });
  const beats = atlas.story!.chapters.flatMap(c => c.beats);

  it("only ever shows the step's own family", () => {
    for (const b of beats) {
      const s = pickSpecimen(atlas, b);
      if (!s) continue;
      const first = atlas.nodes.get(b.languoids[0])!;
      const shown = [...atlas.nodes.values()].find(n => n.l.name === s.language)!;
      expect(shown.rootId, `${b.id}: ${s.language}`).toBe(first.rootId);
    }
  });

  it("never pairs a colonial language's text with the language the step is about", () => {
    const tagalog = beats.find(b => b.languoids[0] === "tagalog");
    if (tagalog) expect(pickSpecimen(atlas, tagalog)).toBeNull();
  });

  it("shows real text for most attested steps", () => {
    const shown = beats.filter(b => pickSpecimen(atlas, b)).length;
    expect(shown).toBeGreaterThan(20);
  });
});
