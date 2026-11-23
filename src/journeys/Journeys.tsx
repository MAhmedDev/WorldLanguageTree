import { For, Show, createMemo, onSettled } from "solid-js";
import { useAtlas, type AtlasContextValue } from "../state/atlas.tsx";
import { tweenYear } from "../lib/tween.ts";
import { formatYear } from "../lib/years.ts";
import { ClaimMark } from "../panel/LanguagePanel.tsx";
import { IconButton } from "../ui/Icon.tsx";

/** How long the camera and the time river take to travel between steps. */
const TRAVEL_MS = 2800;
/** Autoplay dwell: comfortable reading time (180 wpm) plus a pause to look at the map. */
const readMs = (text: string) => Math.max(12000, (text.split(/\s+/).length / 3) * 1000 + 7000);

let arriveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Move a journey to `step`. Choreographed, not simultaneous: the page closes, the
 * camera and time travel together, and only once they arrive does the caption
 * reveal the step. Call from event handlers or timers only.
 */
export function goToStep(ctx: AtlasContextValue, journeyId: string, step: number) {
  const j = ctx.atlas.journeys.find(x => x.id === journeyId);
  const s = j?.steps[step];
  if (!j || !s) {
    ctx.actions.endJourney();
    return;
  }
  ctx.actions.journeyGo(journeyId, step, s.languoid);
  const travel = ctx.reducedMotion ? 0 : TRAVEL_MS;
  void tweenYear(ctx.state.year, s.year, ctx.actions.setYear, travel, ctx.reducedMotion);
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(() => ctx.actions.journeyArrived(journeyId, step), travel + 250);
}

export function journeyNext(ctx: AtlasContextValue) {
  const j = ctx.state.journey;
  const journey = j && ctx.atlas.journeys.find(x => x.id === j.id);
  if (!j || !journey) return;
  if (j.step >= journey.steps.length - 1) ctx.actions.endJourney();
  else goToStep(ctx, j.id, j.step + 1);
}

export function journeyBack(ctx: AtlasContextValue) {
  const j = ctx.state.journey;
  if (j && j.step > 0) goToStep(ctx, j.id, j.step - 1);
}

export function JourneyList() {
  const ctx = useAtlas();
  const { atlas, state, actions } = ctx;
  return (
    <Show when={state.journeysOpen}>
      <div class="overlay" onClick={() => actions.openJourneys(false)}>
        <div class="journeys glass" role="dialog" aria-label="Journeys" onClick={e => e.stopPropagation()}>
          <h2>Journeys</h2>
          <p class="muted">Guided tours through time, at your own pace. Each step is sourced and fact-checked.</p>
          <Show when={atlas.journeys.length} fallback={<p class="muted">Journeys are being researched and verified.</p>}>
            <ul class="journey-list">
              <For each={atlas.journeys}>
                {j => (
                  <li>
                    <button onClick={() => goToStep(ctx, j.id, 0)}>
                      <strong>{j.title}</strong>
                      <span>{j.subtitle}</span>
                      <em>
                        {j.steps.length} stops · {formatYear(j.steps[0].year, true)} → {formatYear(j.steps[j.steps.length - 1].year, true)}
                      </em>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </Show>
  );
}

export function JourneyCaption() {
  const ctx = useAtlas();
  const { atlas, state, actions } = ctx;
  const current = createMemo(() => {
    const j = state.journey;
    if (!j) return null;
    const journey = atlas.journeys.find(x => x.id === j.id);
    if (!journey) return null;
    const step = journey.steps[j.step];
    const node = atlas.nodes.get(step.languoid);
    return { journey, step, index: j.step, arrived: j.arrived, name: node?.l.name ?? step.languoid, last: j.step === journey.steps.length - 1 };
  });
  const claim = () => {
    const c = current();
    return c ? atlas.journeyClaims.get(`${c.journey.id}#step:${c.index}`) : undefined;
  };

  // Autoplay (off by default): wait for reading time after arrival, then advance.
  onSettled(() => {
    let arrivedAt = 0;
    let seen = "";
    const timer = setInterval(() => {
      const j = state.journey;
      const c = current();
      if (!j || !c) return;
      const key = `${j.id}:${j.step}:${j.arrived}`;
      if (key !== seen) {
        seen = key;
        arrivedAt = performance.now();
      }
      const total = readMs(c.step.text);
      const progress = state.autoplay && j.arrived ? Math.min(1, (performance.now() - arrivedAt) / total) : 0;
      if (!state.autoplay || !j.arrived || document.hidden) return;
      if (progress >= 1) {
        if (c.last) actions.setAutoplay(false);
        else goToStep(ctx, j.id, j.step + 1);
      }
    }, 200);
    return () => clearInterval(timer);
  });

  const next = () => journeyNext(ctx);
  const back = () => journeyBack(ctx);
  const learnMore = () => {
    const c = current();
    if (!c) return;
    actions.setAutoplay(false);
    actions.select(c.step.languoid, { fly: false });
  };

  return (
    <Show when={current()}>
      {c => (
        <div class="caption glass" role="region" aria-label={`Journey: ${c().journey.title}`} aria-live="polite">
          <Show
            when={c().arrived}
            fallback={
              <div class="caption-travel">
                <span>Travelling to {formatYear(c().step.year, true)}…</span>
                <i class="caption-travel-bar" />
              </div>
            }
          >
            <div class="caption-body">
              <p class="caption-kicker">
                {c().journey.title} · {formatYear(c().step.year, true)}
              </p>
              <h3>
                {c().step.title}
                <ClaimMark status={claim()?.status} evidence={claim()?.evidence.length} />
              </h3>
              <p class="caption-text">{c().step.text}</p>
              <button class="caption-more" onClick={learnMore}>
                Learn more about {c().name} →
              </button>
            </div>
          </Show>

          <div class="card-nav">
            <IconButton icon="prev" label="Back" disabled={c().index === 0} onClick={back} />
            <div class="caption-dots" aria-hidden="true">
              <For each={c().journey.steps}>{(_, i) => <i class={{ on: i() === c().index, past: i() < c().index }} />}</For>
            </div>
            <IconButton icon="next" primary label={c().last ? "Finish" : "Next"} onClick={next} />
          </div>
          <div class="card-close">
            <IconButton icon="close" label="End journey" onClick={() => actions.endJourney()} />
          </div>
        </div>
      )}
    </Show>
  );
}
