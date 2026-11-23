import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { cluster, hierarchy, type HierarchyPointNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { useAtlas } from "../state/atlas.tsx";
import { ancestors, type Atlas } from "../data/model.ts";
import { createTimeScale, formatYear } from "../lib/years.ts";

interface TreeDatum {
  id: string;
  children: TreeDatum[];
}

interface LaidOut {
  id: string;
  angle: number;
  r: number;
  x: number;
  y: number;
  parent: string | null;
  color: string;
  name: string;
  kind: string;
  from: number;
  to: number | null;
  /** internal node with a single child: a stage in a chain, labelled only on focus */
  stage: boolean;
}

const INNER = 40;

/**
 * Radial "tree of time": angle comes from the family tree layout, radius from
 * the date a languoid emerged (deep past at the centre, today at the rim).
 * Families are separate sectors; nothing connects them, because no common
 * ancestor is established.
 */
function layoutTree(atlas: Atlas, radius: number) {
  const scale = createTimeScale(atlas.minYear);
  const build = (id: string): TreeDatum => ({ id, children: atlas.nodes.get(id)!.children.map(build) });
  const root = hierarchy<TreeDatum>({ id: "__root__", children: atlas.roots.map(build) });
  const laid = cluster<TreeDatum>()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.6))(root);
  const out: LaidOut[] = [];
  laid.each((d: HierarchyPointNode<TreeDatum>) => {
    if (d.data.id === "__root__") return;
    const n = atlas.nodes.get(d.data.id)!;
    const t = Number.isFinite(n.from) ? scale.toPos(n.from) : 0;
    const r = INNER + t * (radius - INNER);
    out.push({
      id: n.l.id,
      angle: d.x,
      r,
      x: r * Math.sin(d.x),
      y: -r * Math.cos(d.x),
      parent: d.parent && d.parent.data.id !== "__root__" ? d.parent.data.id : null,
      color: atlas.colors.get(n.rootId) ?? "#e8c170",
      name: n.l.name,
      kind: n.l.kind,
      from: n.from,
      to: n.to,
      stage: n.children.length === 1
    });
  });
  const byId = new Map(out.map(o => [o.id, o]));
  const links = out
    .filter(o => o.parent)
    .map(o => {
      const p = byId.get(o.parent!)!;
      // arc along the parent's radius, then out to the child (radial elbow)
      const a0 = p.angle;
      const a1 = o.angle;
      const ex = p.r * Math.sin(a1);
      const ey = -p.r * Math.cos(a1);
      const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
      const sweep = a1 > a0 ? 1 : 0;
      const d = `M${p.x.toFixed(1)},${p.y.toFixed(1)} A${p.r.toFixed(1)},${p.r.toFixed(1)} 0 ${large} ${sweep} ${ex.toFixed(1)},${ey.toFixed(1)} L${o.x.toFixed(1)},${o.y.toFixed(1)}`;
      return { id: o.id, parent: p.id, d, color: o.color, from: o.from };
    });
  const rings = [-3400, -1200, 500, 1500, 1900].filter(y => y > scale.min).map(y => ({ y, r: INNER + scale.toPos(y) * (radius - INNER) }));
  return { nodes: out, links, byId, rings, scale };
}

