import { For, Show, createMemo } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { ancestors, type AtlasNode, type ClaimStatus } from "../data/model.ts";
import type { Source } from "../data/schema.ts";
import { formatRange, formatYear } from "../lib/years.ts";
import { dirFor, fontFor, isVertical } from "../lib/scripts.ts";
import { WorkCard } from "./WorkCard.tsx";

export function ClaimMark(props: { status: ClaimStatus | undefined; evidence?: number; note?: string }) {
  const label = () => {
    const s = props.status ?? "unverified";
    if (s === "verified") return `Independently verified${props.evidence ? ` against ${props.evidence} source${props.evidence > 1 ? "s" : ""}` : ""}${props.note ? ` · ${props.note}` : ""}`;
    if (s === "stale") return "Changed since verification: awaiting re-check";
    if (s === "rejected") return "Rejected by the fact-checker";
    return "Awaiting independent verification";
  };
  return (
    <span class={["claim-mark", props.status ?? "unverified"]} title={label()} aria-label={label()}>
      <Show when={props.status === "verified"} fallback="•">
        ✓
      </Show>
    </span>
  );
}

export function Cites(props: { nums: number[] }) {
  return (
    <sup class="cites">
      <For each={props.nums}>{(n, i) => <a href={`#src-${n}`}>{n}{i() < props.nums.length - 1 ? "," : ""}</a>}</For>
    </sup>
  );
}

export function LanguagePanel() {
  const { atlas, state, actions } = useAtlas();
  const node = createMemo(() => (state.selected ? atlas.nodes.get(state.selected) ?? null : null));

  return (
    <aside class={["panel glass", { open: !!node() }]} aria-label="Language details" aria-hidden={node() ? "false" : "true"}>
      <Show when={node()}>{n => <PanelBody node={n()} />}</Show>
      <button class="panel-close" aria-label="Close" onClick={() => actions.select(null)}>
        ×
      </button>
    </aside>
  );
}

