# World Language Tree

An immersive, fact-checked atlas of the world's languages. Press play and a narrator walks you through human language history, age by age. A night globe shows languages appearing, spreading and fading, with real lines of text in their own scripts, from Sumerian clay to the voices of today.

- **The Story of Language:** 7 ages and 47 steps, narrated (local neural voice) and fully reader-controllable: play, pause, skip, volume, scrub.
- **303 languages and ancestors** across 26 family files, each with its own page: origins, written traces, great works (original text and translation), scholarly debate and sources.
- **A tree of time:** a radial family tree whose radius is the date. Select a language to light up its path to the roots.
- **Five themed journeys**, search, and a clean, icon-led interface.

## Every fact is checked

The data in `data/` is split into **2,478 individual claims**. Every claim cites the sources it comes from. An independent verifier, separate from the researcher who wrote the claim, re-checked each one against its sources and at least one independent source, then verified, corrected or removed it (`verification/`). Each claim is fingerprinted. Editing it lapses its verification, and `pnpm build` refuses to build until it has been re-checked. Narration audio only plays when its recorded words match the current verified text. See `DATA_GUIDE.md` for the researcher and verifier workflow.

Limitations, stated honestly: many sources are Wikipedia, cross-checked where possible against museum, university and scholarly pages. Dates for reconstructed proto-languages are scholarly estimates, and the atlas presents competing hypotheses neutrally.

## Running it

```sh
pnpm install
pnpm dev                 # development server
pnpm build && pnpm preview
```

Other commands:

| Command | What it does |
|---|---|
| `pnpm check:data [--allow-unverified] [--warnings] [--report]` | validate all data and its verification status |
| `pnpm test` / `pnpm lint` | tests (vitest) and lint (eslint-plugin-solid, v2-strict) |
| `pnpm glotto fetch\|find <name>\|snapshot` | Glottolog lookups and the coordinate snapshot |
| `pnpm claims <file>` / `pnpm record <file> <verdicts.json>` | the verifier's checklist and recording |
| `pnpm narrate` | re-render narration clips whose text changed (needs `uv` and `ffmpeg`) |
| `pnpm geo` | rebuild the slimmed Natural Earth basemap |

Built with [Solid 2](https://www.solidjs.com), Vite and [MapLibre GL](https://maplibre.org). See `CLAUDE.md` for code conventions.

## Credits and licences

- **Classification and coordinates:** [Glottolog](https://glottolog.org) by Hammarström, Forkel, Haspelmath and Bank, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Basemap:** [Natural Earth](https://www.naturalearthdata.com), public domain.
- **Narration voice:** generated locally with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), Apache 2.0.
- **Language write-ups** were researched from the sources cited on each page, many of them [Wikipedia](https://www.wikipedia.org) articles, which are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The text is written in our own words and each page links its sources. Where Wikipedia wording informs a passage, credit goes to its contributors.
- **Literary excerpts** are public-domain texts (published before 1931, author died before 1956). Translations are public domain or literal renderings made for this project, and are labelled as such.
- **Typefaces:** Cormorant Garamond, Inter and the Noto family, all under the SIL Open Font License.
