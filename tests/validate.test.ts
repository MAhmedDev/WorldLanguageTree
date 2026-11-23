import { describe, expect, it } from "vitest";
import { validateDataset, type DatasetInput } from "../src/data/validate.ts";
import { familyClaims, hashClaim } from "../src/data/claims.ts";
import type { FamilyFile } from "../src/data/schema.ts";
import { fixtureFamily } from "./fixture.ts";

type Raw = ReturnType<typeof fixtureFamily> & { languoids: Record<string, unknown>[]; sources: Record<string, unknown>[] };

const input = (raw: unknown, verifications: DatasetInput["verifications"] = []): DatasetInput => ({
  families: [{ key: "families/testic", raw }],
  journeys: [],
  verifications
});
const errors = (raw: unknown, opts = { allowUnverified: true }) =>
  validateDataset(input(raw), opts)
    .issues.filter(i => i.level === "error")
    .map(i => i.message);

/** verification file marking every claim of the fixture as verified */
function verifyAll(raw: unknown) {
  const parsed = validateDataset(input(raw), { allowUnverified: true }).families[0].data as FamilyFile;
  const claims = Object.fromEntries(familyClaims(parsed).map(c => [c.id, { hash: hashClaim(c), verdict: "verified", evidence: ["https://example.org/e"] }]));
  return [{ key: "families/testic", raw: { file: "data/families/testic.json", verifiedAt: "2026-11-23", claims } }];
}

describe("validateDataset", () => {
  it("accepts the fixture", () => {
    expect(errors(fixtureFamily())).toEqual([]);
  });

  it("requires sources on claims", () => {
    const f = fixtureFamily() as Raw;
    (f.languoids[1].period as { sources: string[] }).sources = [];
    expect(errors(f).join()).toMatch(/at least one source/);
  });

  it("rejects unknown source ids", () => {
    const f = fixtureFamily() as Raw;
    (f.languoids[1].homeland as { sources: string[] }).sources = ["nope"];
    expect(errors(f).join()).toMatch(/unknown source id "nope"/);
  });

  it("rejects a child older than its ancestor", () => {
    const f = fixtureFamily() as Raw;
    (f.languoids[1].period as { from: number }).from = -4000;
    expect(errors(f).join()).toMatch(/before its ancestor proto-testic/);
  });

  it("rejects dangling parents and cycles", () => {
    const f = fixtureFamily() as Raw;
    f.languoids[2].parent = "ghost";
    expect(errors(f).join()).toMatch(/parent "ghost" does not exist/);
    const g = fixtureFamily() as Raw;
    g.languoids[0].parent = "testish";
    expect(errors(g).join()).toMatch(/cycle/);
  });

  it("rejects bad coordinates and malformed glottocodes", () => {
    const f = fixtureFamily() as Raw;
    (f.languoids[1].homeland as { lat: number }).lat = 123;
    f.languoids[2].glottocode = "bad";
    const e = errors(f).join();
    expect(e).toMatch(/Expected <=90/);
    expect(e).toMatch(/Invalid format/);
    expect(errors(f).length).toBeGreaterThanOrEqual(2);
  });

  it("rejects glottocodes missing from Glottolog when a snapshot is provided", () => {
    const f = fixtureFamily() as Raw;
    f.languoids[2].glottocode = "abcd1234";
    const r = validateDataset({ ...input(f), glottolog: new Map() }, { allowUnverified: true });
    expect(r.issues.some(i => /does not exist in Glottolog/.test(i.message))).toBe(true);
  });

  it("rejects works that are not public domain", () => {
    const f = fixtureFamily() as Raw;
    f.languoids[1].works = [
      {
        id: "w",
        title: "T",
        author: "A",
        date: "c. 500 BCE",
        year: -500,
        significance: "A significant fictional work for testing.",
        original: "x",
        originalScript: "Latn",
        translation: "y",
        translator: "Z",
        translationKind: "public-domain",
        license: "copyrighted",
        fullTextUrl: "https://example.org/t",
        sources: ["s1"]
      }
    ];
    expect(errors(f).join()).toMatch(/Expected "public-domain"/);
  });

  it("requires living languages to be open-ended and proto-languages extinct + approximate", () => {
    const f = fixtureFamily() as Raw;
    (f.languoids[2].period as { to: number | null }).to = 1900;
    (f.languoids[0].period as { approx: boolean }).approx = false;
    const e = errors(f).join();
    expect(e).toMatch(/living language must have period.to = null/);
    expect(e).toMatch(/proto-language dates must be approx/);
  });

  it("fails unverified claims in strict mode and passes when verified", () => {
    const f = fixtureFamily();
    expect(errors(f, { allowUnverified: false }).join()).toMatch(/has not been verified/);
    const r = validateDataset(input(f, verifyAll(f)), { allowUnverified: false });
    expect(r.issues.filter(i => i.level === "error")).toEqual([]);
    expect(r.claims.every(c => c.status === "verified")).toBe(true);
  });

  it("marks a claim stale when it is edited after verification", () => {
    const f = fixtureFamily() as Raw;
    const v = verifyAll(f);
    (f.languoids[1].period as { from: number }).from = -1400;
    const r = validateDataset(input(f, v), { allowUnverified: false });
    expect(r.claims.find(c => c.claim.id === "old-testic#period")?.status).toBe("stale");
    expect(r.issues.some(i => /changed since it was verified/.test(i.message))).toBe(true);
  });

  it("fails rejected claims even in dev mode", () => {
    const f = fixtureFamily();
    const v = verifyAll(f);
    (v[0].raw.claims as Record<string, { verdict: string }>)["testish#speakers"].verdict = "rejected";
    expect(errors(f).length).toBe(0);
    const r = validateDataset(input(f, v), { allowUnverified: true });
    expect(r.issues.some(i => /rejected/.test(i.message) && i.level === "error")).toBe(true);
  });
});
