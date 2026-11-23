/**
 * Pure validation of the whole dataset. Used by scripts/check-data.ts and tests.
 */
import * as v from "valibot";
import { FamilyFile, Journey, VerificationFile } from "./schema.ts";
import type { FamilyFile as TFamilyFile, Journey as TJourney, Languoid, VerificationFile as TVerificationFile } from "./schema.ts";
import { familyClaims, hashClaim, journeyClaims, type Claim } from "./claims.ts";

export interface GlottoEntry {
  name: string;
  level: string;
  family: string;
  lat: number | null;
  lng: number | null;
}

export interface DatasetInput {
  families: { key: string; raw: unknown }[];
  journeys: { key: string; raw: unknown }[];
  /** keyed by the same `key` as the family/journey file */
  verifications: { key: string; raw: unknown }[];
  /** glottocode -> entry; when provided every glottocode must exist */
  glottolog?: Map<string, GlottoEntry>;
}

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export interface ValidationResult {
  issues: Issue[];
  families: { key: string; data: TFamilyFile }[];
  journeys: { key: string; data: TJourney }[];
  claims: { key: string; claim: Claim; hash: string; status: "verified" | "unverified" | "stale" | "rejected" }[];
}

export interface ValidateOptions {
  /** treat unverified/stale claims as warnings instead of errors (dev mode) */
  allowUnverified?: boolean;
}

