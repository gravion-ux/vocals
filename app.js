// Vocals — pure logic (exported for tests) + browser UI (guarded).

export function hashSeed(str) {
  let h = 2166136261;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function seededRandom(seed) {
  let a = (typeof seed === "number" ? seed >>> 0 : hashSeed(seed)) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parsePronunciation(text) {
  const dict = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*([^=\s]+)\s*=\s*(.+?)\s*$/);
    if (m) dict[m[1].toLowerCase()] = m[2];
  }
  return dict;
}

export function applyPronunciation(text, dict = {}) {
  return String(text ?? "").replace(/[A-Za-z][A-Za-z'-]*/g, (w) => {
    const rep = dict[w.toLowerCase()];
    if (!rep) return w;
    return /^[A-Z]/.test(w) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
  });
}

export const KEY_OFFSETS = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

const PROGRESSIONS = {
  happy: [0, 7, 9, 5],
  sad: [9, 5, 0, 7],
  chill: [0, 9, 5, 7],
  energetic: [0, 0, 7, 9],
  cinematic: [9, 7, 5, 4],
};

export function generateBeatPattern({ seed = 1, mood = "chill", genre = "lofi", bpm = 90, key = "C", bars = 4 } = {}) {
  const rand = seededRandom(seed);
  const root = 48 + (KEY_OFFSETS[key] ?? 0);
  const prog = PROGRESSIONS[mood] ?? PROGRESSIONS.chill;
  const stepsPerBar = 16;
  const drums = { kick: [], snare: [], hat: [] };
  const bass = [];
  const chords = [];
  for (let bar = 0; bar < bars; bar++) {
    const base = bar * stepsPerBar;
    const chordRoot = root + prog[bar % prog.length];
    chords.push({ step: base, notes: [chordRoot + 12, chordRoot + 16, chordRoot + 19] });
    for (let s = 0; s < stepsPerBar; s++) {
      const step = base + s;
      if (genre === "trap") {
        if (s === 0 || s === 7 || s === 10) drums.kick.push(step);
        if (s === 8) drums.snare.push(step);
        if (s % 2 === 0 || rand() > 0.8) drums.hat.push(step);
      } else if (genre === "pop") {
        if (s % 4 === 0) drums.kick.push(step);
        if (s === 4 || s === 12) drums.snare.push(step);
        if (s % 2 === 0) drums.hat.push(step);
      } else if (genre === "cinematic") {
        if (s === 0) drums.kick.push(step);
        if (s === 8 && rand() > 0.4) drums.snare.push(step);
      } else { // lofi
        if (s === 0 || s === 10) drums.kick.push(step);
        if (s === 4 || s === 12) drums.snare.push(step);
        if (s % 4 === 2 || rand() > 0.85) drums.hat.push(step);
      }
      if (s % 4 === 0) bass.push({ step, note: chordRoot });
      else if (s === 14 && rand() > 0.5) bass.push({ step, note: chordRoot + 7 });
    }
  }
  return { seed, mood, genre, bpm, key, bars, stepsPerBar, totalSteps: bars * stepsPerBar, drums, bass, chords };
}

export function noteToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

export function normalizeSamples(samples, peak = 0.89) {
  const out = Float32Array.from(samples);
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) { const g = peak / max; for (let i = 0; i < out.length; i++) out[i] *= g; }
  return out;
}

export function mixGainPan(left, right, gain = 1, pan = 0) {
  const p = Math.max(-1, Math.min(1, pan));
  const l = Math.cos(((p + 1) * Math.PI) / 4) * gain;
  const r = Math.sin(((p + 1) * Math.PI) / 4) * gain;
  return [left * l, right * r];
}

export function encodeWav(channels, sampleRate = 44100) {
  const numCh = channels.length;
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Uint8Array(buffer);
}

export function canCloneOrExport({ consent = false, hasText = false } = {}) {
  return Boolean(consent && hasText);
}

export function exportFilename(base = "vocals", aiGenerated = false, ext = "wav") {
  const clean = String(base).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vocals";
  return aiGenerated ? `${clean}-ai-generated.${ext}` : `${clean}.${ext}`;
}

