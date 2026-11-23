/** Smoothly animate the year (used by journeys and "jump to year" links). Call from event handlers or timers. */
let raf = 0;

export function tweenYear(from: number, to: number, setYear: (y: number) => void, ms: number, reducedMotion: boolean): Promise<void> {
  cancelAnimationFrame(raf);
  if (reducedMotion || ms <= 0 || from === to) {
    setYear(to);
    return Promise.resolve();
  }
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return new Promise(resolve => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setYear(from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else resolve();
    };
    raf = requestAnimationFrame(step);
  });
}

export function cancelTween() {
  cancelAnimationFrame(raf);
}
