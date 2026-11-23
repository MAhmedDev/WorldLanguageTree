/** Year helpers. Years: negative = BCE, positive = CE (historical numbering, no year 0 in display). */

export const PRESENT = new Date().getFullYear();

export function formatYear(y: number, approx = false): string {
  const c = approx ? "c. " : "";
  if (y < 0) return `${c}${Math.abs(y).toLocaleString("en")} BCE`;
  if (y < 1000) return `${c}${y} CE`;
  return `${c}${y}`;
}

export function formatRange(from: number, to: number | null, approx: boolean): string {
  if (to === null) return `${formatYear(from, approx)} – today`;
  // shared era suffix: "c. 700 – 200 BCE"
  if (from < 0 && to < 0) return `${approx ? "c. " : ""}${Math.abs(from).toLocaleString("en")} – ${Math.abs(to).toLocaleString("en")} BCE`;
  return `${formatYear(from, approx)} – ${formatYear(to, approx && to < 1500)}`;
}

/**
 * Piecewise-linear "time river" scale. Deep time is compressed, recent
 * centuries are given more room, so dense modern history stays legible.
 */
export interface TimeScale {
  toPos(year: number): number;
  toYear(pos: number): number;
  min: number;
  max: number;
}

export function createTimeScale(minYear: number, maxYear = PRESENT): TimeScale {
  const min = Math.min(minYear, -3500);
  const stops: [number, number][] = [
    [min, 0],
    [-3400, 0.14],
    [-1200, 0.34],
    [500, 0.58],
    [1500, 0.8],
    [maxYear, 1]
  ];
  return {
    min,
    max: maxYear,
    toPos(year) {
      const y = Math.max(min, Math.min(maxYear, year));
      for (let i = 1; i < stops.length; i++) {
        const [y0, p0] = stops[i - 1];
        const [y1, p1] = stops[i];
        if (y <= y1) return p0 + ((y - y0) / (y1 - y0)) * (p1 - p0);
      }
      return 1;
    },
    toYear(pos) {
      const p = Math.max(0, Math.min(1, pos));
      for (let i = 1; i < stops.length; i++) {
        const [y0, p0] = stops[i - 1];
        const [y1, p1] = stops[i];
        if (p <= p1) return Math.round(y0 + ((p - p0) / (p1 - p0)) * (y1 - y0));
      }
      return maxYear;
    }
  };
}

/** Broad, conventional periods used only as orientation labels on the time river. */
export const ERAS: { label: string; from: number; to: number }[] = [
  { label: "Before writing · reconstructed", from: -100000, to: -3400 },
  { label: "Dawn of writing", from: -3400, to: -1200 },
  { label: "Antiquity", from: -1200, to: 500 },
  { label: "Middle Ages", from: 500, to: 1500 },
  { label: "Early modern", from: 1500, to: 1800 },
  { label: "Modern", from: 1800, to: 100000 }
];

export function eraOf(year: number): string {
  return ERAS.find(e => year >= e.from && year < e.to)?.label ?? "";
}
