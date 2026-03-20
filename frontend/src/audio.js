let audioCtx;

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function envelope(ctx, when, duration, peak = 0.18) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  gain.connect(ctx.destination);
  return gain;
}

function tone(freq, type, when, duration) {
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  const gain = envelope(ctx, when, duration);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  osc.connect(gain);
  osc.start(when);
  osc.stop(when + duration);
}

function shimmer(when) {
  const ctx = ensureCtx();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, when);
  filter.frequency.exponentialRampToValueAtTime(3200, when + 0.2);
  filter.connect(ctx.destination);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.05, when + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
  gain.connect(filter);

  const noise = ctx.createBufferSource();
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.25));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.4;
  noise.buffer = buffer;
  noise.connect(gain);
  noise.start(when);
}

export function unlockAudio() {
  const ctx = ensureCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

export function getAudioNow() {
  return ensureCtx().currentTime;
}

export function playEvent(eventName, when) {
  const ctx = ensureCtx();
  if (ctx.state === "suspended") {
    return;
  }

  if (eventName === "pulse") {
    tone(220, "sine", when, 0.28);
    tone(110, "triangle", when, 0.22);
    return;
  }

  if (eventName === "glow") {
    tone(330, "triangle", when, 0.4);
    tone(440, "sine", when + 0.03, 0.28);
    shimmer(when + 0.02);
    return;
  }

  if (eventName === "rain") {
    tone(520, "square", when, 0.12);
    tone(660, "triangle", when + 0.09, 0.15);
    tone(780, "sine", when + 0.15, 0.13);
    return;
  }

  if (eventName === "bloom") {
    tone(262, "sine", when, 0.35);
    tone(392, "triangle", when + 0.05, 0.28);
    tone(523, "sine", when + 0.1, 0.22);
    return;
  }

  if (eventName === "drift") {
    tone(196, "triangle", when, 0.45);
    tone(247, "sine", when + 0.08, 0.35);
    shimmer(when + 0.14);
    return;
  }

  if (eventName === "spark") {
    tone(660, "square", when, 0.1);
    tone(880, "triangle", when + 0.06, 0.1);
    tone(990, "sine", when + 0.11, 0.08);
    return;
  }

  tone(260, "sine", when, 0.2);
}
