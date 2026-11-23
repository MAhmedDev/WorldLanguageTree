import { Errored, Loading, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { loadAtlas, type LoadedAtlas } from "./data/load.ts";
import { AtlasContext, createAtlasState, useAtlas } from "./state/atlas.tsx";
import { GlobeMap } from "./map/GlobeMap.tsx";
import { TimeRiver } from "./timeline/TimeRiver.tsx";
import { Chronicle } from "./timeline/Chronicle.tsx";
import { LanguageTree } from "./tree/LanguageTree.tsx";
import { LanguagePanel } from "./panel/LanguagePanel.tsx";
import { Search } from "./search/Search.tsx";
import { JourneyCaption, JourneyList, goToStep, journeyBack, journeyNext } from "./journeys/Journeys.tsx";
import { StoryMode, storyBack, storyGo, storyNext, storyPlayPause } from "./story/StoryMode.tsx";
import { About } from "./pages/About.tsx";
import { Settings } from "./ui/Settings.tsx";
import { setAmbientVolume, startAmbient, stopAmbient } from "./lib/sound.ts";
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
        else if (state.selected) actions.select(null);
        else if (state.story) actions.endStory();
        else if (state.journey) actions.endJourney();
      } else if (typing) return;
      else if (e.key === " " && e.target instanceof HTMLButtonElement) return; // Space activates the focused button
      else if (e.target instanceof HTMLElement && e.target.closest(".river-track")) return; // the river handles its own arrows
      else if (e.key === " " && !state.journey) {
        // the one operation: play / pause the story
        storyPlayPause(ctx);
        e.preventDefault();
      } else if ((state.story || state.journey) && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === " ")) {
        // stepping by hand pauses the story
        actions.setAutoplay(false);
        const forward = e.key !== "ArrowLeft";
        if (state.story) (forward ? storyNext : storyBack)(ctx);
        else (forward ? journeyNext : journeyBack)(ctx);
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
  createEffect(
    () => (state.muted ? 0 : state.volume),
    v => setAmbientVolume(v)
  );



  const guided = createMemo(() => !!(state.story || state.journey));

  const begin = (mode: "story" | "play" | "explore" | "journey") => {
    setIntro(false);
    if (mode === "story") {
      storyGo(ctx, 0, -1, 0);
      actions.setAutoplay(true);
    }
    else if (mode === "play") {
      actions.setYear(START_YEAR);
      actions.play(true);
    } else if (mode === "journey") {
      if (atlas.journeys[0]) goToStep(ctx, atlas.journeys[0].id, 0);
      else actions.openJourneys(true);
    } else void tweenYear(state.year, 1500, actions.setYear, 3000, ctx.reducedMotion);
  };

  return (
    <div
      class={[
        "app",
        {
          "tree-open": state.treeOpen,
          "tree-expanded": state.treeExpanded,
          "panel-open": !!state.selected,
          guided: guided(),
          "at-intro": intro()
        }
      ]}
    >
      <GlobeMap />
      <div class="vignette" aria-hidden="true" />

      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true" />
          <h1>World Language Tree</h1>
        </div>
        <nav class="tools" aria-label="Tools">
          <Search inputRef={el => (searchInput = el)} />
          <Settings />
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
      <StoryMode />
      <Show when={!intro() && !guided()}>
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
            <h2 class="intro-title">World Language Tree</h2>
            <p class="intro-lede">The story of human speech, across the globe and through time.</p>
            <button class="intro-begin" onClick={() => begin(atlas.story ? "story" : "play")}>
              Begin
            </button>
            <div class="intro-alt">
              <button onClick={() => begin("explore")}>or explore on your own</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
