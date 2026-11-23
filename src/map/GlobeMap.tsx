import { createEffect, createMemo, createSignal, onSettled } from "solid-js";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useAtlas } from "../state/atlas.tsx";
import { aliveAt } from "../data/model.ts";
import { buildStyle } from "./style.ts";
import { fontFor } from "../lib/scripts.ts";

const INTERACTIVE = ["presence-core", "presence-glow"];
maplibregl.setWorkerUrl(workerUrl);

export function GlobeMap() {
  const { atlas, state, actions, reducedMotion } = useAtlas();
  const [map, setMap] = createSignal<maplibregl.Map | null>(null, { ownedWrite: true });
  const [zoom, setZoom] = createSignal(1.6);
  let container: HTMLDivElement | undefined;
  let stopIdle = () => {};
  /** plain mirror of state.playing for the rAF loop */
  let playing = false;

  onSettled(() => {
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: buildStyle(atlas, state.year),
      center: [35, 28],
      zoom: window.innerWidth < 700 ? 1.0 : 1.9,
      minZoom: 0.6,
      maxZoom: 8,
      attributionControl: { compact: true, customAttribution: "Natural Earth · Glottolog (CC-BY 4.0)" },
      renderWorldCopies: false,
      fadeDuration: 0
    });
    m.dragRotate.disable();
    m.touchZoomRotate.disableRotation();

    let idleSince = performance.now();
    let userActive = false;
    const markActive = () => {
      userActive = true;
      idleSince = performance.now();
    };
    m.on("mousedown", markActive);
    m.on("touchstart", markActive);
    m.on("wheel", markActive);
    m.on("dragend", () => {
      userActive = false;
      idleSince = performance.now();
    });
    m.on("zoom", () => setZoom(m.getZoom()));
    m.on("move", () => declutter());

    m.on("load", () => setMap(m));

    m.on("click", (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: INTERACTIVE })[0];
      if (f) actions.visit(String(f.properties.languoid));
    });
    m.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: INTERACTIVE })[0];
      m.getCanvas().style.cursor = f ? "pointer" : "";
      actions.hover(f ? String(f.properties.languoid) : null);
    });

    // slow ambient rotation while idle
    let raf = 0;
    let last = performance.now();
    const spin = (t: number) => {
      const dt = t - last;
      last = t;
      if (!reducedMotion && !playing && !userActive && !m.isMoving() && t - idleSince > 4000 && m.getZoom() < 3) {
        const c = m.getCenter();
        m.jumpTo({ center: [c.lng + dt * 0.0016, c.lat] });
      }
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    stopIdle = () => (idleSince = performance.now() + 60000);
    m.on("movestart", (e: { originalEvent?: Event }) => {
      if (e.originalEvent) markActive();
    });

    return () => {
      cancelAnimationFrame(raf);
      markers.clear();
      m.remove();
    };
  });

  createEffect(
    () => ({ m: map(), year: state.year }),
    ({ m, year }) => {
      m?.setGlobalStateProperty("year", year);
    }
  );
  createEffect(
    () => ({ m: map(), sel: state.selected ?? "", hov: state.hovered ?? "" }),
    ({ m, sel, hov }) => {
      m?.setGlobalStateProperty("selected", sel);
      m?.setGlobalStateProperty("hovered", hov);
    }
  );

  // While playing, drift the camera toward where languages are igniting right now.
  const recentCentre = createMemo(() => {
    if (!state.playing || state.selected) return null;
    const y = state.year;
    const window = y < -1000 ? 400 : y < 1000 ? 250 : 150;
    const pts = atlas.presence.filter(p => p.from <= y && p.from > y - window && p.kind !== "current");
    if (!pts.length) return null;
    let x = 0;
    let yy = 0;
    let z = 0;
    for (const p of pts) {
      const la = (p.lat * Math.PI) / 180;
      const lo = (p.lng * Math.PI) / 180;
      x += Math.cos(la) * Math.cos(lo);
      yy += Math.cos(la) * Math.sin(lo);
      z += Math.sin(la);
    }
    const lng = (Math.atan2(yy, x) * 180) / Math.PI;
    const lat = (Math.atan2(z, Math.hypot(x, yy)) * 180) / Math.PI;
    // snapped to a 6° grid: the camera only retargets when the action moves noticeably
    const snap = (v: number) => Math.round(v / 6) * 6;
    return `${snap(lng)}|${snap(lat)}`;
  });
  createEffect(
    () => ({ m: map(), c: recentCentre(), on: state.playing }),
    ({ m, c, on }) => {
      playing = on;
      if (!m || !c || reducedMotion) return;
      const [lng, lat] = c.split("|").map(Number);
      m.easeTo({ center: [lng, Math.max(-50, Math.min(60, lat))], duration: 4000, easing: t => t * (2 - t) });
    }
  );

  // Camera: keep the globe centred in the space the docked tree and panel leave free,
  // and fly to the selection whenever it (or the focus tick) changes.
  let lastTick = -1;
  createEffect(
    () => {
      const wide = window.innerWidth > 860;
      const dock = wide && state.treeOpen && !state.treeExpanded ? Math.min(430, window.innerWidth * 0.34) + 20 : 0;
      const panel = wide && state.selected ? Math.min(460, window.innerWidth * 0.36) + 20 : 0;
      return { m: map(), tick: state.focusTick, id: state.selected, padding: { left: dock, right: panel, top: 60, bottom: 130 } };
    },
    ({ m, tick, id, padding }) => {
      if (!m) return;
      const point = id ? atlas.nodes.get(id)?.point : null;
      if (tick !== lastTick && point) {
        lastTick = tick;
        const target = { center: [point.lng, point.lat] as [number, number], zoom: Math.max(m.getZoom(), 3.1), padding };
        if (reducedMotion) m.jumpTo(target);
        else m.flyTo({ ...target, speed: 0.7, curve: 1.5, essential: false });
        stopIdle();
      } else m.easeTo({ padding, duration: reducedMotion ? 0 : 700 });
    }
  );

  // floating labels: languages alive in the current year, in their own script when known.
  // The memo yields a joined id string so playback only touches the DOM when the set changes.
  const labelKey = createMemo(() => {
    const y = state.year;
    const z = zoom();
    const sel = state.selected;
    const ids: string[] = [];
    for (const n of atlas.nodes.values()) {
      if (!n.point || !n.l.homeland) continue;
      const show = n.l.id === sel || (aliveAt(n, y) && (z > 2.6 || n.l.works.length > 0 || n.parent === null));
      if (show) ids.push(n.l.id);
    }
    return ids.join("|");
  });

  const markers = new Map<string, maplibregl.Marker>();

  /** Greedy screen-space declutter: higher-priority labels claim space first. */
  let selectedId: string | null = null;
  let hoveredId: string | null = null;
  const priority = (id: string) => {
    if (id === selectedId) return 1e9;
    if (id === hoveredId) return 1e8;
    const n = atlas.nodes.get(id)!;
    return n.l.works.length * 1000 + (n.parent ? 0 : 500) + n.l.story.length * 10 - n.depth;
  };
  let declutterQueued = false;
  const declutter = () => {
    if (declutterQueued) return;
    declutterQueued = true;
    requestAnimationFrame(() => {
      declutterQueued = false;
      const placed: DOMRect[] = [];
      const ids = [...markers.keys()].sort((a, b) => priority(b) - priority(a));
      for (const id of ids) {
        const el = markers.get(id)!.getElement();
        el.classList.remove("is-hidden");
        const r = el.getBoundingClientRect();
        const pad = 2;
        const hit = placed.some(p => r.left < p.right + pad && r.right > p.left - pad && r.top < p.bottom + pad && r.bottom > p.top - pad);
        if (hit && id !== selectedId) el.classList.add("is-hidden");
        else if (r.width) placed.push(r);
      }
    });
  };
  const makeMarker = (id: string, m: maplibregl.Map) => {
    const n = atlas.nodes.get(id)!;
    const el = document.createElement("button");
    el.className = "map-label" + (n.l.kind === "proto" ? " is-proto" : "");
    el.style.setProperty("--c", atlas.colors.get(n.rootId) ?? "#e8c170");
    const name = document.createElement("span");
    name.className = "map-label-name";
    name.textContent = n.l.name;
    el.appendChild(name);
    if (n.l.nativeName && n.l.nativeName !== n.l.name) {
      const nat = document.createElement("span");
      nat.className = "map-label-native";
      nat.style.fontFamily = fontFor(n.l.nativeScript);
      nat.textContent = n.l.nativeName;
      el.appendChild(nat);
    }
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      actions.visit(id);
    });
    el.addEventListener("mouseenter", () => actions.hover(id));
    el.addEventListener("mouseleave", () => actions.hover(null));
    return new maplibregl.Marker({ element: el, anchor: "top", offset: [0, 8], opacityWhenCovered: "0" })
      .setLngLat([n.l.homeland!.lng, n.l.homeland!.lat])
      .addTo(m);
  };

  createEffect(
    () => ({ m: map(), key: labelKey() }),
    ({ m, key }) => {
      if (!m) return;
      const want = new Set(key ? key.split("|") : []);
      for (const [id, mk] of markers)
        if (!want.has(id)) {
          mk.remove();
          markers.delete(id);
        }
      for (const id of want) if (!markers.has(id)) markers.set(id, makeMarker(id, m));
      declutter();
    }
  );
  createEffect(
    () => ({ key: labelKey(), sel: state.selected, hov: state.hovered }),
    ({ sel, hov }) => {
      selectedId = sel;
      hoveredId = hov;
      declutter();
      for (const [id, mk] of markers) {
        const el = mk.getElement();
        el.classList.toggle("is-selected", id === sel);
        el.classList.toggle("is-hovered", id === hov);
      }
    }
  );

  return <div class="globe" ref={el => (container = el)} aria-label="Globe of the world's languages" />;
}
