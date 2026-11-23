/**
 * Narration: pre-rendered clips (scripts/narrate.py, local neural voice) played on demand.
 * A clip plays only if its recorded text equals the current, verified narration, so the
 * voice can never say something the screen (and the fact-checker) does not.
 */
type Manifest = Record<string, { file: string; hash: string; text: string }>;

let manifest: Promise<Manifest> | null = null;
let audio: HTMLAudioElement | null = null;
let token = 0;
let volume = 1;
/** true once the current step's clip has really started (not missing, mismatched or blocked) */
let started = false;

export function clipStarted(): boolean {
  return started;
}

export function setNarratorVolume(v: number) {
  volume = v;
  if (audio) audio.volume = v;
}

/** Pause mid-sentence (resumable). */
export function pauseSpeaking() {
  audio?.pause();
}

/** Continue the current clip from where it was paused. */
export function resumeSpeaking() {
  if (audio && audio.paused && !audio.ended) void audio.play().catch(() => {});
}

const loadManifest = () =>
  // the build id busts the browser cache for the index on every deploy
  (manifest ??= fetch(`/audio/narration/manifest.json?v=${__BUILD_ID__}`)
    .then(r => (r.ok ? (r.json() as Promise<Manifest>) : ({} as Manifest)))
    .catch(() => ({}) as Manifest));

export const narrationSupported = () => typeof Audio !== "undefined";

export function speak(id: string, text: string) {
  const mine = ++token;
  stopSpeaking(false);
  started = false;
  void loadManifest().then(m => {
    const clip = m[id];
    if (mine !== token || !clip || clip.text !== text) return;
    // the clip's hash changes whenever its audio is re-rendered, so fixed clips are never served stale
    audio = new Audio(`/audio/narration/${clip.file}?v=${clip.hash}`);
    audio.volume = volume;
    void audio
      .play()
      .then(() => {
        if (mine === token) started = true;
      })
      .catch(() => {
      /* autoplay blocked until a user gesture; the next page turn will play */
    });
  });
}

export function stopSpeaking(bump = true) {
  if (bump) token++;
  started = false;
  if (audio) {
    audio.pause();
    audio = null;
  }
}

export function isSpeaking(): boolean {
  return !!audio && !audio.paused && !audio.ended;
}
