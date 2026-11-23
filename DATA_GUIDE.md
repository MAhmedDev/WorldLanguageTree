# Data guide: researchers and verifiers

The World Language Tree is an immersive atlas. Its value depends on every
statement being **true and sourced**. Nothing is invented, embellished or
guessed. If you cannot source something, leave it out.

The schema is in `src/data/schema.ts` and is the source of truth. Validate
with `pnpm check:data --allow-unverified --warnings`.

## Files

- `data/families/<name>.json` holds one file per family or branch.
  - Shape: `{ family: { id, name, root? }, sources: [...], languoids: [...] }`.
  - A languoid's `parent` may point to an id in another file, e.g. `"proto-indo-european"`.
  - Source ids are local to their file.
- `data/journeys/<name>.json` holds guided tours.
- `verification/families/<name>.json` holds verifier verdicts. Write these only through `pnpm record`.

Shared root ids that other files may reference:

| id | defined in |
|---|---|
| `proto-indo-european` | `families/indo-european.json` |
| `proto-afroasiatic` | `families/afroasiatic.json` |
| `proto-sino-tibetan` | `families/sino-tibetan.json` |
| `proto-austronesian` | `families/austronesian.json` |
| `proto-uralic` | `families/uralic.json` |
| `proto-turkic` | `families/turkic.json` |
| `proto-dravidian` | `families/dravidian.json` |

## Conventions

- **Years** are integers. Negative means BCE: `-3400` is 3400 BCE, `1066` is 1066 CE.
  - Use `approx: true` for anything not pinned to a known year.
  - `period.to` is `null` for languages still spoken. Extinct languages need a `to`.
- **Ids** are lowercase kebab-case English names, e.g. `old-norse`, `classical-arabic`, `proto-germanic`.
- **kind**
  - `proto`: a reconstructed ancestor with no texts. Always `status: "extinct"`, always `approx: true`, never `works`.
  - `language`: attested languages and historical stages, e.g. `old-english`, `middle-english`, `english`.
  - `group`: a branch node with no single language, e.g. `romance` or `west-germanic`. A group needs no period or homeland. Use one only where it helps the tree read clearly. Prefer a proto node when scholars reconstruct one.
- **status** has three values:
  - `living`: has native (L1) speakers today.
  - `classical`: no native speakers, but in **continuous** use to this day for liturgy, scholarship or literature. Examples: Latin, Classical Sanskrit, Classical Arabic, Pali, Ge'ez, Syriac, Coptic, Classical Tibetan, Church Slavonic. Set `period.to: null` and say how it is used in the story or notes.
  - `extinct`: no longer spoken or used. Needs a `period.to`.
- **Historical stages.** Model important stages as their own languoids in a chain: Old English → Middle English → English. The child's `period.from` must be ≥ the parent's `period.from`.
- **period.from** is the date scholars give for the language emerging as distinct. If sources only give the first attestation, use that and say so in `period.note`. First written records go in `attestations`.
- **homeland** is a single point inside the region where the language is mainstream-agreed to have originated or been first spoken.
  - The `label` names the region.
  - If the homeland is debated, as for PIE (Steppe vs Anatolian) or Proto-Austronesian (Taiwan), put the mainstream view in `homeland` and the alternatives in `notes`, stated neutrally with sources.
- **attestations** hold 1–4 dated, located, notable records where the language is written or spoken. Prefer the earliest inscription or text, and add points that show its spread. Examples: Latin's Lapis Niger in the Forum, Latin inscriptions on Hadrian's Wall; Old Norse runestones; Phoenician at Byblos and at Carthage. Real places, real objects, real dates. **These points draw the map**, so pick ones that show where the language lived.
- **glottocode:** look it up with `pnpm glotto find <name>`. Use the code for the languoid that matches exactly, at whatever level (`language`, `dialect` or `family`). Use `null` only if Glottolog has nothing that matches. Never invent a code. The checker rejects unknown codes.
- **nativeName** is the language's own name for itself in its own script, e.g. `"Latina"`, `"Ἑλληνική"`, `"العربية"`, `"हिन्दी"`. Set `nativeScript` to the ISO 15924 code of that string (Latn, Grek, Arab, Hebr, Deva, Beng, Taml, Hans, Hant, Jpan, Kore, Cyrl, Armn, Geor, Ethi, Thai, Khmr, Tibt, Mymr, Xsux for cuneiform, Egyp, Phnx, Runr, Goth, Ogam, …). For an extinct language, omit `nativeName` unless an attested self-name exists.
- **scripts** lists the writing systems the language has been written in, historically and now. Each entry has a `name` and an ISO 15924 `code`.
- **speakers:** only for living languages. Give `count`, the source's `year`, and `scope` ("L1" for native speakers only, "L1+L2" if second-language speakers are included). Copy the source's figure exactly. Do not average or round across sources.
- **story** is 2–4 paragraphs of 50–120 words each, written for a curious reader. Make it vivid and specific (people, places, objects, dates), but **only use facts the cited sources support**. No hype words ("rich tapestry", "vibrant"). No unsourced superlatives. Every paragraph cites at least one source that supports all of its statements.
- **notes:** scholarly debates and competing hypotheses, stated neutrally, with sources for each side.
- **works:** see below.

## Great works (excerpt + translation)

