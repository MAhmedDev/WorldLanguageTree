import { Show, createSignal, onSettled } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { Icon, IconButton } from "./Icon.tsx";

/** Everything that is a preference lives here, out of sight until asked for. */
export function Settings() {
  const { state, actions } = useAtlas();
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  onSettled(() => {
    const onDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  });

  const Row = (p: { icon: string; label: string; hint: string; on: boolean; toggle: () => void }) => (
    <button class="set-row" role="switch" aria-checked={p.on ? "true" : "false"} onClick={() => p.toggle()}>
      <Icon name={p.icon} />
      <span class="set-text">
        <span>{p.label}</span>
        <small>{p.hint}</small>
      </span>
      <i class={["switch", { on: p.on }]} />
    </button>
  );

  return (
    <div class="settings" ref={el => (root = el)}>
      <IconButton icon="settings" label="Settings" on={open()} onClick={() => setOpen(o => !o)} />
      <Show when={open()}>
        <div class="settings-pop glass" role="menu">
          <Row icon="sound" label="Ambient sound" hint="A soft drone in the background" on={state.sound} toggle={() => actions.toggleSound()} />
          <Row icon="narrator" label="Narrator" hint="Read the story aloud" on={state.voice} toggle={() => actions.toggleVoice()} />
          <Row icon="tree" label="Family tree" hint="Show how languages branch over time" on={state.treeOpen} toggle={() => actions.toggleTree()} />
          <hr />
          <button
            class="set-row"
            onClick={() => {
              setOpen(false);
              actions.openJourneys(true);
            }}
          >
            <Icon name="journeys" />
            <span class="set-text">
              <span>Themed journeys</span>
              <small>Short tours: writing, Latin, Austronesia…</small>
            </span>
          </button>
          <hr />
          <button
            class="set-row"
            onClick={() => {
              setOpen(false);
              actions.openAbout(true);
            }}
          >
            <Icon name="info" />
            <span class="set-text">
              <span>About &amp; method</span>
              <small>Sources, fact-checking, credits</small>
            </span>
          </button>
        </div>
      </Show>
    </div>
  );
}