function PanelBody(props: { node: AtlasNode }) {
  const { atlas, actions } = useAtlas();

  // citation numbering for this page, in order of first appearance
  const page = createMemo(() => {
    const n = props.node;
    const order: string[] = [];
    const cite = (ids: string[]) =>
      ids.map(id => {
        let i = order.indexOf(id);
        if (i < 0) i = order.push(id) - 1;
        return i + 1;
      });
    const l = n.l;
    const nums = {
      identity: cite(l.sources),
      period: l.period ? cite(l.period.sources) : [],
      homeland: l.homeland ? cite(l.homeland.sources) : [],
      scripts: l.scripts ? cite(l.scripts.sources) : [],
      speakers: l.speakers ? cite(l.speakers.sources) : [],
      story: l.story.map(p => cite(p.sources)),
      attestations: l.attestations.map(a => cite(a.sources)),
      works: l.works.map(w => cite(w.sources)),
      notes: l.notes.map(p => cite(p.sources))
    };
    const sources = order.map(id => n.sources.get(id)).filter((s): s is Source => !!s);
    const claims = [...n.claims.values()];
    const verified = claims.filter(c => c.status === "verified").length;
    return { nums, sources, verified, total: claims.length };
  });

  const claim = (suffix: string) => props.node.claims.get(`${props.node.l.id}#${suffix}`);
  const color = () => atlas.colors.get(props.node.rootId) ?? "#e8c170";
  const lineage = () => ancestors(atlas, props.node.l.id);
  const kids = () => props.node.children.map(c => atlas.nodes.get(c)!).filter(Boolean);
  const statusLabel = () => (props.node.l.kind === "proto" ? "Reconstructed" : props.node.l.kind === "group" ? "Branch" : props.node.l.status === "living" ? "Living" : props.node.l.status === "classical" ? "Classical · in use" : "Extinct");

  return (
    <div class="panel-body" style={{ "--c": color() }}>
      <nav class="lineage" aria-label="Lineage">
        <For each={lineage()}>
          {a => (
            <>
              <button class="lineage-step" onClick={() => actions.visit(a.l.id)}>
                {a.l.name}
              </button>
              <span class="lineage-sep">›</span>
            </>
          )}
        </For>
      </nav>

      <header class="panel-head">
        <div class="panel-badges">
          <span class={["badge", props.node.l.kind === "proto" ? "proto" : props.node.l.status]}>{statusLabel()}</span>
          <Show when={props.node.l.period}>{p => <span class="badge ghost">{formatRange(p().from, p().to, p().approx)}</span>}</Show>
        </div>
        <h2 class="panel-title">
          {props.node.l.name}
          <ClaimMark status={claim("identity")?.status} evidence={claim("identity")?.evidence.length} />
          <Cites nums={page().nums.identity} />
        </h2>
        <Show when={props.node.l.nativeName}>
          {nat => (
            <p
              class={["panel-native", { vertical: isVertical(props.node.l.nativeScript) }]}
              lang={props.node.l.iso639_3}
              dir={dirFor(props.node.l.nativeScript)}
              style={{ "font-family": fontFor(props.node.l.nativeScript) }}
            >
              {nat()}
            </p>
          )}
        </Show>
      </header>

      <Show when={props.node.l.story[0]}>
        {p => (
          <section class="story">
            <p>
              {p().text}
              <ClaimMark status={claim("story:0")?.status} evidence={claim("story:0")?.evidence.length} note={claim("story:0")?.note} />
              <Cites nums={page().nums.story[0] ?? []} />
            </p>
          </section>
        )}
      </Show>

      <dl class="facts">
        <Show when={props.node.l.period}>
          {p => (
            <div class="fact">
              <dt>Period</dt>
              <dd>
                {formatRange(p().from, p().to, p().approx)}
                <ClaimMark status={claim("period")?.status} evidence={claim("period")?.evidence.length} note={claim("period")?.note} />
                <Cites nums={page().nums.period} />
                <Show when={p().note}>{note => <small>{note()}</small>}</Show>
              </dd>
            </div>
          )}
        </Show>
        <Show when={props.node.l.homeland}>
          {h => (
            <div class="fact">
              <dt>{props.node.l.kind === "proto" ? "Probable homeland" : "Origin"}</dt>
              <dd>
                {h().label}
                <ClaimMark status={claim("homeland")?.status} evidence={claim("homeland")?.evidence.length} />
                <Cites nums={page().nums.homeland} />
              </dd>
            </div>
          )}
        </Show>
        <Show when={props.node.l.speakers}>
          {s => (
            <div class="fact">
              <dt>Speakers</dt>
              <dd>
                {formatCount(s().count)} {s().scope === "L1" ? "native" : "native + second-language"} ({s().year})
                <ClaimMark status={claim("speakers")?.status} evidence={claim("speakers")?.evidence.length} />
                <Cites nums={page().nums.speakers} />
              </dd>
            </div>
          )}
        </Show>
        <Show when={props.node.l.scripts}>
          {s => (
            <div class="fact">
              <dt>Written in</dt>
              <dd class="chips">
                <For each={s().list}>{sc => <span class="chip">{sc.name}</span>}</For>
                <ClaimMark status={claim("scripts")?.status} evidence={claim("scripts")?.evidence.length} />
                <Cites nums={page().nums.scripts} />
              </dd>
            </div>
          )}
        </Show>
      </dl>

      <Show when={props.node.l.story.length > 1}>
        <details class="fold">
          <summary>Continue reading</summary>
          <section class="story story-more">
            <For each={props.node.l.story.slice(1)}>
              {(p, i) => (
                <p>
                  {p.text}
                  <ClaimMark status={claim(`story:${i() + 1}`)?.status} evidence={claim(`story:${i() + 1}`)?.evidence.length} note={claim(`story:${i() + 1}`)?.note} />
                  <Cites nums={page().nums.story[i() + 1] ?? []} />
                </p>
              )}
            </For>
          </section>
        </details>
      </Show>

      <Show when={props.node.l.attestations.length}>
        <details class="fold">
          <summary>
            Written traces <span class="fold-count">{props.node.l.attestations.length}</span>
          </summary>
          <ol class="attestations">
            <For each={props.node.l.attestations}>
              {(a, i) => (
                <li>
                  <button class="att-year" onClick={() => actions.setYear(a.year)} title="Jump to this year">
                    {formatYear(a.year, a.approx)}
                  </button>
                  <div>
                    <strong>{a.place}</strong>
                    <span>
                      {a.description}
                      <ClaimMark status={claim(`attestation:${a.id}`)?.status} evidence={claim(`attestation:${a.id}`)?.evidence.length} />
                      <Cites nums={page().nums.attestations[i()] ?? []} />
                    </span>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </details>
      </Show>

      <Show when={props.node.l.works.length}>
        <section class="section">
          <h3>Great works</h3>
          <For each={props.node.l.works}>
            {(w, i) => (
              <WorkCard
                work={w}
                lang={props.node.l.iso639_3}
                status={claim(`work:${w.id}`)?.status}
                evidence={claim(`work:${w.id}`)?.evidence.length ?? 0}
                cites={page().nums.works[i()] ?? []}
              />
            )}
          </For>
        </section>
      </Show>

      <Show when={props.node.l.notes.length}>
        <details class="fold">
          <summary>
            Scholarly debate <span class="fold-count">{props.node.l.notes.length}</span>
          </summary>
          <For each={props.node.l.notes}>
            {(p, i) => (
              <p class="note">
                {p.text}
                <ClaimMark status={claim(`note:${i()}`)?.status} evidence={claim(`note:${i()}`)?.evidence.length} />
                <Cites nums={page().nums.notes[i()] ?? []} />
              </p>
            )}
          </For>
        </details>
      </Show>

      <Show when={kids().length}>
        <section class="section">
          <h3>Descendants</h3>
          <div class="chips">
            <For each={kids()}>
              {k => (
                <button class="chip chip-btn" onClick={() => actions.visit(k.l.id)}>
                  {k.l.name}
                </button>
              )}
            </For>
          </div>
        </section>
      </Show>

      <details class="fold sources">
        <summary>
          Sources &amp; fact-check <span class="fold-count">{page().sources.length}</span>
        </summary>
        <p class="verify-summary">
          <span class={["claim-mark", page().verified === page().total ? "verified" : "unverified"]}>{page().verified === page().total ? "✓" : "•"}</span>
          {page().verified} of {page().total} claims on this page independently verified
        </p>
        <ol>
          <For each={page().sources}>
            {(s, i) => (
              <li id={`src-${i() + 1}`}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <Show when={s.author || s.publisher}>
                  <span class="src-meta">
                    {" "}
                    · {[s.author, s.publisher, s.year].filter(Boolean).join(", ")}
                  </span>
                </Show>
              </li>
            )}
          </For>
        </ol>
        <Show when={props.node.l.glottocode}>
          {g => (
            <p class="glotto">
              Glottolog:{" "}
              <a href={`https://glottolog.org/resource/languoid/id/${g()}`} target="_blank" rel="noreferrer">
                {g()}
              </a>
            </p>
          )}
        </Show>
      </details>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.?0+$/, "")} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")} million`;
  return n.toLocaleString("en");
}