// ---------------- Browser UI ----------------
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const state = { ctx: null, voiceBuffer: null, recorder: null, chunks: [], playing: null, aiUsed: false, pattern: null };
  const pet = $("pet");
  const setPet = (s, msg) => { pet.dataset.state = s; if (msg) $("petMsg").textContent = msg; };

  const audioCtx = () => (state.ctx ??= new (window.AudioContext || window.webkitAudioContext)());

  function refreshGate() {
    const ok = canCloneOrExport({ consent: $("consent").checked, hasText: $("script").value.trim().length > 0 });
    for (const id of ["aiSpeak", "exportWav", "recordExport"]) $(id).disabled = !ok;
  }
  $("consent").addEventListener("change", refreshGate);
  $("script").addEventListener("input", refreshGate);

  // Voices for local preview
  function loadVoices() {
    const sel = $("voiceSel"); sel.innerHTML = "";
    speechSynthesis.getVoices().forEach((v, i) => {
      const o = document.createElement("option"); o.value = i; o.textContent = `${v.name} (${v.lang})`; sel.appendChild(o);
    });
  }
  if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  $("previewBtn").addEventListener("click", () => {
    const text = applyPronunciation($("script").value, parsePronunciation($("pron").value));
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices()[Number($("voiceSel").value)]; if (v) u.voice = v;
    u.pitch = Number($("pitch").value); u.rate = Number($("rate").value);
    u.onstart = () => setPet("listening", "Preview playing…");
    u.onend = () => setPet("done", "Preview done!");
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  });

  // Record / upload voice
  $("recordBtn").addEventListener("click", async () => {
    if (state.recorder?.state === "recording") { state.recorder.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.recorder = new MediaRecorder(stream);
    state.recorder.ondataavailable = (e) => state.chunks.push(e.data);
    state.recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(state.chunks, { type: state.recorder.mimeType });
      state.voiceBuffer = await audioCtx().decodeAudioData(await blob.arrayBuffer());
      $("voiceStatus").textContent = `Recorded voice loaded (${state.voiceBuffer.duration.toFixed(1)}s, ${state.recorder.mimeType}).`;
      setPet("done", "Voice captured!");
      $("recordBtn").textContent = "● Record voice";
    };
    state.recorder.start();
    setPet("recording", "Recording… tap again to stop.");
    $("recordBtn").textContent = "■ Stop recording";
  });

  $("voiceFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.voiceBuffer = await audioCtx().decodeAudioData(await f.arrayBuffer());
    $("voiceStatus").textContent = `Uploaded voice loaded (${state.voiceBuffer.duration.toFixed(1)}s).`;
    setPet("done", "Voice sample ready!");
  });

  // BYO AI TTS
  $("aiSpeak").addEventListener("click", async () => {
    const base = $("aiBase").value.trim().replace(/\/$/, "");
    const key = $("aiKey").value.trim();
    if (!base || !key) { $("voiceStatus").textContent = "Add your AI base URL + API key in Settings first."; return; }
    setPet("generating", "Asking your AI for studio voice…");
    const text = applyPronunciation($("script").value, parsePronunciation($("pron").value));
    try {
      const res = await fetch(`${base}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: $("aiModel").value.trim() || "tts-1", voice: $("aiVoice").value.trim() || "alloy", input: text }),
      });
      if (!res.ok) throw new Error(`AI request failed (${res.status})`);
      const blob = await res.blob();
      state.voiceBuffer = await audioCtx().decodeAudioData(await blob.arrayBuffer());
      state.aiUsed = true;
      $("voiceStatus").textContent = "AI voice generated and loaded for mixing. This export will be labelled AI-generated.";
      setPet("done", "AI voice ready!");
    } catch (err) {
      $("voiceStatus").textContent = String(err.message || err);
      setPet("idle", "AI request failed — local mode still works.");
    }
  });

  // Settings persistence (localStorage only)
  for (const id of ["aiBase", "aiKey", "aiModel", "aiVoice", "petName"]) {
    const el = $(id);
    el.value = localStorage.getItem(`vf-${id}`) ?? el.value;
    el.addEventListener("change", () => localStorage.setItem(`vf-${id}`, el.value));
  }
  $("petName").addEventListener("input", (e) => { $("petNameLabel").textContent = e.target.value || "Forge"; });

  // Beat scheduling (works for live + offline contexts)
  function scheduleBeat(ctx, dest, pattern, startAt) {
    const spb = 60 / pattern.bpm / 4; // seconds per 16th step
    const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const kick = (t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.2); };
    const snare = (t) => { const s = ctx.createBufferSource(); s.buffer = noise; const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(g).connect(dest); s.start(t); s.stop(t + 0.15); };
    const hat = (t) => { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 0.06); };
    const tone = (t, midi, dur, vol, type = "sine") => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = noteToFreq(midi); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); };
    for (const s of pattern.drums.kick) kick(startAt + s * spb);
    for (const s of pattern.drums.snare) snare(startAt + s * spb);
    for (const s of pattern.drums.hat) hat(startAt + s * spb);
    for (const b of pattern.bass) tone(startAt + b.step * spb, b.note, spb * 3, 0.35, "triangle");
    for (const c of pattern.chords) for (const n of c.notes) tone(startAt + c.step * spb, n, spb * 14, 0.07, "sine");
    return pattern.totalSteps * spb;
  }

  function currentPattern() {
    return generateBeatPattern({
      seed: $("beatSeed").value || 1, mood: $("mood").value, genre: $("genre").value,
      bpm: Number($("bpm").value), key: $("key").value, bars: 4,
    });
  }

  $("playBeat").addEventListener("click", () => {
    const ctx = audioCtx();
    state.pattern = currentPattern();
    const dur = scheduleBeat(ctx, ctx.destination, state.pattern, ctx.currentTime + 0.05);
    setPet("listening", `Beat playing — ${state.pattern.genre} · ${state.pattern.mood} · ${state.pattern.bpm} BPM`);
    setTimeout(() => setPet("done", "Beat preview done!"), dur * 1000);
  });

  function impulse(ctx, seconds = 1.8) {
    const b = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5); }
    return b;
  }

  async function renderMix() {
    const pattern = currentPattern();
    const beatDur = pattern.totalSteps * (60 / pattern.bpm / 4);
    const dur = Math.max(beatDur, state.voiceBuffer?.duration ?? 0) + 2;
    const off = new OfflineAudioContext(2, Math.ceil(dur * 44100), 44100);
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    comp.connect(off.destination);
    const mk = (gainVal, panVal, reverbVal) => {
      const g = off.createGain(); g.gain.value = gainVal;
      const p = off.createStereoPanner(); p.pan.value = panVal;
      g.connect(p); p.connect(comp);
      if (reverbVal > 0) { const conv = off.createConvolver(); conv.buffer = impulse(off); const wet = off.createGain(); wet.gain.value = reverbVal; g.connect(conv); conv.connect(wet); wet.connect(comp); }
      return g;
    };
    scheduleBeat(off, mk(Number($("beatGain").value), Number($("beatPan").value), 0), pattern, 0.05);
    if (state.voiceBuffer) {
      const src = off.createBufferSource(); src.buffer = state.voiceBuffer;
      src.connect(mk(Number($("voiceGain").value), Number($("voicePan").value), Number($("reverb").value)));
      src.start(0.05);
    }
    const rendered = await off.startRendering();
    const chans = [rendered.getChannelData(0), rendered.getChannelData(1)];
    const peak = Math.max(...chans.map((c) => Math.max(...Array.from(c.slice(0, 50000)).map(Math.abs))));
    const norm = chans.map((c) => normalizeSamples(c, peak > 0 ? 0.89 : 0.89));
    return encodeWav(norm, 44100);
  }

  $("exportWav").addEventListener("click", async () => {
    setPet("generating", "Mixing & mastering your WAV…");
    const wav = await renderMix();
    const blob = new Blob([wav], { type: "audio/wav" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = exportFilename($("exportName").value || "vocals-song", state.aiUsed, "wav");
    a.click(); URL.revokeObjectURL(a.href);
    $("mixStatus").textContent = `WAV exported as ${a.download}${state.aiUsed ? " (AI-generated disclosure in filename)" : ""}.`;
    setPet("done", "Song exported!");
  });

  // Browser-format recording (MP4/WebM — labelled honestly by actual mimeType)
  $("recordExport").addEventListener("click", async () => {
    const ctx = audioCtx();
    const dest = ctx.createMediaStreamDestination();
    const canvas = $("viz");
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const ext = rec.mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: rec.mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportFilename($("exportName").value || "vocals-song", state.aiUsed, ext);
      a.click(); URL.revokeObjectURL(a.href);
      $("mixStatus").textContent = `Recorded export saved as ${a.download} (browser format: ${rec.mimeType}).`;
      setPet("done", "Recording exported!");
    };
    const pattern = currentPattern();
    rec.start();
    setPet("recording", "Recording beat + visuals…");
    const dur = scheduleBeat(ctx, dest, pattern, ctx.currentTime + 0.05);
    scheduleBeat(ctx, ctx.destination, pattern, ctx.currentTime + 0.05);
    setTimeout(() => rec.stop(), dur * 1000 + 300);
  });

  refreshGate();
  setPet("idle", "Hi! I'm your studio pet — let's make a song.");
}
