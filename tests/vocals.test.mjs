import test from "node:test";
import assert from "node:assert/strict";
import { applyPronunciation, parsePronunciation, generateBeatPattern, encodeWav, normalizeSamples, mixGainPan, canCloneOrExport, exportFilename, noteToFreq } from "../app.js";

test("pronunciation dictionary applies whole words", () => {
  const dict = parsePronunciation("Gravion=gray-vee-on\nAPI=ay-pee-eye");
  assert.equal(applyPronunciation("Gravion API rocks", dict), "Gray-vee-on Ay-pee-eye rocks");
  assert.equal(applyPronunciation("nothing here", dict), "nothing here");
});

test("beat pattern is deterministic per seed", () => {
  const a = generateBeatPattern({ seed: "forge-1", mood: "chill", genre: "lofi", bpm: 90, key: "C" });
  const b = generateBeatPattern({ seed: "forge-1", mood: "chill", genre: "lofi", bpm: 90, key: "C" });
  assert.deepEqual(a, b);
  assert.equal(a.totalSteps, 64);
  assert.ok(a.drums.kick.length > 0 && a.bass.length > 0 && a.chords.length === 4);
});

test("beat pattern differs by genre and key shifts root", () => {
  const trap = generateBeatPattern({ seed: 7, genre: "trap", key: "C" });
  const pop = generateBeatPattern({ seed: 7, genre: "pop", key: "C" });
  assert.notDeepEqual(trap.drums, pop.drums);
  const g = generateBeatPattern({ seed: 7, genre: "pop", key: "G" });
  assert.equal(g.bass[0].note - pop.bass[0].note, 7);
});

test("WAV encoding writes a valid RIFF header", () => {
  const wav = encodeWav([new Float32Array([0, 0.5, -0.5]), new Float32Array([0, 0.25, -0.25])], 44100);
  const s = String.fromCharCode(...wav.slice(0, 4));
  assert.equal(s, "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(wav.length, 44 + 3 * 2 * 2);
});

test("normalize and gain/pan math", () => {
  const n = normalizeSamples(new Float32Array([0.1, -0.2]), 0.9);
  assert.ok(Math.abs(Math.max(...n.map(Math.abs)) - 0.9) < 1e-6);
  const [l, r] = mixGainPan(1, 1, 1, -1);
  assert.ok(l > 0.99 && r < 0.01);
  const [l2, r2] = mixGainPan(1, 1, 0.5, 0);
  assert.ok(Math.abs(l2 - r2) < 1e-9);
});

test("consent gating and AI disclosure filename", () => {
  assert.equal(canCloneOrExport({ consent: false, hasText: true }), false);
  assert.equal(canCloneOrExport({ consent: true, hasText: false }), false);
  assert.equal(canCloneOrExport({ consent: true, hasText: true }), true);
  assert.equal(exportFilename("My Song!", true, "wav"), "my-song-ai-generated.wav");
  assert.equal(exportFilename("My Song!", false, "wav"), "my-song.wav");
});

test("noteToFreq A4 = 440", () => {
  assert.equal(noteToFreq(69), 440);
});
