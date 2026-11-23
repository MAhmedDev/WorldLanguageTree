import { createContext, createMemo, createStore, useContext } from "solid-js";
import type { Atlas } from "../data/model.ts";
import { cancelTween, tweenYear } from "../lib/tween.ts";

export interface AtlasState {
  year: number;
  selected: string | null;
  hovered: string | null;
  treeOpen: boolean;
  treeExpanded: boolean;
  /** active guided journey; `arrived` flips once the camera and time have finished travelling */
  journey: { id: string; step: number; arrived: boolean } | null;
  /** languoids a guided mode is focused on (map highlight + camera), without opening a page */
  spotlight: string[];
  /** "The Story of Language": chapter index, beat index (-1 = intro, beats.length = closing card), intro paragraph */
  story: { chapter: number; beat: number; para: number; arrived: boolean } | null;
  /** play the recorded narration */
  voice: boolean;
  /** master volume for narration and ambient sound, 0..1 */
  volume: number;
  muted: boolean;
  /** journeys advance only on user action unless autoplay is switched on */
  autoplay: boolean;
  journeysOpen: boolean;
  aboutOpen: boolean;
  sound: boolean;
  /** incremented to ask the map to fly to the selection again */
  focusTick: number;
}

export interface AtlasActions {
  setYear(y: number): void;
  select(id: string | null, opts?: { fly?: boolean }): void;
  /** select and, if the language is not alive in the current year, sweep time to when it was */
  visit(id: string): void;
  hover(id: string | null): void;
  toggleTree(open?: boolean): void;
  expandTree(on?: boolean): void;
  /** move a journey to a step: closes any open page, spotlights the step's languoid, starts travel */
  journeyGo(id: string, step: number, languoid: string): void;
  journeyArrived(id: string, step: number): void;
  endJourney(): void;
  setAutoplay(on: boolean): void;
  storyGo(chapter: number, beat: number, para: number, languoids: string[]): void;
  storyArrived(chapter: number, beat: number): void;
  endStory(): void;
  toggleVoice(): void;
  setVolume(v: number): void;
  toggleMute(): void;
  openJourneys(on?: boolean): void;
  openAbout(on?: boolean): void;
  toggleSound(): void;
}

export interface AtlasContextValue {
  atlas: Atlas;
  state: AtlasState;
  actions: AtlasActions;
  reducedMotion: boolean;
  /**
   * The current year snapped down to the last year at which any languoid starts or ends.
   * "Who is alive" never changes between two such boundaries, so views that only care about
   * that (tree, labels, counts) read this instead of `state.year` and stay idle during playback.
   */
  epoch: () => number;
}

export const AtlasContext = createContext<AtlasContextValue>();

export function useAtlas(): AtlasContextValue {
  return useContext(AtlasContext);
}

function readVolume(): number {
  try {
    const raw = localStorage.getItem("wlt.volume");
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.85;
  } catch {
    return 0.85;
  }
}

export function createAtlasState(atlas: Atlas, initialYear: number): AtlasContextValue {
  const [state, setState] = createStore<AtlasState>({
    year: initialYear,
    selected: null,
    hovered: null,
    // one focal point: the globe. The tree is a click away.
    treeOpen: false,
    treeExpanded: false,
    journey: null,
    spotlight: [],
    story: null,
    voice: true,
    volume: readVolume(),
    muted: false,
    autoplay: false,
    journeysOpen: false,
    aboutOpen: false,
    sound: false,
    focusTick: 0
  });

  const reducedMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clampYear = (y: number) => Math.round(Math.max(atlas.minYear, Math.min(new Date().getFullYear(), y)));

  const actions: AtlasActions = {
    setYear: y =>
      setState(s => {
        s.year = clampYear(y);
      }),
    select: (id, opts) =>
      setState(s => {
        s.selected = id;
        if (id && opts?.fly !== false) s.focusTick++;
      }),
    visit: id => {
      const n = atlas.nodes.get(id);
      // pause so the reader can take the page in
      if (state.autoplay) actions.setAutoplay(false);
      actions.select(id, { fly: true });
      if (!n || !Number.isFinite(n.from)) return;
      const y = state.year;
      const end = n.to ?? new Date().getFullYear();
      if (y >= n.from && y <= end) return;
      const target = n.to === null ? Math.max(n.from, Math.min(end, 2000)) : Math.round(n.from + (end - n.from) * 0.35);
      void tweenYear(y, target, actions.setYear, 1800, reducedMotion);
    },
    hover: id =>
      setState(s => {
        s.hovered = id;
      }),
    toggleTree: open =>
      setState(s => {
        s.treeOpen = open ?? !s.treeOpen;
        if (!s.treeOpen) s.treeExpanded = false;
      }),
    expandTree: on =>
      setState(s => {
        s.treeExpanded = on ?? !s.treeExpanded;
        if (s.treeExpanded) s.treeOpen = true;
      }),
    journeyGo: (id, step, languoid) => {
      cancelTween();
      setState(s => {
        s.journey = { id, step, arrived: false };
        s.story = null;
        s.spotlight = [languoid];
        s.selected = null;
        s.journeysOpen = false;
        s.focusTick++;
      });
    },
    journeyArrived: (id, step) =>
      setState(s => {
        if (s.journey && s.journey.id === id && s.journey.step === step) s.journey.arrived = true;
      }),
    endJourney: () =>
      setState(s => {
        s.journey = null;
        s.spotlight = [];
        s.autoplay = false;
      }),
    storyGo: (chapter, beat, para, languoids) => {
      cancelTween();
      setState(s => {
        const sameView = s.story && s.story.chapter === chapter && s.story.beat === beat;
        s.story = { chapter, beat, para, arrived: sameView ? s.story!.arrived : false };
        s.journey = null;
        s.selected = null;
        s.journeysOpen = false;
        if (!sameView) {
          s.spotlight = languoids;
          s.focusTick++;
        }
      });
    },
    storyArrived: (chapter, beat) =>
      setState(s => {
        if (s.story && s.story.chapter === chapter && s.story.beat === beat) s.story.arrived = true;
      }),
    endStory: () =>
      setState(s => {
        s.story = null;
        s.spotlight = [];
        s.autoplay = false;
      }),
    toggleVoice: () =>
      setState(s => {
        s.voice = !s.voice;
      }),
    setAutoplay: on =>
      setState(s => {
        s.autoplay = on;
      }),
    setVolume: v => {
      setState(s => {
        s.volume = Math.max(0, Math.min(1, v));
        s.muted = false;
      });
      try {
        localStorage.setItem("wlt.volume", String(v));
      } catch {
        /* storage unavailable: the level just isn't remembered */
      }
    },
    toggleMute: () =>
      setState(s => {
        s.muted = !s.muted;
      }),
    openJourneys: on =>
      setState(s => {
        s.journeysOpen = on ?? !s.journeysOpen;
      }),
    openAbout: on =>
      setState(s => {
        s.aboutOpen = on ?? !s.aboutOpen;
      }),
    toggleSound: () =>
      setState(s => {
        s.sound = !s.sound;
      })
  };

  const boundaries = [...new Set([...atlas.nodes.values()].flatMap(n => [n.from, n.to === null ? NaN : n.to + 1]).filter(Number.isFinite))].sort(
    (a, b) => a - b
  );
  const epoch = createMemo(() => {
    const y = state.year;
    let lo = 0;
    let hi = boundaries.length - 1;
    let best = -Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (boundaries[mid] <= y) {
        best = boundaries[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  });

  return { atlas, state, actions, reducedMotion, epoch };
}
