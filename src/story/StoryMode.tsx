import { For, Match, Show, Switch, createEffect, createMemo, onSettled } from "solid-js";
import { useAtlas, type AtlasContextValue } from "../state/atlas.tsx";
import type { StoryChapter } from "../data/schema.ts";
import { tweenYear } from "../lib/tween.ts";
import { formatRange, formatYear } from "../lib/years.ts";
import { fontFor } from "../lib/scripts.ts";
import { ClaimMark } from "../panel/LanguagePanel.tsx";
import { isSpeaking, pauseSpeaking, resumeSpeaking, setNarratorVolume, speak, stopSpeaking } from "../lib/narrator.ts";
import { IconButton } from "../ui/Icon.tsx";
import { Specimen, pickSpecimen } from "./Specimen.tsx";

const TRAVEL_MS = 2600;
const readMs = (text: string) => Math.max(10000, (text.split(/\s+/).length / 3) * 1000 + 6000);
let arriveTimer: ReturnType<typeof setTimeout> | undefined;

/** Languoids lit up across a whole chapter (for the closing card). */
const chapterLanguoids = (ch: StoryChapter) => [...new Set(ch.beats.flatMap(b => b.languoids))];

/**
 * Move the story to a chapter/beat/paragraph. Travel (time + camera) happens only
 * when the view changes; turning an intro page does not move the globe.
 * Event-handler / timer context only.
 */
export function storyGo(ctx: AtlasContextValue, chapter: number, beat: number, para = 0) {
  const story = ctx.atlas.story;
  const ch = story?.chapters[chapter];
  if (!story || !ch) {
    ctx.actions.endStory();
    return;
  }
  const s = ctx.state.story;
  const sameView = !!s && s.chapter === chapter && s.beat === beat;
  const isOutro = beat >= ch.beats.length;
  const languoids = beat < 0 ? [] : isOutro ? chapterLanguoids(ch) : ch.beats[beat].languoids;
  ctx.actions.storyGo(chapter, beat, para, languoids);
  if (sameView) return;
  stopSpeaking();
  const year = beat < 0 ? ch.from : isOutro ? ch.to : ch.beats[beat].year;
  const travel = ctx.reducedMotion ? 0 : TRAVEL_MS;
  void tweenYear(ctx.state.year, year, ctx.actions.setYear, travel, ctx.reducedMotion);
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(() => ctx.actions.storyArrived(chapter, beat), travel + 250);
}

/** The story step at (or just before) `year`: used when the timeline is scrubbed. */
export function storyJumpToYear(ctx: AtlasContextValue, year: number) {
  const story = ctx.atlas.story;
  if (!story) return;
  let ci = story.chapters.findIndex(ch => year >= ch.from && year < ch.to);
  if (ci < 0) ci = year < story.chapters[0].from ? 0 : story.chapters.length - 1;
  const ch = story.chapters[ci];
  let bi = -1;
  ch.beats.forEach((b, i) => {
    if (b.year <= year) bi = i;
  });
  storyGo(ctx, ci, bi, 0);
}

/** The one big button: start or resume the story and let it play; press again to pause. */
export function storyPlayPause(ctx: AtlasContextValue) {
  const { state, actions } = ctx;
  if (state.story && state.autoplay) {
    actions.setAutoplay(false);
    return;
  }
  if (!state.story) storyJumpToYear(ctx, state.year);
  actions.setAutoplay(true);
}

export function storyNext(ctx: AtlasContextValue) {
  const s = ctx.state.story;
  const story = ctx.atlas.story;
  if (!s || !story) return;
  const ch = story.chapters[s.chapter];
  if (s.beat < 0 && s.para < ch.intro.length - 1) storyGo(ctx, s.chapter, -1, s.para + 1);
  else if (s.beat < ch.beats.length) storyGo(ctx, s.chapter, s.beat + 1);
  else if (s.chapter < story.chapters.length - 1) storyGo(ctx, s.chapter + 1, -1, 0);
  else {
    ctx.actions.setAutoplay(false);
    ctx.actions.endStory();
  }
}