export function validateDataset(input: DatasetInput, opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warning", where, message });

  const families: ValidationResult["families"] = [];
  for (const f of input.families) {
    const r = v.safeParse(FamilyFile, f.raw);
    if (!r.success) {
      for (const i of r.issues) err(`${f.key}:${v.getDotPath(i) ?? ""}`, i.message);
      continue;
    }
    families.push({ key: f.key, data: r.output });
  }
  const journeys: ValidationResult["journeys"] = [];
  for (const j of input.journeys) {
    const r = v.safeParse(Journey, j.raw);
    if (!r.success) {
      for (const i of r.issues) err(`${j.key}:${v.getDotPath(i) ?? ""}`, i.message);
      continue;
    }
    journeys.push({ key: j.key, data: r.output });
  }

  // --- sources -----------------------------------------------------------
  const checkSourceRefs = (key: string, defined: Set<string>, claims: Claim[]) => {
    const used = new Set<string>();
    for (const c of claims)
      for (const s of c.sources) {
        used.add(s);
        if (!defined.has(s)) err(`${key}:${c.id}`, `unknown source id "${s}"`);
      }
    for (const s of defined) if (!used.has(s)) warn(key, `source "${s}" is never cited`);
  };
  const sourceDupes = (key: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(key, `duplicate source id "${id}"`);
      seen.add(id);
    }
    return seen;
  };

  // --- languoids ---------------------------------------------------------
  const byId = new Map<string, { l: Languoid; key: string }>();
  const glottos = new Map<string, string>();
  for (const { key, data } of families) {
    const defined = sourceDupes(key, data.sources.map(s => s.id));
    checkSourceRefs(key, defined, familyClaims(data));
    for (const l of data.languoids) {
      if (byId.has(l.id)) err(`${key}:${l.id}`, `duplicate languoid id (also in ${byId.get(l.id)!.key})`);
      byId.set(l.id, { l, key });
      if (l.glottocode) {
        if (glottos.has(l.glottocode)) err(`${key}:${l.id}`, `glottocode ${l.glottocode} also used by ${glottos.get(l.glottocode)}`);
        glottos.set(l.glottocode, l.id);
        if (input.glottolog && !input.glottolog.has(l.glottocode))
          err(`${key}:${l.id}`, `glottocode ${l.glottocode} does not exist in Glottolog`);
      }
      for (const [label, list] of [["attestation", l.attestations], ["work", l.works]] as const) {
        const ids = new Set<string>();
        for (const x of list) {
          if (ids.has(x.id)) err(`${key}:${l.id}`, `duplicate ${label} id "${x.id}"`);
          ids.add(x.id);
        }
      }
    }
  }

  for (const { key, data } of families) {
    if (data.family.root && !byId.has(data.family.root)) err(key, `family root "${data.family.root}" is not defined`);
    for (const l of data.languoids) {
      const where = `${key}:${l.id}`;
      if (l.parent !== null && !byId.has(l.parent)) err(where, `parent "${l.parent}" does not exist`);
      // cycle check
      const seen = new Set<string>([l.id]);
      let p = l.parent;
      while (p !== null) {
        if (seen.has(p)) {
          err(where, `cycle in parent chain at "${p}"`);
          break;
        }
        seen.add(p);
        p = byId.get(p)?.l.parent ?? null;
      }
      if (l.kind !== "group" && !l.period) err(where, `${l.kind} needs a period`);
      if (l.kind === "proto" && l.status !== "extinct") err(where, `proto-languages are extinct by definition`);
      if (l.kind === "proto" && l.period && !l.period.approx) err(where, `proto-language dates must be approx`);
      if (l.kind !== "group" && !l.homeland) err(where, `${l.kind} needs a homeland`);
      if (l.period) {
        if (l.period.to !== null && l.period.to < l.period.from) err(where, `period.to is before period.from`);
        if (l.status !== "extinct" && l.period.to !== null) err(where, `${l.status} language must have period.to = null`);
        if (l.status === "extinct" && l.period.to === null && l.kind !== "group")
          err(where, `extinct language needs period.to`);
        // nearest ancestor with a period must not start later than this one
        let a = l.parent ? byId.get(l.parent)?.l : undefined;
        while (a && !a.period) a = a.parent ? byId.get(a.parent)?.l : undefined;
        if (a?.period && a.period.from > l.period.from)
          err(where, `starts (${l.period.from}) before its ancestor ${a.id} (${a.period.from})`);
        const end = l.period.to ?? 2100;
        for (const at of l.attestations)
          if (at.year < l.period.from || at.year > end)
            warn(`${where}#attestation:${at.id}`, `year ${at.year} outside period ${l.period.from}..${l.period.to ?? "present"}`);
      }
      if (l.kind === "proto" && l.works.length) err(where, `reconstructed languages have no attested works`);
      if (l.status === "living" && !l.speakers) warn(where, `living language without speakers figure`);
      if (l.kind === "language" && l.story.length === 0) warn(where, `language without story`);
    }
  }

  // --- journeys -----------------------------------------------------------
  for (const { key, data } of journeys) {
    const defined = sourceDupes(key, data.sources.map(s => s.id));
    const claims = journeyClaims(data);
    checkSourceRefs(key, defined, claims);
    data.steps.forEach((s, i) => {
      if (!byId.has(s.languoid)) err(`${key}#step:${i}`, `languoid "${s.languoid}" does not exist`);
    });
  }

  // --- verification -------------------------------------------------------
  const verifs = new Map<string, TVerificationFile>();
  for (const vf of input.verifications) {
    const r = v.safeParse(VerificationFile, vf.raw);
    if (!r.success) {
      for (const i of r.issues) err(`verification/${vf.key}:${v.getDotPath(i) ?? ""}`, i.message);
      continue;
    }
    verifs.set(vf.key, r.output);
  }
  const claims: ValidationResult["claims"] = [];
  const addClaims = (key: string, list: Claim[]) => {
    const vf = verifs.get(key);
    for (const claim of list) {
      const hash = hashClaim(claim);
      const verdict = vf?.claims[claim.id];
      let status: ValidationResult["claims"][number]["status"];
      if (!verdict) status = "unverified";
      else if (verdict.hash !== hash) status = "stale";
      else if (verdict.verdict === "rejected") status = "rejected";
      else status = "verified";
      claims.push({ key, claim, hash, status });
      if (status === "rejected") err(`${key}:${claim.id}`, `claim was rejected by the verifier; fix or remove it`);
      else if (status !== "verified") {
        const msg = status === "stale" ? "claim changed since it was verified" : "claim has not been verified";
        (opts.allowUnverified ? warn : err)(`${key}:${claim.id}`, msg);
      }
    }
  };
  for (const { key, data } of families) addClaims(key, familyClaims(data));
  for (const { key, data } of journeys) addClaims(key, journeyClaims(data));

  return { issues, families, journeys, claims };
}
