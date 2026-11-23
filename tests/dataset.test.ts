import { describe, expect, it } from "vitest";
import { validateDataset } from "../src/data/validate.ts";
import { buildAtlas } from "../src/data/model.ts";
import { loadDataset } from "../scripts/lib.ts";

describe("real dataset", () => {
  const input = loadDataset();
  const result = validateDataset(input, { allowUnverified: true });

  it("has no structural errors", () => {
    const errs = result.issues.filter(i => i.level === "error").map(i => `${i.where}: ${i.message}`);
    expect(errs).toEqual([]);
  });

  it("builds an atlas with every languoid placed in a family tree", () => {
    const atlas = buildAtlas({ families: result.families, journeys: result.journeys });
    for (const n of atlas.nodes.values()) if (n.l.parent) expect(n.parent, n.l.id).not.toBeNull();
  });
});
