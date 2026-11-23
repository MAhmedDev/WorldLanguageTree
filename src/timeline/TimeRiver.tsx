import { For, Show, createMemo } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { storyBack, storyJumpToYear, storyNext, storyPlayPause } from "../story/StoryMode.tsx";
import { IconButton } from "../ui/Icon.tsx";
import { ERAS, createTimeScale, eraOf, formatYear } from "../lib/years.ts";
import { aliveAt } from "../data/model.ts";

const SAMPLES = 220;
const TICKS = [-3000, -2000, -1000, 1, 500, 1000, 1500, 1800, 1900, 2000];

export function TimeRiver() {
  const ctx = useAtlas();
  const { atlas, state, actions, epoch } = ctx;
  const playing = () => !!state.story && state.autoplay;
  const scale = createTimeScale(atlas.minYear);
  let track: HTMLDivElement | undefined;

  // languages in the atlas alive at each sampled point (orientation only)
  const density = (() => {
    const nodes = [...atlas.nodes.values()].filter(n => n.l.kind !== "group");
    const counts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const y = scale.toYear(i / SAMPLES);
      return nodes.filter(n => aliveAt(n, y)).length;
    });
    const max = Math.max(1, ...counts);
    const pts = counts.map((c, i) => `${((i / SAMPLES) * 1000).toFixed(1)},${(40 - (c / max) * 34).toFixed(1)}`);
    return `M0,40 L${pts.join(" L")} L1000,40 Z`;
  })();

  const pos = createMemo(() => scale.toPos(state.year));
  const aliveCount = createMemo(() => {
    let n = 0;
    const y = epoch();
    for (const node of atlas.nodes.values()) if (node.l.kind !== "group" && aliveAt(node, y)) n++;
    return n;
  });
  const span = createMemo(() => {
    const n = state.selected ? atlas.nodes.get(state.selected) : undefined;
    if (!n || !Number.isFinite(n.from)) return null;
    return { a: scale.toPos(n.from), b: scale.toPos(n.to ?? scale.max), color: atlas.colors.get(n.rootId) ?? "#e8c170" };
  });

  const yearAt = (clientX: number) => {
    const r = track!.getBoundingClientRect();
    return scale.toYear((clientX - r.left) / r.width);
  };
  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    actions.setAutoplay(false);
    actions.setYear(yearAt(e.clientX));
  };
  // letting go: if a story is open it catches up with the chosen moment
  const onPointerUp = (e: PointerEvent) => {
    if (state.story) storyJumpToYear(ctx, yearAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) actions.setYear(yearAt(e.clientX));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    if (e.key === "ArrowRight") actions.setYear(scale.toYear(scale.toPos(state.year) + step));
    else if (e.key === "ArrowLeft") actions.setYear(scale.toYear(scale.toPos(state.year) - step));
    else if (e.key === "Home") actions.setYear(scale.min);
    else if (e.key === "End") actions.setYear(scale.max);
    else return;
    e.preventDefault();
  };

  return (
    <section class="river glass" aria-label="Timeline">
      <div class="river-head">
        <div class="transport">
          <IconButton icon="skip-prev" label="Previous" onClick={() => (state.story ? storyBack(ctx) : storyJumpToYear(ctx, state.year))} />
          <button class="river-play" aria-label={playing() ? "Pause the story" : "Play the story"} onClick={() => storyPlayPause(ctx)}>
            <Show when={playing()} fallback={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              </svg>
            </Show>
          </button>
          <IconButton icon="skip-next" label="Next" onClick={() => (state.story ? storyNext(ctx) : storyJumpToYear(ctx, state.year))} />
          <div class="volume">
            <IconButton
              icon={state.muted || state.volume === 0 ? "mute" : "sound"}
              label={state.muted ? "Unmute" : "Mute"}
              onClick={() => actions.toggleMute()}
            />
            <input
              class="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              aria-label="Volume"
              value={state.muted ? 0 : state.volume}
              onInput={e => actions.setVolume(Number(e.currentTarget.value))}
            />
          </div>
        </div>
        <div class="river-year">
          <span class="river-year-num">{formatYear(state.year)}</span>
          <span class="river-era">
            {eraOf(state.year)} · {aliveCount()} languages in view
          </span>
        </div>
      </div>
      <div
        class="river-track"
        ref={el => (track = el)}
        role="slider"
        tabindex="0"
        aria-valuemin={scale.min}
        aria-valuemax={scale.max}
        aria-valuenow={state.year}
        aria-valuetext={formatYear(state.year)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKey}
      >
        <svg class="river-density" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="riverFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#e8c170" stop-opacity="0.55" />
              <stop offset="1" stop-color="#e8c170" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <path d={density} fill="url(#riverFill)" />
        </svg>
        <For each={ERAS}>
          {era => {
            const a = Math.max(0, scale.toPos(era.from));
            const b = Math.min(1, scale.toPos(era.to));
            return (
              <div class="river-era-band" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}>
                <span>{era.label}</span>
              </div>
            );
          }}
        </For>
        <For each={TICKS}>
          {t => (
            <span class={["river-tick", { minor: [-2000, 500, 1800, 1900].includes(t) }]} style={{ left: `${scale.toPos(t) * 100}%` }}>
              {t === 1 ? "1 CE" : t < 0 ? `${-t} BCE` : t}
            </span>
          )}
        </For>
        <Show when={span()}>
          {s => <div class="river-span" style={{ left: `${s().a * 100}%`, width: `${Math.max(0.3, (s().b - s().a) * 100)}%`, background: s().color }} />}
        </Show>
        <div class="river-progress" style={{ width: `${pos() * 100}%` }} />
        <div class="river-handle" style={{ left: `${pos() * 100}%` }} />
      </div>
    </section>
  );
}
