import { For, Show, createMemo, onSettled } from "solid-js";
import { useAtlas, type AtlasContextValue } from "../state/atlas.tsx";
import { tweenYear } from "../lib/tween.ts";
import { formatYear } from "../lib/years.ts";
import { ClaimMark } from "../panel/LanguagePanel.tsx";

const STEP_SECONDS = 14;

/** Moves a journey to `step`: sweeps the year and flies to the languoid. Event-handler / timer context only. */
export function goToStep(ctx: AtlasContextValue, journeyId: string, step: number) {
  const j = ctx.atlas.journeys.find(x => x.id === journeyId);
  if (!j) return;
  const s = j.steps[step];
  if (!s) {
    ctx.actions.endJourney();
    return;
  }
  if (step === 0) ctx.actions.startJourney(journeyId);
  else ctx.actions.journeyStep(step);
  ctx.actions.play(false);
  ctx.actions.select(s.languoid, { fly: true });
  void tweenYear(ctx.state.year, s.year, ctx.actions.setYear, 2400, ctx.reducedMotion);
}

export function JourneyList() {
  const ctx = useAtlas();
  const { atlas, state, actions } = ctx;
  return (
    <Show when={state.journeysOpen}>
      <div class="overlay" onClick={() => actions.openJourneys(false)}>
        <div class="journeys glass" role="dialog" aria-label="Journeys" onClick={e => e.stopPropagation()}>
          <h2>Journeys</h2>
          <p class="muted">Guided tours through time. Each step is sourced and fact-checked.</p>
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
    return { journey, step: journey.steps[j.step], index: j.step };
  });

  // auto-advance; any manual navigation resets the timer
  onSettled(() => {
    let last = performance.now();
    let seenStep = -1;
    const timer = setInterval(() => {
      const j = state.journey;
      if (!j) return;
      if (j.step !== seenStep) {
        seenStep = j.step;
        last = performance.now();
      } else if (performance.now() - last > STEP_SECONDS * 1000 && !document.hidden) {
        goToStep(ctx, j.id, j.step + 1);
      }
    }, 500);
    return () => clearInterval(timer);
  });

  return (
    <Show when={current()}>
      {c => (
        <div class="caption glass" role="region" aria-label="Journey" aria-live="polite">
          <div class="caption-top">
            <span class="caption-journey">{c().journey.title}</span>
            <span class="caption-count">
              {c().index + 1} / {c().journey.steps.length}
            </span>
          </div>
          <h3>
            {c().step.title}
            <ClaimMark status={atlas.journeyClaims.get(`${c().journey.id}#step:${c().index}`)?.status} evidence={atlas.journeyClaims.get(`${c().journey.id}#step:${c().index}`)?.evidence.length} />
          </h3>
          <p>{c().step.text}</p>
          <div class="caption-nav">
            <button disabled={c().index === 0} onClick={() => goToStep(ctx, c().journey.id, c().index - 1)}>
              ← Back
            </button>
            <div class="caption-dots">
              <For each={c().journey.steps}>{(_, i) => <i class={{ on: i() === c().index, past: i() < c().index }} />}</For>
            </div>
            <Show
              when={c().index < c().journey.steps.length - 1}
              fallback={<button onClick={() => actions.endJourney()}>Finish</button>}
            >
              <button class="primary" onClick={() => goToStep(ctx, c().journey.id, c().index + 1)}>
                Next →
              </button>
            </Show>
          </div>
          <button class="caption-close" aria-label="End journey" onClick={() => actions.endJourney()}>
            ×
          </button>
        </div>
      )}
    </Show>
  );
}
