/**
 * Data schema for the World Language Tree.
 *
 * Years are integers on the historical scale: negative = BCE, positive = CE
 * (-3400 is 3400 BCE). Every factual block carries `sources` (ids defined in
 * the same file's `sources` array). See DATA_GUIDE.md.
 */
import * as v from "valibot";

const Id = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase kebab-case"));
const SourceRefs = v.pipe(v.array(v.string()), v.minLength(1, "at least one source is required"));
const Year = v.pipe(v.number(), v.integer(), v.minValue(-12000), v.maxValue(2100));
const Lat = v.pipe(v.number(), v.minValue(-90), v.maxValue(90));
const Lng = v.pipe(v.number(), v.minValue(-180), v.maxValue(180));
/** ISO 15924 script code, e.g. Latn, Grek, Arab, Hebr, Deva, Hans, Xsux */
const ScriptCode = v.pipe(v.string(), v.regex(/^[A-Z][a-z]{3}$/, "ISO 15924 code, e.g. Latn"));

export const Source = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9:._-]*$/)),
  title: v.string(),
  author: v.optional(v.string()),
  year: v.optional(v.union([v.number(), v.string()])),
  publisher: v.optional(v.string()),
  url: v.pipe(v.string(), v.url())
});

export const Period = v.object({
  from: Year,
  /** null = still spoken today */
  to: v.nullable(Year),
  approx: v.boolean(),
  note: v.optional(v.string()),
  sources: SourceRefs
});

export const Homeland = v.object({
  lat: Lat,
  lng: Lng,
  label: v.string(),
  sources: SourceRefs
});

export const Attestation = v.object({
  id: Id,
  year: Year,
  approx: v.boolean(),
  lat: Lat,
  lng: Lng,
  place: v.string(),
  description: v.string(),
  sources: SourceRefs
});

export const Scripts = v.object({
  list: v.pipe(v.array(v.object({ name: v.string(), code: ScriptCode })), v.minLength(1)),
  sources: SourceRefs
});

export const Speakers = v.object({
  count: v.pipe(v.number(), v.minValue(0)),
  year: Year,
  scope: v.picklist(["L1", "L1+L2"]),
  sources: SourceRefs
});

export const Paragraph = v.object({
  text: v.pipe(v.string(), v.minLength(20)),
  sources: SourceRefs
});

export const Work = v.object({
  id: Id,
  title: v.string(),
  titleOriginal: v.optional(v.string()),
  author: v.string(),
  /** human-readable date, e.g. "c. 29–19 BCE" */
  date: v.string(),
  /** sortable year (approximate midpoint) */
  year: Year,
  significance: v.pipe(v.string(), v.minLength(20)),
  /** short excerpt (a few lines) in the original language and script */
  original: v.pipe(v.string(), v.minLength(1), v.maxLength(900)),
  originalScript: ScriptCode,
  transliteration: v.optional(v.string()),
  translation: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
  translator: v.string(),
  translationYear: v.optional(Year),
  /** "public-domain": translation itself is PD; "project-literal": our own literal rendering, verified */
  translationKind: v.picklist(["public-domain", "project-literal"]),
  /** the original work must be public domain */
  license: v.literal("public-domain"),
  fullTextUrl: v.pipe(v.string(), v.url()),
  sources: SourceRefs
});

