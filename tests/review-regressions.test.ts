import { describe, expect, it } from "vitest";
import { validateDataset } from "../src/data/validate.ts";
import { buildAtlas, ancestors } from "../src/data/model.ts";
import { fixtureFamily } from "./fixture.ts";

type Raw = ReturnType<typeof fixtureFamily> & { languoids: Record<string, unknown>[] };

const group = (id: string, parent: string) => ({ id, name: id, glottocode: null, parent, kind: "group", status: "extinct", sources: ["s1"] });

describe("review regressions", () => {
  it("terminates (and reports) a cycle among period-less groups", () => {
    const f = fixtureFamily() as Raw;
    f.languoids.push(group("g1", "g2"), group("g2", "g1"));
    (f.languoids[2] as { parent: string }).parent = "g1";
    const r = validateDataset({ families: [{ key: "families/t", raw: f }], journeys: [], verifications: [] }, { allowUnverified: true });
    expect(r.issues.some(i => /cycle/.test(i.message))).toBe(true);
    const atlas = buildAtlas({ families: r.families });
    expect(() => ancestors(atlas, "testish")).not.toThrow();
  });

  it("rejects duplicate beat ids within a chapter and duplicate journey ids", () => {
    const beat = (id: string, year: number) => ({ id, year, languoids: ["old-testic"], title: "t", text: "A sufficiently long beat text.", sources: ["s"] });
    const story = {
      id: "st",
      title: "S",
      sources: [{ id: "s", title: "S", url: "https://example.org" }],
      chapters: [{ id: "c", title: "C", from: -1500, to: 0, intro: [{ text: "An intro paragraph long enough.", sources: ["s"] }], beats: [beat("b", -1000), beat("b", -900)] }]
    };
    const step = (y: number) => ({ languoid: "old-testic", year: y, title: "t", text: "A sufficiently long step text.", sources: ["s"] });
    const journey = { id: "j", title: "J", subtitle: "s", sources: [{ id: "s", title: "S", url: "https://example.org" }], steps: [step(-1000), step(-900)] };
    const r = validateDataset(
      {
        families: [{ key: "families/t", raw: fixtureFamily() }],
        journeys: [
          { key: "journeys/a", raw: journey },
          { key: "journeys/b", raw: journey }
        ],
        stories: [{ key: "story/s", raw: story }],
        verifications: []
      },
      { allowUnverified: true }
    );
    const errs = r.issues.filter(i => i.level === "error").map(i => i.message).join("\n");
    expect(errs).toMatch(/duplicate beat id "b"/);
    expect(errs).toMatch(/journey id "j" also used/);
  });
});
