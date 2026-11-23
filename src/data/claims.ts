/**
 * Splits data into individually verifiable claims, each with a stable id and
 * a content hash. Editing a claim changes its hash, which invalidates its
 * verification and forces a re-check.
 */
import type { FamilyFile, Journey, Languoid } from "./schema.ts";

export interface Claim {
  id: string;
  /** what the claim asserts, as data */
  content: unknown;
  sources: string[];
}

/** Deterministic JSON: object keys sorted. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter(k => obj[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a 64-bit, hex. Sync and dependency-free so it runs in Node and the browser. */
export function hashClaim(claim: Claim): string {
  const text = stableStringify({ content: claim.content, sources: claim.sources });
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

export function languoidClaims(l: Languoid): Claim[] {
  const out: Claim[] = [];
  out.push({
    id: `${l.id}#identity`,
    content: {
      name: l.name,
      nativeName: l.nativeName,
      nativeScript: l.nativeScript,
      glottocode: l.glottocode,
      iso639_3: l.iso639_3,
      parent: l.parent,
      kind: l.kind,
      status: l.status
    },
    sources: l.sources
  });
  if (l.period) {
    const { sources, ...content } = l.period;
    out.push({ id: `${l.id}#period`, content, sources });
  }
  if (l.homeland) {
    const { sources, ...content } = l.homeland;
    out.push({ id: `${l.id}#homeland`, content, sources });
  }
  for (const a of l.attestations) {
    const { sources, ...content } = a;
    out.push({ id: `${l.id}#attestation:${a.id}`, content, sources });
  }
  if (l.scripts) out.push({ id: `${l.id}#scripts`, content: l.scripts.list, sources: l.scripts.sources });
  if (l.speakers) {
    const { sources, ...content } = l.speakers;
    out.push({ id: `${l.id}#speakers`, content, sources });
  }
  l.story.forEach((p, i) => out.push({ id: `${l.id}#story:${i}`, content: p.text, sources: p.sources }));
  for (const w of l.works) {
    const { sources, ...content } = w;
    out.push({ id: `${l.id}#work:${w.id}`, content, sources });
  }
  l.notes.forEach((p, i) => out.push({ id: `${l.id}#note:${i}`, content: p.text, sources: p.sources }));
  return out;
}

export function familyClaims(file: FamilyFile): Claim[] {
  return file.languoids.flatMap(languoidClaims);
}

export function journeyClaims(j: Journey): Claim[] {
  return j.steps.map((s, i) => {
    const { sources, ...content } = s;
    return { id: `${j.id}#step:${i}`, content, sources };
  });
}
