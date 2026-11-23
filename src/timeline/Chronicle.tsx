import { Show, createMemo, createSignal, onSettled } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { formatYear } from "../lib/years.ts";

interface ChronicleEvent {
  year: number;
  approx: boolean;
  languoid: string;
  title: string;
  text: string;
}

/**
 * Narrates the most recent event as time flows: a language appearing, or a
 * dated written record. All text comes straight from sourced data.
 */
export function Chronicle() {
  const { atlas, state, actions } = useAtlas();

  const events: ChronicleEvent[] = [];
  for (const n of atlas.nodes.values()) {
    const l = n.l;
    if (l.period && l.kind !== "group")
      events.push({
        year: l.period.from,
        approx: l.period.approx,
        languoid: l.id,
        title: l.kind === "proto" ? `${l.name} · reconstructed` : l.name,
        text: l.homeland ? l.homeland.label : ""
      });
    for (const a of l.attestations) events.push({ year: a.year, approx: a.approx, languoid: l.id, title: `${l.name} · ${a.place}`, text: a.description });
  }
  events.sort((a, b) => a.year - b.year);

  const current = createMemo(() => {
    const y = state.year;
    // binary search for the last event at or before y
    let lo = 0;
    let hi = events.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].year <= y) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (idx < 0) return null;
    const e = events[idx];
    // only while it is recent, scaled to how dense the era is
    const window = y < -1000 ? 500 : y < 1000 ? 250 : 120;
    return y - e.year <= window ? e : null;
  });

  // Hold each event long enough to read; then show whatever is current.
  const DWELL_MS = 4500;
  const [shown, setShown] = createSignal<ChronicleEvent | null>(null, { ownedWrite: true });
  onSettled(() => {
    let shownAt = 0;
    const timer = setInterval(() => {
      const next = current();
      const now = performance.now();
      if (next !== shown() && (now - shownAt > DWELL_MS || shown() === null || next === null)) {
        setShown(next);
        shownAt = now;
      }
    }, 250);
    return () => clearInterval(timer);
  });

  return (
    <Show when={!state.journey && !state.selected && shown()} keyed>
      {e => (
        <button class="chronicle glass" onClick={() => actions.visit(e.languoid)}>
          <span class="chronicle-year">{formatYear(e.year, e.approx)}</span>
          <span class="chronicle-title" style={{ "--c": atlas.colors.get(atlas.nodes.get(e.languoid)?.rootId ?? "") ?? "#e8c170" }}>
            {e.title}
          </span>
          <Show when={e.text}>
            <span class="chronicle-text">{e.text}</span>
          </Show>
        </button>
      )}
    </Show>
  );
}
