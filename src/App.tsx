import { Errored, Loading, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { loadAtlas, type LoadedAtlas } from "./data/load.ts";
import { AtlasContext, createAtlasState, useAtlas } from "./state/atlas.tsx";
import { GlobeMap } from "./map/GlobeMap.tsx";
import { TimeRiver } from "./timeline/TimeRiver.tsx";
import { Chronicle } from "./timeline/Chronicle.tsx";
import { LanguageTree } from "./tree/LanguageTree.tsx";
import { LanguagePanel } from "./panel/LanguagePanel.tsx";
import { Search } from "./search/Search.tsx";
import { JourneyCaption, JourneyList, goToStep } from "./journeys/Journeys.tsx";
import { About } from "./pages/About.tsx";
import { startAmbient, stopAmbient } from "./lib/sound.ts";
import { formatYear } from "./lib/years.ts";
import { tweenYear } from "./lib/tween.ts";

const START_YEAR = -3400;

export function App() {
  const data = createMemo(() => loadAtlas());
  return (
    <Errored
      fallback={(err, reset) => (
        <div class="splash">
          <p>The atlas could not load: {String(err())}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    >
      <Loading fallback={<Splash />}>
        {/* Show reads the async value in a tracked scope, so the context provider below only ever sees resolved data */}
        <Show when={data()} keyed>
          {d => <AtlasRoot data={d} />}
        </Show>
      </Loading>
    </Errored>
  );
}

function Splash() {
  return (
    <div class="splash">
      <div class="splash-mark" />
      <p>Gathering the world's languages…</p>
    </div>
  );
}

/** Rendered once per loaded dataset (keyed Show), so the store is created exactly once. */
function AtlasRoot(props: { data: LoadedAtlas }) {
  return (
    <Show when={props.data} keyed>
      {data => (
        <AtlasContext value={createAtlasState(data.atlas, START_YEAR)}>
          <Shell issues={data.issues.filter(i => i.level === "error").length} />
        </AtlasContext>
      )}
    </Show>
  );
}

function Shell(props: { issues: number }) {
  const ctx = useAtlas();
  const { atlas, state, actions } = ctx;
  const [intro, setIntro] = createSignal(true);
  let searchInput: HTMLInputElement | undefined;

  // keyboard shortcuts
  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        searchInput?.focus();
        e.preventDefault();
      } else if (e.key === "Escape") {
        if (state.aboutOpen) actions.openAbout(false);
        else if (state.journeysOpen) actions.openJourneys(false);
        else if (state.treeExpanded) actions.expandTree(false);
        else actions.select(null);
      } else if (typing || e.target instanceof HTMLButtonElement) return;
      else if (e.key === " ") {
        actions.play();
        e.preventDefault();
      } else if (e.key.toLowerCase() === "t") actions.toggleTree();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  createEffect(
    () => state.sound,
    on => (on ? startAmbient() : stopAmbient())
  );

  const verified = createMemo(() => {
    let total = 0;
    let done = 0;
    for (const n of atlas.nodes.values())
      for (const c of n.claims.values()) {
        total++;
        if (c.status === "verified") done++;
      }
    return { total, done };
  });

  // the oldest dated written record in the atlas, shown on the intro
  const firstRecord = createMemo(() => {
    let best: { year: number; approx: boolean; place: string; description: string; language: string } | null = null;
    for (const n of atlas.nodes.values())
      for (const a of n.l.attestations)
        if (!best || a.year < best.year) best = { year: a.year, approx: a.approx, place: a.place, description: a.description, language: n.l.name };
    return best;
  });

  const begin = (mode: "play" | "explore" | "journey") => {
    setIntro(false);
    if (mode === "play") {
      actions.setYear(START_YEAR);
      actions.play(true);
    } else if (mode === "journey") {
      if (atlas.journeys[0]) goToStep(ctx, atlas.journeys[0].id, 0);
      else actions.openJourneys(true);
    } else void tweenYear(state.year, 1500, actions.setYear, 3000, ctx.reducedMotion);
  };

  return (
    <div class={["app", { "tree-open": state.treeOpen, "tree-expanded": state.treeExpanded, "panel-open": !!state.selected }]}>
      <GlobeMap />
      <div class="vignette" aria-hidden="true" />

      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true" />
          <div>
            <h1>World Language Tree</h1>
            <p>{formatYear(state.year)}</p>
          </div>
        </div>
        <Search inputRef={el => (searchInput = el)} />
        <nav class="tools">
          <button class={{ on: !!state.journey || state.journeysOpen }} onClick={() => actions.openJourneys()}>
            Journeys
          </button>
          <button class={{ on: state.treeOpen }} onClick={() => actions.toggleTree()} title="Toggle tree (T)">
            Tree
          </button>
          <button class={{ on: state.sound }} onClick={() => actions.toggleSound()} aria-label="Ambient sound" title="Ambient sound">
            <Show when={state.sound} fallback="♪ Off">
              ♪ On
            </Show>
          </button>
          <button onClick={() => actions.openAbout()}>About</button>
        </nav>
      </header>

      <Show when={state.treeOpen}>
        <section class={["tree-dock glass", { expanded: state.treeExpanded }]} aria-label="Language tree">
          <div class="dock-head">
            <span>Tree of time</span>
            <button class="link-btn" onClick={() => actions.expandTree()}>
              {state.treeExpanded ? "Dock" : "Expand"}
            </button>
          </div>
          <LanguageTree />
        </section>
      </Show>

      <LanguagePanel />
      <JourneyCaption />
      <Show when={!intro()}>
        <Chronicle />
      </Show>
      <TimeRiver />
      <JourneyList />
      <About />

      <Show when={import.meta.env.DEV && props.issues > 0}>
        <div class="dev-issues">{props.issues} data errors (pnpm check:data)</div>
      </Show>

      <Show when={intro()}>
        <div class="intro">
          <div class="intro-inner">
            <p class="intro-kicker">An atlas of human speech</p>
            <h2>World Language Tree</h2>
            <p class="intro-lede">
              Follow the world's languages from the first marks pressed into clay to the voices of today: where they began, how they travelled, and
              what was written in them.
            </p>
            <Show when={firstRecord()}>
              {r => (
                <blockquote class="intro-record">
                  <span>{formatYear(r().year, r().approx)} · {r().place}</span>
                  {r().description} <em>({r().language})</em>
                </blockquote>
              )}
            </Show>
            <div class="intro-actions">
              <button class="primary" onClick={() => begin("play")}>
                Play through time
              </button>
              <button onClick={() => begin("journey")}>Take a journey</button>
              <button onClick={() => begin("explore")}>Explore freely</button>
            </div>
            <p class="intro-foot">
              {atlas.nodes.size} languages and ancestors · every fact sourced · {verified().done.toLocaleString("en")} of {verified().total.toLocaleString("en")}{" "}
              independently fact-checked · press <kbd>/</kbd> to search
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}
