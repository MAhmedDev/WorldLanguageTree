import { describe, expect, it } from "vitest";
import { buildAtlas, aliveAt, ancestors, greatCircle, distanceKm } from "../src/data/model.ts";
import { validateDataset } from "../src/data/validate.ts";
import { createTimeScale, formatRange, formatYear } from "../src/lib/years.ts";
import { search } from "../src/lib/search.ts";
import { hashClaim, stableStringify } from "../src/data/claims.ts";
import { fixtureFamily } from "./fixture.ts";

const atlas = () => {
  const r = validateDataset({ families: [{ key: "families/testic", raw: fixtureFamily() }], journeys: [], verifications: [] }, { allowUnverified: true });
  return buildAtlas({ families: r.families });
};

describe("buildAtlas", () => {
  it("links the tree and finds roots", () => {
    const a = atlas();
    expect(a.roots).toEqual(["proto-testic"]);
    expect(a.nodes.get("old-testic")!.children).toEqual(["testish"]);
    expect(ancestors(a, "testish").map(n => n.l.id)).toEqual(["proto-testic", "old-testic"]);
    expect(a.minYear).toBe(-3000);
  });

  it("builds presence points and arcs only from sourced places", () => {
    const a = atlas();
    expect(a.presence.map(p => p.id).sort()).toEqual(["old-testic:homeland", "old-testic:stone", "proto-testic:homeland", "testish:homeland"]);
    expect(a.arcs.map(x => x.id).sort()).toEqual(["old-testic:lineage", "old-testic:stone", "testish:lineage"]);
    const spread = a.arcs.find(x => x.id === "old-testic:stone")!;
    expect(spread.from).toBe(-600);
  });

  it("knows which languages are alive in a given year", () => {
    const a = atlas();
    expect(aliveAt(a.nodes.get("old-testic")!, -1000)).toBe(true);
    expect(aliveAt(a.nodes.get("old-testic")!, 1000)).toBe(false);
    expect(aliveAt(a.nodes.get("testish")!, 2024)).toBe(true);
  });
});

describe("time scale", () => {
  it("is monotonic and round-trips", () => {
    const s = createTimeScale(-6000, 2025);
    let prev = -1;
    for (let y = -6000; y <= 2025; y += 50) {
      const p = s.toPos(y);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
      expect(Math.abs(s.toYear(p) - y)).toBeLessThanOrEqual(1);
    }
    expect(s.toPos(-6000)).toBe(0);
    expect(s.toPos(2025)).toBe(1);
  });

  it("formats BCE/CE years", () => {
    expect(formatYear(-3400)).toBe("3,400 BCE");
    expect(formatYear(800, true)).toBe("c. 800 CE");
    expect(formatYear(1066)).toBe("1066");
    expect(formatRange(-700, -200, true)).toBe("c. 700 – 200 BCE");
    expect(formatRange(1500, null, false)).toBe("1500 – today");
  });
});

describe("geo", () => {
  it("great circle endpoints and distance", () => {
    const pts = greatCircle({ lat: 0, lng: 0 }, { lat: 0, lng: 90 }, 10);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10][0]).toBeCloseTo(90);
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })).toBeCloseTo(10007.5, 0);
  });
  it("keeps longitudes continuous across the antimeridian", () => {
    const pts = greatCircle({ lat: -20, lng: 170 }, { lat: -20, lng: -170 });
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(10);
  });
});

describe("search & hashing", () => {
  it("ranks exact and prefix matches first, ignoring diacritics", () => {
    const items = [
      { id: "old-norse", terms: ["Old Norse", "Dǫnsk tunga"] },
      { id: "norwegian", terms: ["Norwegian", "Norsk"] },
      { id: "nahuatl", terms: ["Nāhuatl"] }
    ];
    expect(search("nor", items)[0]).toBe("norwegian");
    expect(search("nahuatl", items)).toEqual(["nahuatl"]);
    expect(search("donsk", items)).toEqual(["old-norse"]);
  });
  it("hashes are key-order independent and content sensitive", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    const a = hashClaim({ id: "x", content: { a: 1, b: 2 }, sources: ["s"] });
    expect(hashClaim({ id: "x", content: { b: 2, a: 1 }, sources: ["s"] })).toBe(a);
    expect(hashClaim({ id: "x", content: { a: 1, b: 3 }, sources: ["s"] })).not.toBe(a);
  });
});
