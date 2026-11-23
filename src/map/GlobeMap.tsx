import { createEffect, createMemo, createSignal, onSettled } from "solid-js";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useAtlas } from "../state/atlas.tsx";
import { aliveAt, ancestors } from "../data/model.ts";
import { buildStyle } from "./style.ts";
import { fontFor } from "../lib/scripts.ts";

const INTERACTIVE = ["presence-core", "presence-glow"];
maplibregl.setWorkerUrl(workerUrl);

export function GlobeMap() {
  const { atlas, state, actions, reducedMotion, epoch } = useAtlas();
  const [map, setMap] = createSignal<maplibregl.Map | null>(null, { ownedWrite: true });
  const [zoom, setZoom] = createSignal(1.6);
  let container: HTMLDivElement | undefined;
  let stopIdle = () => {};
  /** plain mirror: a guided mode (story or journey) owns the camera */
  let guided = false;

  onSettled(() => {
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: buildStyle(atlas),
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
      // the reader took the wheel: autoplay steps aside
      actions.setAutoplay(false);
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
    m.on("moveend", () => declutter(true));

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
      if (!reducedMotion && !guided && !userActive && !m.isMoving() && t - idleSince > 4000 && m.getZoom() < 3) {
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

  // ---- feature-state sync: only features whose state changed are touched -------------
  const P = atlas.presence;
  const A = atlas.arcs;
  type Flags = { b: number; al: number; age: number; sel: number; hov: number; foc: number; rec: number };
  const fresh = (): Flags => ({ b: -1, al: -1, age: -1, sel: 0, hov: 0, foc: 0, rec: 0 });
  const pState = P.map(fresh);
  const aState = A.map(fresh);
  /** age stepped finely while a language "ignites", coarsely afterwards: identical look, far fewer updates */
  const stepAge = (a: number) => (a < 200 ? Math.floor(a / 10) * 10 : a < 2000 ? 200 + Math.floor((a - 200) / 300) * 300 : 2000);
  const put = (m: maplibregl.Map, source: string, id: number, cur: Flags, next: Partial<Flags>) => {
    let diff: Partial<Flags> | null = null;
    for (const k in next) {
      const key = k as keyof Flags;
      if (cur[key] !== next[key]) {
        (diff ??= {})[key] = next[key];
        cur[key] = next[key]!;
      }
    }
    if (diff) m.setFeatureState({ source, id }, diff);
  };
  const syncYear = (m: maplibregl.Map, y: number) => {
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const b = y >= p.from ? 1 : 0;
      put(m, "presence", i, pState[i], { b, al: y <= p.to ? 1 : 0, age: b ? stepAge(y - p.from) : 0 });
    }
    for (let i = 0; i < A.length; i++) {
      const b = y >= A[i].from ? 1 : 0;
      put(m, "arcs", i, aState[i], { b, age: b ? stepAge(y - A[i].from) : 0 });
    }
  };
  const syncFlags = (m: maplibregl.Map, sel: string, hov: string, spot: Set<string>) => {
    const on = spot.size > 0;
    const flags = (languoid: string) => ({
      sel: languoid === sel ? 1 : 0,
      hov: languoid === hov ? 1 : 0,
      foc: on && spot.has(languoid) ? 1 : 0,
      rec: on && !spot.has(languoid) ? 1 : 0
    });
    for (let i = 0; i < P.length; i++) put(m, "presence", i, pState[i], flags(P[i].languoid));
    for (let i = 0; i < A.length; i++) put(m, "arcs", i, aState[i], flags(A[i].languoid));
  };

  // year → map, coalesced to one sync per animation frame
  let pendingYear: number | null = null;
  createEffect(
    () => ({ m: map(), year: state.year }),
    ({ m, year }) => {
      if (!m) return;
      if (pendingYear === null)
        requestAnimationFrame(() => {
          if (pendingYear !== null) syncYear(m, pendingYear);
          pendingYear = null;
        });
      pendingYear = year;
    }
  );

  // selection, hover and the guided-mode spotlight (everything else recedes)
  createEffect(
    () => ({
      m: map(),
      sel: state.selected ?? "",
      hov: state.hovered ?? "",
      on: !!(state.story || state.journey),
      ids: [...state.spotlight]
    }),
    ({ m, sel, hov, on, ids }) => {
      guided = on;
      if (!m) return;
      // guided modes spotlight their languoids; otherwise a selection lights its path to the roots
      const spot = on ? ids : sel ? [sel, ...ancestors(atlas, sel).map(a => a.l.id)] : [];
      syncFlags(m, sel, hov, new Set(spot));
    }
  );

  // Camera: keep the globe centred in the space the docked tree and panel leave free,
  // and fly to the selection whenever it (or the focus tick) changes.
  let lastTick = -1;
  createEffect(
    () => {
      const wide = window.innerWidth > 860;
      const dock = wide && state.treeOpen && !state.treeExpanded ? Math.min(430, window.innerWidth * 0.34) + 20 : 0;
      const isGuided = !!(state.story || state.journey);
      const panel = wide && state.selected ? Math.min(460, window.innerWidth * 0.36) + 20 : 0;
      // guided modes keep the tree out of the way and a caption card at the bottom
      const left = dock;
      const bottom = isGuided ? (wide ? 330 : 360) : 130;
      return {
        m: map(),
        tick: state.focusTick,
        id: state.selected,
        spot: [...state.spotlight],
        isGuided,
        padding: { left, right: panel, top: 70, bottom }
      };
    },
    ({ m, tick, id, spot, isGuided, padding }) => {
      if (!m) return;
      if (tick === lastTick) {
        m.easeTo({ padding, duration: reducedMotion ? 0 : 700 });
        return;
      }
      lastTick = tick;
      const duration = reducedMotion ? 0 : isGuided ? 2800 : undefined;
      const point = id ? atlas.nodes.get(id)?.point : null;
      if (point || spot.length || isGuided) stopIdle();
      if (point) {
        const target = { center: [point.lng, point.lat] as [number, number], zoom: Math.max(m.getZoom(), 3.1), padding };
        if (reducedMotion) m.jumpTo(target);
        else m.flyTo({ ...target, speed: 0.7, curve: 1.5, essential: false });
        return;
      }
      const pts = spot.map(s => atlas.nodes.get(s)?.point).filter((p): p is { lat: number; lng: number } => !!p);
      if (pts.length === 1) {
        m.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 3.3, padding, duration, essential: true });
      } else if (pts.length > 1) {
        const lngs = pts.map(p => p.lng);
        const lats = pts.map(p => p.lat);
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ];
        m.fitBounds(bounds, { padding: { ...padding, left: padding.left + 80, right: padding.right + 80, top: padding.top + 60 }, maxZoom: 3.6, duration, essential: true });
      } else if (isGuided) {
        // a chapter opening: pull back to see the whole world
        m.easeTo({ zoom: window.innerWidth < 700 ? 1.0 : 1.7, padding, duration: duration ?? 2000 });
      }
    }
  );

  // floating labels: languages alive in the current year, in their own script when known.
  // The memo yields a joined id string so playback only touches the DOM when the set changes.
  const zoomedIn = createMemo(() => zoom() > 2.6);
  const labelKey = createMemo(() => {
    const y = epoch();
    const close = zoomedIn();
    const sel = state.selected;
    const ids: string[] = [];
    // in a guided mode only the spotlight speaks
    if (state.story || state.journey) {
      // labels sit at a homeland; branches (groups) have none, so they are never labelled
      const placeable = (id: string) => !!atlas.nodes.get(id)?.l.homeland;
      for (const id of state.spotlight) if (placeable(id)) ids.push(id);
      if (sel && placeable(sel) && !ids.includes(sel)) ids.push(sel);
      return ids.join("|");
    }
    for (const n of atlas.nodes.values()) {
      if (!n.point || !n.l.homeland) continue;
      const show = n.l.id === sel || (aliveAt(n, y) && (close || n.l.works.length > 0 || n.parent === null));
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
  // Batched: all reads first (one layout flush), then only the class changes that are needed.
  // While the globe moves it runs at most every 150 ms; markers move as a group, so overlaps
  // barely change between passes.
  let declutterQueued = false;
  let lastDeclutter = 0;
  const hidden = new Set<string>();
  const declutter = (force = false) => {
    if (declutterQueued) return;
    const wait = force ? 0 : Math.max(0, 150 - (performance.now() - lastDeclutter));
    declutterQueued = true;
    setTimeout(
      () =>
        requestAnimationFrame(() => {
          declutterQueued = false;
          lastDeclutter = performance.now();
          const ids = [...markers.keys()].sort((x, y) => priority(y) - priority(x));
          const rects = ids.map(id => markers.get(id)!.getElement().getBoundingClientRect());
          const placed: DOMRect[] = [];
          const pad = 2;
          const nextHidden = new Set<string>();
          ids.forEach((id, i) => {
            const r = rects[i];
            const hit = placed.some(p => r.left < p.right + pad && r.right > p.left - pad && r.top < p.bottom + pad && r.bottom > p.top - pad);
            if (hit && id !== selectedId) nextHidden.add(id);
            else if (r.width) placed.push(r);
          });
          for (const id of ids) {
            const want = nextHidden.has(id);
            if (want !== hidden.has(id)) markers.get(id)!.getElement().classList.toggle("is-hidden", want);
          }
          hidden.clear();
          for (const id of nextHidden) hidden.add(id);
        }),
      wait
    );
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
          hidden.delete(id);
        }
      for (const id of want) if (!markers.has(id)) markers.set(id, makeMarker(id, m));
      declutter(true);
    }
  );
  createEffect(
    () => ({ key: labelKey(), sel: state.selected, hov: state.hovered }),
    ({ sel, hov }) => {
      selectedId = sel;
      hoveredId = hov;
      declutter(true);
      for (const [id, mk] of markers) {
        const el = mk.getElement();
        el.classList.toggle("is-selected", id === sel);
        el.classList.toggle("is-hovered", id === hov);
      }
    }
  );

  return <div class="globe" ref={el => (container = el)} aria-label="Globe of the world's languages" />;
}
