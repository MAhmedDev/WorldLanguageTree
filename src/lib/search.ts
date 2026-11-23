/** Small fuzzy search over names (diacritic- and case-insensitive). */

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface SearchItem {
  id: string;
  terms: string[];
}

/** 0 = no match; higher is better. */
export function score(query: string, terms: string[]): number {
  const q = normalize(query);
  if (!q) return 0;
  let best = 0;
  for (const raw of terms) {
    const t = normalize(raw);
    if (!t) continue;
    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 80 - Math.min(20, t.length - q.length));
    else if (t.split(" ").some(w => w.startsWith(q))) best = Math.max(best, 60);
    else if (t.includes(q)) best = Math.max(best, 40);
    else if (isSubsequence(q.replace(/ /g, ""), t.replace(/ /g, ""))) best = Math.max(best, 15);
  }
  return best;
}

function isSubsequence(q: string, t: string): boolean {
  let i = 0;
  for (const c of t) if (c === q[i]) i++;
  return i === q.length && q.length >= 3;
}

export function search(query: string, items: SearchItem[], limit = 8): string[] {
  return items
    .map(it => ({ id: it.id, s: score(query, it.terms) }))
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(r => r.id);
}
