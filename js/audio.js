// Procedural music and hits. Nothing is loaded from disk.

const BASS = [65.41, 0, 65.41, 0, 98.0, 0, 87.31, 0, 73.42, 0, 73.42, 0, 98.0, 0, 82.41, 0];
const LEAD = [523.25, 0, 659.25, 587.33, 783.99, 0, 659.25, 523.25, 587.33, 0, 783.99, 659.25, 880.0, 0, 783.99, 659.25];

export function createAudio() {
  const KEY = "skyslam.mute.v1";
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === "1";
  } catch {
    muted = false;
  }

  let ctx = null;
  let master = null;
  let musicGain = null;
  let duckGain = null;
  let sfxGain = null;
  let noiseBuffer = null;
  let started = false;
  let step = 0;
  let nextTime = 0;
  let bpm = 112;
  let fever = false;
  let timer = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.16;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.2;
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.72;

    musicGain.connect(duckGain);
    duckGain.connect(comp);
    sfxGain.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(time, freq, dur, type, peak, dest, slideTo) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), time + dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + Math.min(0.02, dur * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  function noise(time, dur, peak, dest, freq, type) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type || "bandpass";
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function kick(time) {
    tone(time, 156, 0.18, "sine", 0.55, musicGain, 46);
  }

  function snare(time) {
    noise(time, 0.12, 0.28, musicGain, 1800, "bandpass");
    tone(time, 196, 0.08, "triangle", 0.08, musicGain);
  }

  function hat(time, peak) {
    noise(time, 0.035, peak, musicGain, 7000, "highpass");
  }

  function bass(time, freq) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.09, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  function lead(time, freq) {
    tone(time, freq, 0.14, "triangle", fever ? 0.07 : 0.042, musicGain);
    if (fever) tone(time, freq * 2, 0.1, "sine", 0.02, musicGain);
  }

  function scheduleStep(index, time) {
    if (index % 2 === 0) hat(time, index % 4 === 0 ? 0.05 : 0.09);
    else if (fever) hat(time, 0.04);
    if (index === 0 || index === 8 || index === 10) kick(time);
    if (index === 4 || index === 12) snare(time);
    if (BASS[index]) bass(time, BASS[index]);
    if (LEAD[index]) lead(time, LEAD[index]);
  }

  function schedule() {
    if (!ctx) return;
    const horizon = ctx.currentTime + 0.12;
    while (nextTime < horizon) {
      scheduleStep(step, nextTime);
      const eighth = 60 / bpm / 2;
      nextTime += eighth;
      step = (step + 1) % 16;
    }
    timer = window.setTimeout(schedule, 25);
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!started) {
      started = true;
      nextTime = ctx.currentTime + 0.05;
      step = 0;
      schedule();
    }
  }

  function blip(freq, dur, type, peak) {
    if (!ctx) return;
    tone(ctx.currentTime, freq, dur, type, peak, sfxGain);
  }

  return {
    get muted() {
      return muted;
    },

    unlock,

    toggle() {
      muted = !muted;
      try {
        localStorage.setItem(KEY, muted ? "1" : "0");
      } catch {
        /* private mode */
      }
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      return muted;
    },

    setMood({ level = 1, fever: isFever = false, over = false, title = false }) {
      fever = isFever;
      const base = title ? 102 : Math.min(130, 110 + (level - 1) * 3);
      bpm = isFever ? Math.min(142, base + 10) : base;
      if (!musicGain || !ctx) return;
      const target = over ? 0.06 : title ? 0.14 : isFever ? 0.24 : 0.2;
      musicGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    },

    duck() {
      if (!duckGain || !ctx) return;
      const now = ctx.currentTime;
      duckGain.gain.cancelScheduledValues(now);
      duckGain.gain.setValueAtTime(Math.max(0.001, duckGain.gain.value), now);
      duckGain.gain.linearRampToValueAtTime(0.4, now + 0.03);
      duckGain.gain.linearRampToValueAtTime(1, now + 0.24);
    },

    ui() {
      blip(660, 0.06, "square", 0.08);
    },

    go() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(t, 392, 0.1, "square", 0.1, sfxGain);
      tone(t + 0.08, 523.25, 0.1, "square", 0.1, sfxGain);
      tone(t + 0.16, 783.99, 0.16, "square", 0.12, sfxGain);
    },

    dash() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(t, 0.12, 0.16, sfxGain, 1800, "highpass");
      tone(t, 520, 0.12, "sawtooth", 0.06, sfxGain, 180);
    },

    smash(hits, heavy) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const f = 210 + Math.min(12, hits) * 32;
      tone(t, heavy ? 90 : 140, heavy ? 0.22 : 0.12, "sine", heavy ? 0.28 : 0.16, sfxGain, 48);
      tone(t, f, 0.09, "square", 0.12, sfxGain);
      noise(t, heavy ? 0.16 : 0.08, heavy ? 0.22 : 0.14, sfxGain, heavy ? 420 : 900, "lowpass");
    },

    chip() {
      blip(320, 0.05, "square", 0.06);
    },

    gem(count) {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(t, 880, 0.07, "sine", 0.1, sfxGain);
      tone(t + 0.05, 1320, 0.09, "sine", 0.08, sfxGain);
      if (count > 2) tone(t + 0.1, 1760, 0.08, "sine", 0.05, sfxGain);
    },

    slam() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(t, 110, 0.26, "sine", 0.3, sfxGain, 36);
      noise(t, 0.18, 0.2, sfxGain, 300, "lowpass");
    },

    hurt() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(t, 196, 0.22, "sawtooth", 0.12, sfxGain, 70);
      tone(t, 155, 0.22, "square", 0.08, sfxGain, 60);
      noise(t, 0.16, 0.16, sfxGain, 400, "lowpass");
    },

    zap() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(t, 0.2, 0.22, sfxGain, 2400, "bandpass");
      tone(t, 880, 0.08, "square", 0.08, sfxGain, 120);
    },

    warn() {
      blip(740, 0.05, "square", 0.05);
    },

    comboUp(mult) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const root = 523 * Math.pow(1.06, Math.min(8, mult));
      tone(t, root, 0.12, "triangle", 0.09, sfxGain);
      tone(t + 0.04, root * 1.25, 0.12, "sine", 0.07, sfxGain);
      tone(t + 0.08, root * 1.5, 0.16, "triangle", 0.08, sfxGain);
    },

    comboBreak() {
      if (!ctx) return;
      tone(ctx.currentTime, 220, 0.18, "sine", 0.06, sfxGain, 110);
    },

    level() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.07, f, 0.12, "square", 0.08, sfxGain));
    },

    best() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [784, 988, 1318].forEach((f, i) => tone(t + i * 0.06, f, 0.14, "triangle", 0.09, sfxGain));
    },

    gameover() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.1, f, 0.18, "triangle", 0.1, sfxGain));
    },

    pop() {
      blip(480, 0.08, "sine", 0.08);
    },
  };
}