export function storyBack(ctx: AtlasContextValue) {
  const s = ctx.state.story;
  const story = ctx.atlas.story;
  if (!s || !story) return;
  const ch = story.chapters[s.chapter];
  if (s.beat < 0 && s.para > 0) storyGo(ctx, s.chapter, -1, s.para - 1);
  else if (s.beat === 0) storyGo(ctx, s.chapter, -1, ch.intro.length - 1);
  else if (s.beat > 0) storyGo(ctx, s.chapter, s.beat - 1);
  else if (s.chapter > 0) storyGo(ctx, s.chapter - 1, story.chapters[s.chapter - 1].beats.length);
}

export function StoryMode() {
  const ctx = useAtlas();
  const { atlas, state, actions } = ctx;

  const view = createMemo(() => {
    const s = state.story;
    const story = atlas.story;
    if (!s || !story) return null;
    const ch = story.chapters[s.chapter];
    const kind: "intro" | "beat" | "outro" = s.beat < 0 ? "intro" : s.beat >= ch.beats.length ? "outro" : "beat";
    return { s, story, ch, kind, beat: kind === "beat" ? ch.beats[s.beat] : null, total: story.chapters.length };
  });

  /** a real line of the language, shown once the camera has arrived */
  const specimen = createMemo(() => {
    const v = view();
    return v && v.kind === "beat" && v.s.arrived && v.beat ? pickSpecimen(atlas, v.beat) : null;
  });

  /** the narrator's current words: what voice and autoplay pace themselves on */
  const narration = createMemo(() => {
    const v = view();
    if (!v || !v.s.arrived) return { id: "", text: "" };
    if (v.kind === "intro")
      return { id: `${v.ch.id}-intro-${v.s.para}`, text: (v.s.para === 0 ? `${v.ch.title}. ` : "") + v.ch.intro[v.s.para].text };
    if (v.kind === "beat") return { id: `${v.ch.id}-beat-${v.beat!.id}`, text: `${v.beat!.title}. ${v.beat!.text}` };
    return { id: "", text: "" };
  });

  createEffect(
    () => ({ n: narration(), on: state.voice }),
    ({ n, on }) => {
      if (on && n.text) speak(n.id, n.text);
      else stopSpeaking();
    }
  );

  // pause freezes the narrator mid-sentence; continue resumes it
  createEffect(
    () => state.autoplay,
    playing => (playing ? resumeSpeaking() : pauseSpeaking())
  );
  createEffect(
    () => (state.muted ? 0 : state.volume),
    v => setNarratorVolume(v)
  );

  // autoplay: comfortable reading time, or until the narrator finishes speaking
  onSettled(() => {
    let shownAt = 0;
    let seen = "";
    const timer = setInterval(() => {
      const v = view();
      if (!v) return;
      const text = narration().text || (v.kind === "outro" ? "outro" : "");
      const key = `${v.s.chapter}:${v.s.beat}:${v.s.para}:${v.s.arrived}`;
      if (key !== seen) {
        seen = key;
        shownAt = performance.now();
      }
      const total = v.kind === "outro" ? 9000 : readMs(text);
      const elapsed = performance.now() - shownAt;
      const progress = state.autoplay && v.s.arrived ? Math.min(1, elapsed / total) : 0;
      if (!state.autoplay || !v.s.arrived || document.hidden) return;
      const speechDone = !state.voice || (!isSpeaking() && elapsed > 2500);
      if ((state.voice ? speechDone : progress >= 1)) storyNext(ctx);
    }, 200);
    return () => {
      clearInterval(timer);
      stopSpeaking();
    };
  });

  const chip = (id: string) => {
    const n = atlas.nodes.get(id);
    return n ? { id, name: n.l.name, native: n.l.nativeName, script: n.l.nativeScript, color: atlas.colors.get(n.rootId) ?? "#e8c170" } : null;
  };
  const learnMore = (id: string) => {
    actions.setAutoplay(false);
    actions.select(id, { fly: false });
  };
  const claim = (id: string) => atlas.storyClaims.get(id);

  return (
    <Show when={view()}>
      {v => (
        <div class="story-mode" role="region" aria-label="The Story of Language" aria-live="polite">
          <nav class="story-rail" aria-label="Ages">
            <For each={v().story.chapters}>
              {(ch, i) => (
                <button
                  class={{ on: i() === v().s.chapter, past: i() < v().s.chapter }}
                  onClick={() => storyGo(ctx, i(), -1, 0)}
                  aria-label={`${ch.title}, ${formatRange(ch.from, ch.to, true)}`}
                  data-tip={ch.title}
                />
              )}
            </For>
          </nav>

          <Show when={specimen()} keyed>
            {d => <Specimen data={d} />}
          </Show>

          <section class={["story-card glass", v().kind, { "with-specimen": !!specimen() }]}>
            <Show
              when={v().s.arrived}
              fallback={
                <div class="caption-travel">
                  <span>{v().kind === "intro" ? `Entering ${v().ch.title}…` : `Travelling to ${formatYear(v().beat?.year ?? v().ch.to, true)}…`}</span>
                  <i class="caption-travel-bar" />
                </div>
              }
            >
              <Switch>
                <Match when={v().kind === "intro"}>
                  <div class="story-intro" data-para={v().s.para}>
                    <Show when={v().s.para === 0}>
                      <h2 class="story-title">{v().ch.title}</h2>
                      <p class="story-years">{formatRange(v().ch.from, v().ch.to, true)}</p>
                    </Show>
                    <p class="story-para">
                      {v().ch.intro[v().s.para].text}
                      <ClaimMark status={claim(`${v().ch.id}#intro:${v().s.para}`)?.status} evidence={claim(`${v().ch.id}#intro:${v().s.para}`)?.evidence.length} />
                    </p>
                  </div>
                </Match>
                <Match when={v().kind === "beat" && v().beat}>
                  {b => (
                    <div class="caption-body">
                      <p class="caption-kicker">
                        {v().ch.title} · {formatYear(b().year, true)}
                      </p>
                      <h3>
                        {b().title}
                        <ClaimMark status={claim(`${v().ch.id}#beat:${b().id}`)?.status} evidence={claim(`${v().ch.id}#beat:${b().id}`)?.evidence.length} />
                      </h3>
                      <p class="caption-text">{b().text}</p>
                      <div class="story-chips">
                        <For each={b().languoids.map(chip).filter(c => c !== null)}>
                          {c => (
                            <button class="story-chip" style={{ "--c": c!.color }} onClick={() => learnMore(c!.id)}>
                              <i class="dot" />
                              <span>{c!.name}</span>
                              <Show when={c!.native && c!.native !== c!.name}>
                                <em style={{ "font-family": fontFor(c!.script) }}>{c!.native}</em>
                              </Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Match>
                <Match when={v().kind === "outro"}>
                  <div class="story-outro">
                    <p class="caption-kicker">End of an age</p>
                    <h3>{v().ch.title}</h3>
                    <p class="caption-text">
                      Between {formatYear(v().ch.from, true)} and {formatYear(v().ch.to, true)}, {emergedIn(ctx, v().ch)} of the languages in this atlas
                      first appear. The glowing threads on the globe show where they came from and where they travelled.
                    </p>
                    <Show when={v().s.chapter < v().total - 1}>
                      <p class="story-next-age">Next: {v().story.chapters[v().s.chapter + 1].title}</p>
                    </Show>
                  </div>
                </Match>
              </Switch>
            </Show>

            <div class="card-nav dots-only">
              <div class="caption-dots" aria-hidden="true">
                <Show when={v().kind === "intro"} fallback={<For each={v().ch.beats}>{(_, i) => <i class={{ on: v().s.beat === i(), past: v().s.beat > i() || v().kind === "outro" }} />}</For>}>
                  <For each={v().ch.intro}>{(_, i) => <i class={{ on: i() === v().s.para, past: i() < v().s.para }} />}</For>
                </Show>
              </div>
            </div>
            <div class="card-close">
              <IconButton icon="close" label="Leave the story" onClick={() => actions.endStory()} />
            </div>
          </section>
        </div>
      )}
    </Show>
  );
}

/** "12" languoids whose start falls inside the age (computed from verified data). */
function emergedIn(ctx: AtlasContextValue, ch: StoryChapter): number {
  let n = 0;
  for (const node of ctx.atlas.nodes.values()) if (node.l.kind !== "group" && node.from >= ch.from && node.from < ch.to) n++;
  return n;
}
