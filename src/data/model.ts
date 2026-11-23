/**
 * Builds the in-memory atlas index from validated family files. Pure, so it is
 * unit-tested and shared by the app.
 */
import type { FamilyFile, Journey, Languoid, Source, Story, VerificationFile } from "./schema.ts";
import { languoidClaims, hashClaim, journeyClaims, storyClaims } from "./claims.ts";
import { PRESENT } from "../lib/years.ts";

export type ClaimStatus = "verified" | "unverified" | "stale" | "rejected";

export interface AtlasNode {
  l: Languoid;
  fileKey: string;
  sources: Map<string, Source>;
  children: string[];
  parent: AtlasNode | null;
  depth: number;
  rootId: string;
  /** effective start/end (groups derive theirs from descendants) */
  from: number;
  to: number | null;
  /** primary map point */
  point: { lat: number; lng: number } | null;
  claims: Map<string, { status: ClaimStatus; evidence: string[]; note?: string }>;
}

export interface PresencePoint {
  id: string;
  languoid: string;
  kind: "homeland" | "attestation" | "current";
  lng: number;
  lat: number;
  from: number;
  /** last year the point is "alive"; extinct languages become embers afterwards */
  to: number;
  label: string;
  rootId: string;
}

export interface Arc {
  id: string;
  languoid: string;
  kind: "lineage" | "spread";
  from: number;
  coords: [number, number][];
  rootId: string;
}

export interface Atlas {
  nodes: Map<string, AtlasNode>;
  roots: string[];
  presence: PresencePoint[];
  arcs: Arc[];
  journeys: Journey[];
  journeyClaims: Map<string, { status: ClaimStatus; evidence: string[] }>;
  story: Story | null;
  storySources: Map<string, Source>;
  storyClaims: Map<string, { status: ClaimStatus; evidence: string[] }>;
  minYear: number;
  /** stable colour per family root */
  colors: Map<string, string>;
  glottolog: Record<string, { name: string; lat: number | null; lng: number | null }>;
}

/** Luminous, muted hues for family roots, assigned in order of family size. */
const PALETTE = [
  "#e8c170", // gold
  "#e0876a", // terracotta
  "#7fc8a9", // jade
  "#6fb7d8", // sea
  "#c79be0", // violet
  "#f0a3b5", // rose
  "#a9c76f", // olive
  "#e6a85c", // amber
  "#8fa8f0", // periwinkle
  "#d9d27a", // straw
  "#76d1c9", // teal
  "#d88fc0", // orchid
  "#b8b0a0", // stone
  "#9ad07a", // leaf
  "#f2c4a0", // peach
  "#a0c4f2" // ice
];

