# World Language Tree

An immersive, fact-checked atlas of the world's languages: a night globe (MapLibre), a radial "tree of time", a time river, language pages with great works, and guided journeys. Built with **Solid 2** and Vite, and runs locally (`pnpm dev`).

## Commands

- `pnpm dev`: start the dev server
- `pnpm check:data [--allow-unverified] [--warnings] [--report]`: validate all data and its verification status. `pnpm build` runs it **strict**, so every claim must be verified.
- `pnpm test`: run the vitest suite. `pnpm lint`: eslint with `eslint-plugin-solid` v2-strict. `npx tsc --noEmit -p .`: type check.
- `pnpm glotto fetch|find <name>|code <code>|snapshot`: Glottolog lookup (the CC-BY CSV is cached in `data/glottolog/.cache`). Run `snapshot` after data changes so the app has present-day coordinates.
- `pnpm claims <families/x>` and `pnpm record <families/x> <verdicts.json>`: the verifier's checklist and how verdicts get recorded.

## Solid 2 rules (this is not Solid 1.x and not React)

Read `node_modules/solid-js/skills/solid-2.0/SKILL.md` before writing components. Check names against `node_modules/solid-js/CHEATSHEET.md`.

- `createEffect(compute, apply)`. Read reactive state **only in compute**. Reading a signal or store in apply triggers `STRICT_READ_UNTRACKED`. For imperative mirrors (e.g. the zoom level), keep a plain variable.
- No reactive reads at the top of a component body. No writes in memos, effect compute, or component bodies. Write from handlers, timers, rAF callbacks or `onSettled`.
- Async data is an async `createMemo` under `<Loading>`. A context provider's `value` is read once, so give it a resolved value (see `AtlasRoot` in `src/App.tsx`).
- `class={{...}}` / arrays (no `classList`); `<For>` default gives a raw item and an index accessor.
- Dev diagnostics print `[CODE]` in the console and are forwarded to the Vite log. Fix the cause. Never silence one with `untrack`.

## Data and truthfulness rules

- `DATA_GUIDE.md` is the contract for researchers and verifiers. `src/data/schema.ts` is the schema.
- Every fact cites sources. Claims are hashed (`src/data/claims.ts`), so editing a claim invalidates its verification.
- UI copy must not introduce new factual claims. Facts shown in the UI come from verified data. Generic orientation labels (era names on the time river) are the only exception.
- The map draws only sourced points (homeland, attestations, Glottolog centres) and arcs between them. Never add invented territories.
- Families are never joined to each other (no "Altaic" or "Nostratic" links); debates go in `notes`.

## Layout

- `src/data/`: schema, claims, validation, atlas model, and the browser loader
- `src/map/`: globe style and component
- `src/tree/`: radial tree of time
- `src/timeline/`: time river
- `src/panel/`: language page and work cards
- `src/journeys/`, `src/search/`, `src/pages/About.tsx`
- `data/families/*.json`, `data/journeys/*.json`, `verification/**`, `scripts/*.ts` (run by Node's native TS stripping)
