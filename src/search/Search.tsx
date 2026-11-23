import { For, Show, createMemo, createSignal } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";
import { search, type SearchItem } from "../lib/search.ts";
import { formatRange } from "../lib/years.ts";
import { fontFor } from "../lib/scripts.ts";
import { Icon } from "../ui/Icon.tsx";

export function Search(props: { inputRef?: (el: HTMLInputElement) => void }) {
  const { atlas, actions } = useAtlas();
  const items: SearchItem[] = [...atlas.nodes.values()].map(n => ({
    id: n.l.id,
    terms: [n.l.name, n.l.nativeName ?? "", n.l.id.replace(/-/g, " "), n.l.iso639_3 ?? "", ...n.l.works.map(w => w.title)]
  }));
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const results = createMemo(() => (query().trim() ? search(query(), items, 8) : []));

  const choose = (id: string, input?: HTMLInputElement) => {
    actions.visit(id);
    setQuery("");
    setOpen(false);
    input?.blur();
  };

  let input: HTMLInputElement | undefined;
  const [focused, setFocused] = createSignal(false);
  return (
    <div class={["search", { open: focused() || !!query() }]} role="search">
      <button class="icon-btn search-toggle" aria-label="Search languages (/)" data-tip="Search  /" onClick={() => input?.focus()}>
        <Icon name="search" />
      </button>
      <input
        ref={el => {
          input = el;
          props.inputRef?.(el);
        }}
        type="search"
        placeholder="Languages, works…"
        aria-label="Search languages"
        aria-autocomplete="list"
        aria-expanded={open() && results().length > 0 ? "true" : "false"}
        value={query()}
        onInput={e => {
          setQuery(e.currentTarget.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={e => {
          const list = results();
          if (e.key === "ArrowDown") {
            setActive(a => Math.min(list.length - 1, a + 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setActive(a => Math.max(0, a - 1));
            e.preventDefault();
          } else if (e.key === "Enter" && list.length) choose(list[Math.min(active(), list.length - 1)], e.currentTarget);
          else if (e.key === "Escape") {
            setQuery("");
            e.currentTarget.blur();
          }
        }}
      />
      <Show when={open() && results().length > 0}>
        <ul class="search-results glass" role="listbox">
          <For each={results()}>
            {(id, i) => {
              const n = atlas.nodes.get(id)!;
              return (
                <li
                  role="option"
                  aria-selected={i() === active() ? "true" : "false"}
                  class={{ active: i() === active() }}
                  onMouseDown={e => {
                    e.preventDefault();
                    choose(id);
                  }}
                  onMouseEnter={() => setActive(i())}
                >
                  <i class="dot" style={{ background: atlas.colors.get(n.rootId) }} />
                  <span class="sr-name">{n.l.name}</span>
                  <Show when={n.l.nativeName}>
                    <span class="sr-native" style={{ "font-family": fontFor(n.l.nativeScript) }}>
                      {n.l.nativeName}
                    </span>
                  </Show>
                  <span class="sr-date">{Number.isFinite(n.from) ? formatRange(n.from, n.to, n.l.period?.approx ?? true) : ""}</span>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </div>
  );
}