export function buildAtlas(input: {
  families: { key: string; data: FamilyFile }[];
  journeys?: { key: string; data: Journey }[];
  stories?: { key: string; data: Story }[];
  verifications?: { key: string; data: VerificationFile }[];
  glottolog?: Atlas["glottolog"];
}): Atlas {
  const verif = new Map((input.verifications ?? []).map(v => [v.key, v.data]));
  const nodes = new Map<string, AtlasNode>();

  for (const { key, data } of input.families) {
    const sources = new Map(data.sources.map(s => [s.id, s]));
    const vf = verif.get(key);
    for (const l of data.languoids) {
      const claims = new Map<string, { status: ClaimStatus; evidence: string[]; note?: string }>();
      for (const c of languoidClaims(l)) {
        const v = vf?.claims[c.id];
        const status: ClaimStatus = !v ? "unverified" : v.hash !== hashClaim(c) ? "stale" : v.verdict === "rejected" ? "rejected" : "verified";
        claims.set(c.id, { status, evidence: v?.evidence ?? [], note: v?.note });
      }
      nodes.set(l.id, {
        l,
        fileKey: key,
        sources,
        children: [],
        parent: null,
        depth: 0,
        rootId: l.id,
        from: l.period?.from ?? Infinity,
        to: l.period ? l.period.to : null,
        point: l.homeland ? { lat: l.homeland.lat, lng: l.homeland.lng } : null,
        claims
      });
    }
  }

  // link parents (skip dangling references gracefully; the validator reports them)
  for (const n of nodes.values()) {
    const p = n.l.parent ? nodes.get(n.l.parent) : undefined;
    if (p) {
      n.parent = p;
      p.children.push(n.l.id);
    }
  }
  const roots = [...nodes.values()].filter(n => !n.parent).map(n => n.l.id);

  // depth, root, and derived spans for groups (post-order)
  const visit = (id: string, depth: number, rootId: string, seen: Set<string>): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = nodes.get(id)!;
    n.depth = depth;
    n.rootId = rootId;
    for (const c of n.children) visit(c, depth + 1, rootId, seen);
    if (!n.l.period && n.children.length) {
      const kids = n.children.map(c => nodes.get(c)!);
      n.from = Math.min(...kids.map(k => k.from));
      n.to = kids.some(k => k.to === null) ? null : Math.max(...kids.map(k => k.to ?? PRESENT));
    }
    if (!n.point) {
      const withPoint = n.children.map(c => nodes.get(c)!).find(k => k.point);
      n.point = withPoint?.point ?? null;
    }
  };
  const seen = new Set<string>();
  for (const r of roots) visit(r, 0, r, seen);

  // sort children chronologically for a readable tree
  for (const n of nodes.values()) n.children.sort((a, b) => nodes.get(a)!.from - nodes.get(b)!.from);

  // colours by family size
  const size = new Map<string, number>();
  for (const n of nodes.values()) size.set(n.rootId, (size.get(n.rootId) ?? 0) + 1);
  const colors = new Map<string, string>();
  [...size.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([id], i) => colors.set(id, PALETTE[i % PALETTE.length]));

  // map features
  const glottolog = input.glottolog ?? {};
  const presence: PresencePoint[] = [];
  const arcs: Arc[] = [];
  for (const n of nodes.values()) {
    const { l } = n;
    if (!l.period) continue;
    const end = l.period.to ?? 99999;
    if (l.homeland)
      presence.push({
        id: `${l.id}:homeland`,
        languoid: l.id,
        kind: "homeland",
        lng: l.homeland.lng,
        lat: l.homeland.lat,
        from: l.period.from,
        to: end,
        label: l.homeland.label,
        rootId: n.rootId
      });
    for (const a of l.attestations) {
      presence.push({
        id: `${l.id}:${a.id}`,
        languoid: l.id,
        kind: "attestation",
        lng: a.lng,
        lat: a.lat,
        from: a.year,
        to: end,
        label: a.place,
        rootId: n.rootId
      });
      if (l.homeland && distanceKm(l.homeland, a) > 150)
        arcs.push({ id: `${l.id}:${a.id}`, languoid: l.id, kind: "spread", from: a.year, coords: greatCircle(l.homeland, a), rootId: n.rootId });
    }
    const g = l.glottocode ? glottolog[l.glottocode] : undefined;
    if (l.status === "living" && g && g.lat !== null && g.lng !== null) {
      presence.push({
        id: `${l.id}:current`,
        languoid: l.id,
        kind: "current",
        lng: g.lng,
        lat: g.lat,
        from: Math.max(l.period.from, 1900),
        to: 99999,
        label: "Present-day centre (Glottolog)",
        rootId: n.rootId
      });
    }
    // lineage arc from nearest ancestor with a homeland
    let a = n.parent;
    while (a && !a.l.homeland) a = a.parent;
    if (a?.l.homeland && l.homeland && distanceKm(a.l.homeland, l.homeland) > 150)
      arcs.push({ id: `${l.id}:lineage`, languoid: l.id, kind: "lineage", from: l.period.from, coords: greatCircle(a.l.homeland, l.homeland), rootId: n.rootId });
  }

  const ORDER = ["cradle-of-writing", "indo-european-expansion", "latin-to-romance", "voices-of-asia", "austronesian-voyages"];
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const journeys = (input.journeys ?? []).map(j => j.data).sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  const journeyClaimMap = new Map<string, { status: ClaimStatus; evidence: string[] }>();
  for (const j of input.journeys ?? []) {
    const vf = verif.get(j.key);
    for (const c of journeyClaims(j.data)) {
      const v = vf?.claims[c.id];
      journeyClaimMap.set(c.id, {
        status: !v ? "unverified" : v.hash !== hashClaim(c) ? "stale" : v.verdict === "rejected" ? "rejected" : "verified",
        evidence: v?.evidence ?? []
      });
    }
  }

  const story = input.stories?.[0]?.data ?? null;
  const storyClaimMap = new Map<string, { status: ClaimStatus; evidence: string[] }>();
  for (const st of input.stories ?? []) {
    const vf = verif.get(st.key);
    for (const c of storyClaims(st.data)) {
      const v = vf?.claims[c.id];
      storyClaimMap.set(c.id, {
        status: !v ? "unverified" : v.hash !== hashClaim(c) ? "stale" : v.verdict === "rejected" ? "rejected" : "verified",
        evidence: v?.evidence ?? []
      });
    }
  }

  const finite = [...nodes.values()].map(n => n.from).filter(Number.isFinite);
  return {
    nodes,
    roots: roots.sort((a, b) => nodes.get(a)!.from - nodes.get(b)!.from),
    presence,
    arcs,
    journeys,
    journeyClaims: journeyClaimMap,
    story,
    storySources: new Map((story?.sources ?? []).map(s => [s.id, s])),
    storyClaims: storyClaimMap,
    minYear: finite.length ? Math.min(...finite) : -3400,
    colors,
    glottolog
  };
}

export function ancestors(atlas: Atlas, id: string): AtlasNode[] {
  const out: AtlasNode[] = [];
  let n = atlas.nodes.get(id)?.parent ?? null;
  while (n) {
    out.unshift(n);
    n = n.parent;
  }
  return out;
}

export function aliveAt(n: AtlasNode, year: number): boolean {
  return n.from <= year && (n.to === null || n.to >= year);
}

// --- geo --------------------------------------------------------------------

type LL = { lat: number; lng: number };
const rad = Math.PI / 180;

export function distanceKm(a: LL, b: LL): number {
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Points along the great circle from a to b (inclusive), as [lng, lat]. */
export function greatCircle(a: LL, b: LL, steps = 48): [number, number][] {
  const toV = (p: LL) => [Math.cos(p.lat * rad) * Math.cos(p.lng * rad), Math.cos(p.lat * rad) * Math.sin(p.lng * rad), Math.sin(p.lat * rad)];
  const va = toV(a);
  const vb = toV(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [[a.lng, a.lat], [b.lng, b.lat]];
  const out: [number, number][] = [];
  let prevLng = a.lng;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const x = s1 * va[0] + s2 * vb[0];
    const y = s1 * va[1] + s2 * vb[1];
    const z = s1 * va[2] + s2 * vb[2];
    let lng = Math.atan2(y, x) / rad;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / rad;
    // keep longitudes continuous across the antimeridian
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    out.push([lng, lat]);
  }
  return out;
}