export const Languoid = v.object({
  id: Id,
  name: v.string(),
  nativeName: v.optional(v.string()),
  nativeScript: v.optional(ScriptCode),
  /** Glottolog code (4 letters + 4 digits) or null when Glottolog has no matching languoid */
  glottocode: v.nullable(v.pipe(v.string(), v.regex(/^[a-z0-9]{4}\d{4}$/))),
  iso639_3: v.optional(v.pipe(v.string(), v.regex(/^[a-z]{3}$/))),
  /** parent languoid id (may live in another file); null for family roots and isolates */
  parent: v.nullable(Id),
  kind: v.picklist(["proto", "language", "group"]),
  /**
   * living: has native (L1) speakers today.
   * classical: no native speakers, but in continuous use to this day for liturgy, scholarship or literature
   *   (e.g. Latin, Sanskrit, Classical Arabic, Pali, Ge'ez). period.to is null; explain the use in story/notes.
   * extinct: no longer spoken or used.
   */
  status: v.picklist(["living", "classical", "extinct"]),
  /** sources for identity + classification (name, parent, kind, status) */
  sources: SourceRefs,
  period: v.optional(Period),
  homeland: v.optional(Homeland),
  attestations: v.optional(v.array(Attestation), []),
  scripts: v.optional(Scripts),
  speakers: v.optional(Speakers),
  story: v.optional(v.array(Paragraph), []),
  works: v.optional(v.array(Work), []),
  /** competing hypotheses / scholarly debate, stated neutrally */
  notes: v.optional(v.array(Paragraph), [])
});

export const FamilyFile = v.object({
  family: v.object({
    id: Id,
    name: v.string(),
    /** root languoid id of the family, if defined in this file */
    root: v.optional(Id)
  }),
  sources: v.array(Source),
  languoids: v.array(Languoid)
});

export const JourneyStep = v.object({
  languoid: Id,
  year: Year,
  title: v.string(),
  text: v.pipe(v.string(), v.minLength(20)),
  sources: SourceRefs
});

export const Journey = v.object({
  id: Id,
  title: v.string(),
  subtitle: v.string(),
  sources: v.array(Source),
  steps: v.pipe(v.array(JourneyStep), v.minLength(2))
});

/** "The Story of Language": the guided, chaptered telling by age. */
export const StoryBeat = v.object({
  id: Id,
  /** the moment the beat shows; time advances to it, igniting everything in between */
  year: Year,
  /** 1–4 languoids this beat introduces (lit up together, camera frames them) */
  languoids: v.pipe(v.array(Id), v.minLength(1), v.maxLength(4)),
  title: v.string(),
  /** narrator: 1–3 sentences */
  text: v.pipe(v.string(), v.minLength(20), v.maxLength(420)),
  sources: SourceRefs
});

export const StoryChapter = v.object({
  id: Id,
  title: v.string(),
  from: Year,
  to: Year,
  /** narrator's introduction to the age: 2–3 short paragraphs, revealed one at a time */
  intro: v.pipe(v.array(Paragraph), v.minLength(1), v.maxLength(4)),
  beats: v.pipe(v.array(StoryBeat), v.minLength(2), v.maxLength(8))
});

export const Story = v.object({
  id: Id,
  title: v.string(),
  sources: v.array(Source),
  chapters: v.pipe(v.array(StoryChapter), v.minLength(1))
});

export const Verdict = v.object({
  hash: v.string(),
  verdict: v.picklist(["verified", "corrected", "rejected"]),
  evidence: v.array(v.pipe(v.string(), v.url())),
  note: v.optional(v.string())
});

export const VerificationFile = v.object({
  file: v.string(),
  verifiedAt: v.string(),
  verifier: v.optional(v.string()),
  claims: v.record(v.string(), Verdict)
});

export type Source = v.InferOutput<typeof Source>;
export type Period = v.InferOutput<typeof Period>;
export type Homeland = v.InferOutput<typeof Homeland>;
export type Attestation = v.InferOutput<typeof Attestation>;
export type Work = v.InferOutput<typeof Work>;
export type Paragraph = v.InferOutput<typeof Paragraph>;
export type Languoid = v.InferOutput<typeof Languoid>;
export type FamilyFile = v.InferOutput<typeof FamilyFile>;
export type Journey = v.InferOutput<typeof Journey>;
export type JourneyStep = v.InferOutput<typeof JourneyStep>;
export type Story = v.InferOutput<typeof Story>;
export type StoryChapter = v.InferOutput<typeof StoryChapter>;
export type StoryBeat = v.InferOutput<typeof StoryBeat>;
export type VerificationFile = v.InferOutput<typeof VerificationFile>;
