import { For, Show, createMemo, onSettled } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { ERAS, createTimeScale, eraOf, formatYear } from "../lib/years.ts";
import { aliveAt } from "../data/model.ts";

/** Seconds to cross the entire river at 1× speed. */
const CROSSING_SECONDS = 110;
const SAMPLES = 220;
const TICKS = [-3000, -2000, -1000, 1, 500, 1000, 1500, 1800, 1900, 2000];

export function TimeRiver() {
  const { atlas, state, actions } = useAtlas();
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
    for (const node of atlas.nodes.values()) if (node.l.kind !== "group" && aliveAt(node, state.year)) n++;
    return n;
  });
  const span = createMemo(() => {
    const n = state.selected ? atlas.nodes.get(state.selected) : undefined;
    if (!n || !Number.isFinite(n.from)) return null;
    return { a: scale.toPos(n.from), b: scale.toPos(n.to ?? scale.max), color: atlas.colors.get(n.rootId) ?? "#e8c170" };
  });

  // playback loop
  onSettled(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (state.playing) {
        const p = scale.toPos(state.year) + dt / CROSSING_SECONDS;
        if (p >= 1) {
          actions.setYear(scale.max);
          actions.play(false);
        } else actions.setYear(scale.toYear(p));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const yearAt = (clientX: number) => {
    const r = track!.getBoundingClientRect();
    return scale.toYear((clientX - r.left) / r.width);
  };
  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    actions.play(false);
    actions.setYear(yearAt(e.clientX));
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
        <button
          class="river-play"
          aria-label={state.playing ? "Pause" : "Play through time"}
          onClick={() => {
            if (!state.playing && scale.toPos(state.year) >= 0.999) actions.setYear(-3400);
            actions.play();
          }}
        >
          <Show when={state.playing} fallback={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          </Show>
        </button>
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
