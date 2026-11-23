import { For, Show, createMemo } from "solid-js";
import type { Atlas } from "../data/model.ts";
import type { StoryBeat, Work } from "../data/schema.ts";
import { dirFor, fontFor, isVertical } from "../lib/scripts.ts";
import { formatYear } from "../lib/years.ts";

export interface SpecimenData {
  language: string;
  work: Work;
  lines: string;
  translation: string;
  transliterated: boolean;
}

const MAX_GRAPHEMES = 90;

/** First line(s) of an excerpt, trimmed at a word boundary. */
function opening(text: string, maxLines: number, maxLen: number): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let out = lines[0] ?? "";
  if (out.length < 28 && lines[1] && maxLines > 1) out += "\n" + lines[1];
  if (out.length > maxLen) out = out.slice(0, maxLen).replace(/\s+\S*$/, "") + " …";
  return out;
}

/**
 * The sample for a story step: a real, verified excerpt in the step's main language,
 * or in a sibling of the same family (never a different family, which would misrepresent it).
 * The work closest in date to the moment is chosen.
 */
export function pickSpecimen(atlas: Atlas, beat: StoryBeat): SpecimenData | null {
  const first = atlas.nodes.get(beat.languoids[0]);
  if (!first) return null;
  const candidates = beat.languoids
    .map(id => atlas.nodes.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n && n.l.works.length > 0 && n.rootId === first.rootId);
  const n = candidates[0];
  if (!n) return null;
  const work = [...n.l.works].sort((a, b) => Math.abs(a.year - beat.year) - Math.abs(b.year - beat.year))[0];
  const nativeScripts = n.l.scripts?.list.map(s => s.code) ?? [];
  const cuneiform = nativeScripts.includes("Xsux");
  const lines = opening(work.original, 2, MAX_GRAPHEMES);
  return {
    language: n.l.name,
    work,
    // Assyriological convention: sign indices are written as subscripts (šar2 → šar₂). Display only.
    lines: cuneiform && work.originalScript === "Latn" ? lines.replace(/(\p{L})(\d+)/gu, (_, l: string, d: string) => l + [...d].map(c => "₀₁₂₃₄₅₆₇₈₉"[+c]).join("")) : lines,
    translation: opening(work.translation, 2, 150),
    transliterated: work.originalScript === "Latn" && nativeScripts.length > 0 && !nativeScripts.includes("Latn")
  };
}

/** Graphemes, so combining marks and scripts like Devanagari stay intact. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(s => s.segment);
  return [...text];
}

/** A line of the language itself, appearing as if being inscribed. */
export function Specimen(props: { data: SpecimenData }) {
  const glyphs = createMemo(() => graphemes(props.data.lines));
  const step = createMemo(() => Math.min(45, 1700 / Math.max(1, glyphs().length)));
  return (
    <figure class="specimen" aria-label={`${props.data.language}: ${props.data.work.title}`}>
      <p class="specimen-lang">
        {props.data.language}
        <Show when={props.data.transliterated}>
          <span> · transliteration</span>
        </Show>
      </p>
      <blockquote
        class={["specimen-text", { vertical: isVertical(props.data.work.originalScript) }]}
        dir={dirFor(props.data.work.originalScript)}
        style={{ "font-family": fontFor(props.data.work.originalScript) }}
      >
        <For each={glyphs()}>
          {(g, i) => (g === "\n" ? <br /> : <span style={{ "animation-delay": `${300 + i() * step()}ms` }}>{g}</span>)}
        </For>
      </blockquote>
      <figcaption>
        <span class="specimen-translation">“{props.data.translation}”</span>
        <span class="specimen-credit">
          {props.data.work.title} · {props.data.work.author} · {props.data.work.date || formatYear(props.data.work.year, true)}
        </span>
      </figcaption>
    </figure>
  );
}