export function LanguageTree() {
  const { atlas, state, actions, reducedMotion } = useAtlas();
  const leaves = [...atlas.nodes.values()].filter(n => n.children.length === 0).length;
  const radius = Math.max(260, (leaves * 13) / (2 * Math.PI));
  const tree = layoutTree(atlas, radius);
  const [transform, setTransform] = createSignal<ZoomTransform>(zoomIdentity, { ownedWrite: true });
  let svg: SVGSVGElement | undefined;
  let behavior: ZoomBehavior<SVGSVGElement, unknown> | undefined;
  /** plain mirror of the zoom level for imperative code (effects must not read the signal untracked) */
  let currentK = 1;

  const highlight = createMemo(() => {
    const id = state.selected;
    if (!id) return new Set<string>();
    return new Set([id, ...ancestors(atlas, id).map(a => a.l.id)]);
  });
  const nowR = createMemo(() => INNER + tree.scale.toPos(state.year) * (radius - INNER));

  const fit = (animate: boolean) => {
    if (!svg || !behavior) return;
    const { width, height } = svg.getBoundingClientRect();
    const k = Math.min(width, height) / (2 * radius + 140);
    const t = zoomIdentity.translate(width / 2, height / 2).scale(k);
    const sel = select(svg);
    if (animate && !reducedMotion) sel.transition().duration(700).call(behavior.transform, t);
    else sel.call(behavior.transform, t);
  };

  onSettled(() => {
    if (!svg) return;
    behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on("zoom", e => {
        currentK = e.transform.k;
        setTransform(e.transform);
      });
    select(svg).call(behavior).on("dblclick.zoom", null);
    fit(false);
    const ro = new ResizeObserver(() => fit(false));
    ro.observe(svg);
    return () => ro.disconnect();
  });

  // pan to the selected node, keeping the current zoom (at least a readable one)
  createEffect(
    () => ({ id: state.selected, tick: state.focusTick, open: state.treeOpen, expanded: state.treeExpanded }),
    ({ id, open }) => {
      if (!id || !open || !svg || !behavior) return;
      const n = tree.byId.get(id);
      if (!n) return;
      const { width, height } = svg.getBoundingClientRect();
      const k = Math.max(currentK, Math.min(width, height) / (2 * radius + 140) * 2.2);
      const t = zoomIdentity.translate(width / 2 - n.x * k, height / 2 - n.y * k).scale(k);
      const sel = select(svg);
      if (reducedMotion) sel.call(behavior.transform, t);
      else sel.transition().duration(900).call(behavior.transform, t);
    }
  );

  return (
    <div class="tree">
      <svg class="tree-svg" ref={el => (svg = el)} role="img" aria-label="Radial tree of language families over time">
        <g transform={`translate(${transform().x},${transform().y}) scale(${transform().k})`}>
          <For each={tree.rings}>
            {ring => (
              <g class="tree-ring">
                <circle r={ring.r} />
                <text y={-ring.r - 4}>{formatYear(ring.y)}</text>
              </g>
            )}
          </For>
          <circle class="tree-now" r={nowR()} />
          <g class="tree-links">
            <For each={tree.links}>
              {link => (
                <path
                  d={link.d}
                  stroke={link.color}
                  class={{ born: link.from <= state.year, lit: highlight().has(link.id) }}
                />
              )}
            </For>
          </g>
          <g class="tree-nodes">
            <For each={tree.nodes}>
              {n => {
                const deg = (n.angle * 180) / Math.PI - 90;
                const flip = n.angle > Math.PI;
                return (
                  <g
                    class={{
                      "tree-node": true,
                      born: n.from <= state.year,
                      extinct: n.to !== null && n.to < state.year,
                      selected: state.selected === n.id,
                      lit: highlight().has(n.id),
                      hovered: state.hovered === n.id,
                      proto: n.kind === "proto",
                      group: n.kind === "group",
                      stage: n.stage
                    }}
                    transform={`translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`}
                    style={{ "--c": n.color }}
                    onClick={() => actions.visit(n.id)}
                    onMouseEnter={() => actions.hover(n.id)}
                    onMouseLeave={() => actions.hover(null)}
                  >
                    <circle r={n.kind === "group" ? 2.2 : 3.4} />
                    <text
                      transform={`rotate(${flip ? deg + 180 : deg})`}
                      x={flip ? -7 : 7}
                      text-anchor={flip ? "end" : "start"}
                      dy="0.32em"
                    >
                      {n.name}
                    </text>
                  </g>
                );
              }}
            </For>
          </g>
        </g>
      </svg>
      <div class="tree-legend">
        <span>
          <i class="dot" /> centre = deepest past · rim = today
        </span>
        <Show when={state.treeExpanded} fallback={null}>
          <span>Scroll to zoom · drag to pan</span>
        </Show>
        <button class="link-btn" onClick={() => fit(true)}>
          Fit
        </button>
      </div>
    </div>
  );
}
