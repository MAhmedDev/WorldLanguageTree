import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";
import type { Atlas } from "../data/model.ts";

/*
 * Everything that changes over time or with interaction is FEATURE STATE, set per feature
 * by GlobeMap only when it actually changes. (Global state or filters would make MapLibre
 * re-parse every tile on each change, i.e. every frame during playback.)
 *   b   born (year >= from)          al  still alive (year <= to)
 *   age years since birth, stepped    sel/hov  selected / hovered languoid
 *   foc in the spotlight              rec  receded (a spotlight exists and this isn't in it)
 */
const fs = (k: string, fallback: number): ExpressionSpecification => ["coalesce", ["feature-state", k], fallback];
const born: ExpressionSpecification = ["==", fs("b", 0), 1];
const alive: ExpressionSpecification = ["==", fs("al", 1), 1];
const age: ExpressionSpecification = fs("age", 0);
const focused: ExpressionSpecification = ["==", fs("foc", 0), 1];
const receded: ExpressionSpecification = ["==", fs("rec", 0), 1];
const sel: ExpressionSpecification = ["==", fs("sel", 0), 1];
const hov: ExpressionSpecification = ["==", fs("hov", 0), 1];

function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng < 180; lng += 20)
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: Array.from({ length: 37 }, (_, i) => [lng, -90 + i * 5]) } });
  for (let lat = -60; lat <= 60; lat += 20)
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) } });
  return { type: "FeatureCollection", features };
}

export function presenceGeoJSON(atlas: Atlas): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: atlas.presence.map((p, i) => ({
      type: "Feature",
      id: i,
      properties: {
        pid: p.id,
        languoid: p.languoid,
        kind: p.kind,
        from: p.from,
        to: p.to,
        color: atlas.colors.get(p.rootId) ?? "#e8c170",
        proto: atlas.nodes.get(p.languoid)?.l.kind === "proto"
      },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] }
    }))
  };
}

export function arcsGeoJSON(atlas: Atlas): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: atlas.arcs.map((a, i) => ({
      type: "Feature",
      id: i,
      properties: { aid: a.id, languoid: a.languoid, kind: a.kind, from: a.from, color: atlas.colors.get(a.rootId) ?? "#e8c170" },
      geometry: { type: "LineString", coordinates: a.coords }
    }))
  };
}

export function buildStyle(atlas: Atlas): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#0b1424",
      "horizon-color": "#1d2f4d",
      "fog-color": "#0b1424",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.6,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.6, 8, 0]
    },
    sources: {
      land: { type: "geojson", data: "/geo/land.geojson" },
      lakes: { type: "geojson", data: "/geo/lakes.geojson" },
      rivers: { type: "geojson", data: "/geo/rivers.geojson" },
      graticule: { type: "geojson", data: graticule() },
      presence: { type: "geojson", data: presenceGeoJSON(atlas) },
      arcs: { type: "geojson", data: arcsGeoJSON(atlas) }
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#08111f" } },
      { id: "graticule", type: "line", source: "graticule", paint: { "line-color": "#6b84a8", "line-opacity": 0.07, "line-width": 0.6 } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#141d2c", "fill-opacity": 1 } },
      { id: "land-glow", type: "line", source: "land", paint: { "line-color": "#c9a96a", "line-opacity": 0.1, "line-width": 6, "line-blur": 6 } },
      { id: "coast", type: "line", source: "land", paint: { "line-color": "#d8bd85", "line-opacity": 0.28, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 1.1] } },
      { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": "#0a1424" } },
      { id: "rivers", type: "line", source: "rivers", paint: { "line-color": "#5d86a8", "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.12, 5, 0.35], "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 6, 1.2] } },

      // lineage & spread arcs: bright when new, settle into faint threads
      {
        id: "arcs-glow",
        type: "line",
        source: "arcs",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 4, 6, 10],
          "line-blur": 6,
          "line-opacity": ["case", ["!", born], 0, receded, 0.01, ["all", focused], 0.5, ["interpolate", ["linear"], age, 0, 0.55, 150, 0.08, 1000, 0.03]]
        }
      },
      {
        id: "arcs",
        type: "line",
        source: "arcs",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, ["case", sel, 2.2, 0.7], 6, ["case", sel, 3.2, 1.6]],
          "line-dasharray": [1, 0],
          "line-opacity": ["case", ["!", born], 0, receded, 0.06, sel, 0.95, focused, 0.95, ["interpolate", ["linear"], age, 0, 0.9, 200, 0.35, 1500, 0.18]]
        }
      },

      // presence: soft glow, embers after extinction
      {
        id: "presence-glow",
        type: "circle",
        source: "presence",
        paint: {
          "circle-color": ["case", alive, ["get", "color"], "#b0573a"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", alive, 14, 6], 6, ["case", alive, 48, 16]],
          "circle-blur": 1,
          "circle-opacity": ["case", ["!", born], 0, receded, ["case", alive, 0.1, 0.04], alive, ["interpolate", ["linear"], age, 0, 0.85, 80, 0.38, 2000, 0.3], 0.18],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "presence-core",
        type: "circle",
        source: "presence",
        paint: {
          "circle-color": ["case", alive, "#fff7e6", "#d07a52"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", alive, ["case", ["==", ["get", "kind"], "homeland"], 2.6, 1.8], 1.2], 6, ["case", alive, 5, 2.5]],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": ["case", alive, 1.2, 0],
          "circle-opacity": ["case", ["!", born], 0, receded, 0.22, alive, ["case", ["get", "proto"], 0.55, 0.95], 0.45],
          "circle-stroke-opacity": ["case", ["!", born], 0, receded, 0.2, 0.9],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "presence-focus",
        type: "circle",
        source: "presence",

        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["all", born, focused], 0.12, 0],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 12, 6, 26],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1.2,
          "circle-stroke-opacity": ["case", ["all", born, focused], 0.85, 0],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "presence-selected",
        type: "circle",
        source: "presence",

        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 9, 6, 18],
          "circle-stroke-color": "#fff3d6",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": ["case", ["all", born, sel], 0.95, 0],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "presence-hover",
        type: "circle",
        source: "presence",

        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 7, 6, 14],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1.2,
          "circle-stroke-opacity": ["case", ["all", born, hov], 0.8, 0],
          "circle-pitch-alignment": "map"
        }
      }
    ]
  };
}
