import { createContext, createStore, useContext } from "solid-js";
import type { Atlas } from "../data/model.ts";
import { cancelTween, tweenYear } from "../lib/tween.ts";

export interface AtlasState {
  year: number;
  playing: boolean;
  selected: string | null;
  hovered: string | null;
  treeOpen: boolean;
  treeExpanded: boolean;
  journey: { id: string; step: number } | null;
  journeysOpen: boolean;
  aboutOpen: boolean;
  sound: boolean;
  /** incremented to ask the map to fly to the selection again */
  focusTick: number;
}

export interface AtlasActions {
  setYear(y: number): void;
  play(on?: boolean): void;
  select(id: string | null, opts?: { fly?: boolean }): void;
  /** select and, if the language is not alive in the current year, sweep time to when it was */
  visit(id: string): void;
  hover(id: string | null): void;
  toggleTree(open?: boolean): void;
  expandTree(on?: boolean): void;
  startJourney(id: string): void;
  journeyStep(step: number): void;
  endJourney(): void;
  openJourneys(on?: boolean): void;
  openAbout(on?: boolean): void;
  toggleSound(): void;
}

export interface AtlasContextValue {
  atlas: Atlas;
  state: AtlasState;
  actions: AtlasActions;
  reducedMotion: boolean;
}

export const AtlasContext = createContext<AtlasContextValue>();

export function useAtlas(): AtlasContextValue {
  return useContext(AtlasContext);
}

export function createAtlasState(atlas: Atlas, initialYear: number): AtlasContextValue {
  const [state, setState] = createStore<AtlasState>({
    year: initialYear,
    playing: false,
    selected: null,
    hovered: null,
    treeOpen: typeof window === "undefined" || window.innerWidth > 860,
    treeExpanded: false,
    journey: null,
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
    play: on => {
      cancelTween();
      setState(s => {
        s.playing = on ?? !s.playing;
      });
    },
    select: (id, opts) =>
      setState(s => {
        s.selected = id;
        if (id && opts?.fly !== false) s.focusTick++;
      }),
    visit: id => {
      const n = atlas.nodes.get(id);
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
    startJourney: id =>
      setState(s => {
        s.journey = { id, step: 0 };
        s.journeysOpen = false;
        s.playing = false;
      }),
    journeyStep: step =>
      setState(s => {
        if (s.journey) s.journey.step = step;
      }),
    endJourney: () =>
      setState(s => {
        s.journey = null;
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

  return { atlas, state, actions, reducedMotion };
}
