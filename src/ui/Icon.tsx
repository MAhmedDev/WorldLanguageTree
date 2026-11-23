import { For } from "solid-js";

/** A small, consistent stroke icon set (24×24, 1.6px strokes). Decorative unless given a label. */
const PATHS: Record<string, string[]> = {
  search: ["M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14z", "M20 20l-4.2-4.2"],
  story: ["M12 6.5C10 5 7 4.5 4 4.5v13c3 0 6 .5 8 2c2-1.5 5-2 8-2v-13c-3 0-6 .5-8 2z", "M12 6.5v13"],
  journeys: ["M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z", "M15.5 8.5l-2 5l-5 2l2-5z"],
  tree: ["M6 4a2 2 0 1 1 0 4a2 2 0 0 1 0-4z", "M18 4a2 2 0 1 1 0 4a2 2 0 0 1 0-4z", "M12 16a2 2 0 1 1 0 4a2 2 0 0 1 0-4z", "M6 8v1.5a2.5 2.5 0 0 0 2.5 2.5h7A2.5 2.5 0 0 0 18 9.5V8", "M12 12v4"],
  settings: ["M4 7h9", "M17 7h3", "M4 17h3", "M11 17h9", "M15 5a2 2 0 1 1 0 4a2 2 0 0 1 0-4z", "M9 15a2 2 0 1 1 0 4a2 2 0 0 1 0-4z"],
  info: ["M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z", "M12 11v5", "M12 7.6v.4"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  prev: ["M15 18l-6-6l6-6"],
  next: ["M9 6l6 6l-6 6"],
  sound: ["M4 9.5v5h3.5L12 18V6L7.5 9.5z", "M15.5 9a4 4 0 0 1 0 6", "M18 6.5a7.5 7.5 0 0 1 0 11"],
  narrator: ["M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3z", "M5.5 11.5a6.5 6.5 0 0 0 13 0", "M12 18v2.5"],
  autoplay: ["M4.5 12a7.5 7.5 0 1 0 2.2-5.3", "M4.5 4.5v3.8h3.8", "M10.5 9.5v5l4-2.5z"],
  speed: ["M4 17.5a8.5 8.5 0 1 1 16 0", "M12 14l3.5-4"],
  "skip-next": ["M6 6.5l8 5.5l-8 5.5z", "M17.5 6.5v11"],
  "skip-prev": ["M18 6.5l-8 5.5l8 5.5z", "M6.5 6.5v11"],
  mute: ["M4 9.5v5h3.5L12 18V6L7.5 9.5z", "M16 9.5l5 5", "M21 9.5l-5 5"],
  expand: ["M14 4h6v6", "M10 20H4v-6", "M20 4l-6 6", "M4 20l6-6"]
};

export function Icon(props: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <For each={PATHS[props.name] ?? []}>{d => <path d={d} />}</For>
    </svg>
  );
}

/** Round icon button with a tooltip; `label` is also the accessible name. */
export function IconButton(props: { icon: string; label: string; on?: boolean; primary?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      class={["icon-btn", { on: !!props.on, primary: !!props.primary }]}
      aria-label={props.label}
      aria-pressed={props.on === undefined ? undefined : props.on ? "true" : "false"}
      data-tip={props.label}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      <Icon name={props.icon} />
    </button>
  );
}
