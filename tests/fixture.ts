/** Minimal synthetic dataset for unit tests (not real data; never shipped). */
export function fixtureFamily(): Record<string, unknown> {
  return {
    family: { id: "testic", name: "Testic", root: "proto-testic" },
    sources: [
      { id: "s1", title: "Source one", url: "https://example.org/one" },
      { id: "s2", title: "Source two", url: "https://example.org/two" }
    ],
    languoids: [
      {
        id: "proto-testic",
        name: "Proto-Testic",
        glottocode: null,
        parent: null,
        kind: "proto",
        status: "extinct",
        sources: ["s1"],
        period: { from: -3000, to: -1500, approx: true, sources: ["s1"] },
        homeland: { lat: 45, lng: 30, label: "Somewhere", sources: ["s1"] }
      },
      {
        id: "old-testic",
        name: "Old Testic",
        glottocode: null,
        parent: "proto-testic",
        kind: "language",
        status: "extinct",
        sources: ["s1"],
        period: { from: -1500, to: 500, approx: true, sources: ["s2"] },
        homeland: { lat: 41, lng: 12, label: "Elsewhere", sources: ["s2"] },
        attestations: [{ id: "stone", year: -600, approx: true, lat: 52, lng: 0, place: "A far place", description: "An inscribed stone.", sources: ["s2"] }],
        story: [{ text: "Old Testic is a fictional language used only in tests.", sources: ["s2"] }]
      },
      {
        id: "testish",
        name: "Testish",
        glottocode: null,
        parent: "old-testic",
        kind: "language",
        status: "living",
        sources: ["s2"],
        period: { from: 500, to: null, approx: true, sources: ["s2"] },
        homeland: { lat: 48, lng: 2, label: "A modern place", sources: ["s2"] },
        speakers: { count: 1000, year: 2020, scope: "L1", sources: ["s2"] },
        story: [{ text: "Testish is a fictional descendant used only in tests.", sources: ["s2"] }]
      }
    ]
  };
}
