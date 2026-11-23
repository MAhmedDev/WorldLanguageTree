/**
 * Optional ambient soundscape, synthesised with WebAudio (no audio files):
 * a slow, warm drone over filtered "wind". Off by default; only starts from a click.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioScheduledSourceNode[] = [];
let level = 1;

export function setAmbientVolume(v: number) {
  level = v;
  if (ctx && master) master.gain.setTargetAtTime(0.16 * v, ctx.currentTime, 0.2);
}

export function startAmbient() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.16 * level, ctx.currentTime + 4);

  // drone: a soft open fifth with gentle detune and slow tremolo
  for (const [freq, gain] of [
    [55, 0.5],
    [82.4, 0.28],
    [110.2, 0.16],
    [164.8, 0.06]
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = gain * 0.35;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(g).connect(master);
    osc.start();
    lfo.start();
    nodes.push(osc, lfo);
  }

  // wind: filtered noise with a wandering cutoff
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.03;
  const sweepGain = ctx.createGain();
  sweepGain.gain.value = 220;
  sweep.connect(sweepGain).connect(filter.frequency);
  const ng = ctx.createGain();
  ng.gain.value = 0.35;
  noise.connect(filter).connect(ng).connect(master);
  noise.start();
  sweep.start();
  nodes.push(noise, sweep);
}

export function stopAmbient() {
  if (!ctx || !master) return;
  const c = ctx;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setValueAtTime(master.gain.value, c.currentTime);
  master.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
  const stopping = nodes;
  nodes = [];
  ctx = null;
  master = null;
  setTimeout(() => {
    stopping.forEach(n => n.stop());
    void c.close();
  }, 1400);
}
