import { Show } from "solid-js";
import type { Work } from "../data/schema.ts";
import type { ClaimStatus } from "../data/model.ts";
import { dirFor, fontFor, isVertical } from "../lib/scripts.ts";
import { ClaimMark, Cites } from "./LanguagePanel.tsx";

export function WorkCard(props: { work: Work; lang?: string; status?: ClaimStatus; evidence: number; cites: number[] }) {
  return (
    <article class="work">
      <header>
        <h4>
          {props.work.title}
          <ClaimMark status={props.status} evidence={props.evidence} />
          <Cites nums={props.cites} />
        </h4>
        <p class="work-meta">
          <Show when={props.work.titleOriginal}>
            {t => (
              <span class="work-title-orig" dir={dirFor(props.work.originalScript)} style={{ "font-family": fontFor(props.work.originalScript) }}>
                {t()}
              </span>
            )}
          </Show>
          <span>
            {props.work.author} · {props.work.date}
          </span>
        </p>
      </header>
      <p class="work-sig">{props.work.significance}</p>
      <div class="excerpt">
        <blockquote
          class={["excerpt-original", { vertical: isVertical(props.work.originalScript) }]}
          lang={props.lang}
          dir={dirFor(props.work.originalScript)}
          style={{ "font-family": fontFor(props.work.originalScript) }}
        >
          {props.work.original}
        </blockquote>
        <Show when={props.work.transliteration}>{t => <p class="excerpt-translit">{t()}</p>}</Show>
        <blockquote class="excerpt-translation" lang="en">
          {props.work.translation}
        </blockquote>
        <p class="excerpt-credit">
          {props.work.translationKind === "project-literal" ? "Literal translation by the World Language Tree" : `Translation: ${props.work.translator}${props.work.translationYear ? ` (${props.work.translationYear})` : ""}, public domain`}
          {" · "}
          <a href={props.work.fullTextUrl} target="_blank" rel="noreferrer">
            Read the full text ↗
          </a>
        </p>
      </div>
    </article>
  );
}