For languages with a literary tradition, include 1–3 of their most celebrated works, such as epics, scripture, poetry, plays and founding texts. Each needs:
- `original`: a **short** excerpt of a few lines (usually the opening) in the original script, copied exactly from a reliable edition such as Wikisource, Perseus, Gutenberg or a scholarly site. Take the text from the source. Do not type it from memory.
- `translation`:
  - prefer a **public-domain** translation and name the translator. `translationKind: "public-domain"`.
  - otherwise write a careful **literal** translation. `translator: "World Language Tree (literal)"`, `translationKind: "project-literal"`.
- **Copyright rule:** the original must be public domain. That means it was published before 1931 **and** its author died before 1956 (anonymous and ancient works are fine). A public-domain translation follows the same rule (translation published before 1931, translator died before 1956). If you are unsure, use a project-literal translation, or skip the work.
- `fullTextUrl`: a link to the full text (Wikisource, Perseus, Gutenberg, the Internet Sacred Text Archive, etc.).
- `significance`: one or two sentences on why the work matters, sourced.
- `originalScript`: the ISO 15924 code. Add a `transliteration` for non-Latin scripts where one helps.

Good examples: the Epic of Gilgamesh (Akkadian), the Iliad (Ancient Greek), the Rigveda (Vedic Sanskrit), the Shijing (Old Chinese), the Aeneid (Latin), Beowulf (Old English), the Divine Comedy (Italian), Don Quixote (Spanish), the Man'yōshū (Old Japanese), the Shahnameh (Persian), the Popol Vuh (K'iche'), Tirukkuṟaḷ (Tamil), Hafez (Persian), Pushkin (Russian), Kalevala (Finnish).

## Sources

`sources: [{ id, title, url, author?, year?, publisher? }]`

- Use authoritative, fetchable sources: Glottolog, Encyclopaedia Britannica, academic or university pages, museum pages (British Museum, Louvre, the Met), UNESCO, national library pages, Wikisource, Perseus or Gutenberg for texts. Wikipedia is acceptable as a source, but it should not be the only source for a contested or surprising claim.
- **Every URL must be one you actually fetched, and it must actually support the claim.** Do not cite a URL you have not opened. Do not construct URLs.
- Glottolog pages: `https://glottolog.org/resource/languoid/id/<glottocode>`.

## Workflow for researchers

1. Read this guide and `src/data/schema.ts`.
2. Research with WebSearch and WebFetch. Write your file(s) under `data/families/`.
3. Run `pnpm check:data --allow-unverified --warnings` until **your files have no errors**. Warnings about other files and "not verified" warnings are expected.
4. Report: the files written, the languoid count, and anything you were unsure about or left out on purpose.

## Workflow for verifiers (independent fact-check)

You did not write the data. Assume nothing in it is true until you have checked it.

1. Run `pnpm claims families/<name>` to get every claim, with its id, content and resolved sources.
2. For **each** claim:
   - Open the cited source(s) and confirm they support **every** detail: names, dates, places, numbers, quotes, attributions.
   - For dates, numbers and anything surprising, also confirm with **one independent source** found by your own search.
   - For `works`, confirm the excerpt matches a real edition (spelling and script), the translation is faithful, the public-domain rules are met, and the translator and date are right.
   - For coordinates, confirm the point falls in the place the label names.
3. Verdicts:
   - `verified`: correct as written.
   - `corrected`: it was wrong or overstated. **Edit the data file to fix it** (or add a better source), then record "corrected" with a note saying what changed.
   - `rejected`: it cannot be supported. **Remove it from the data file**, then record nothing for it. A removed claim simply disappears. Mention it in your report.
4. Write the verdicts as `{ "<claimId>": { "verdict", "evidence": [urls], "note"? } }` to a temporary file. Run `pnpm record families/<name> <file> --verifier "<your label>"` **after** making all edits, because hashes are stamped from the current data.
5. Run `pnpm claims families/<name> --unverified`. The result should be `[]`. Then run `pnpm check:data --allow-unverified` with no errors for your files.
6. Report counts (verified, corrected, removed) and every correction, in one line each.

## The Story of Language (chapters by age)

`data/story/story-of-language.json` is the chaptered narrative behind "The Story of Language" mode. Its shape is `{ id, title, sources, chapters: [...] }`, where each chapter is:

- `id`, `title` (the age's name), and `from`/`to` years. Chapters are chronological and do not overlap.
- `intro`: 2–3 short narrator paragraphs (40–90 words each), each with `sources`. Set the scene: what the world looked like, which forces moved languages (writing, empires, trade, religion, migration, print, nation states), and what changes on the map in this age.
- `beats`: 4–7 small steps through the age. Each beat has:
  - `id`, a `year` within the chapter, and 1–4 `languoids` (existing ids) that appear or matter at that moment
  - a short `title`
  - `text`: 1–3 sentences, at most 420 characters
  - `sources`

  Beats are chronological. A beat's year should fall within each languoid's period, so it can light up.

Write the narration warmly but factually: specific people, places, objects and dates, and no hype or unsourced superlatives. The verifier checks every intro paragraph (including the chapter's title and dates) and every beat, exactly like any other claim. Claim ids look like `<chapterId>#intro:<n>` and `<chapterId>#beat:<beatId>`. Run `pnpm claims story/story-of-language` for the checklist.
