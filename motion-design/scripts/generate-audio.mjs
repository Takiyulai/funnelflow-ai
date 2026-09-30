import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectDir, 'public', 'audio');
const out = path.join(outDir, 'autofunnel-score.wav');
fs.mkdirSync(outDir, {recursive: true});

const sampleRate = 22050;
const duration = 45;
const count = sampleRate * duration;
const samples = new Float32Array(count);
const transitions = [5, 11, 18, 26, 33, 40];
const chords = [
  [110, 164.81, 220],
  [98, 146.83, 196],
  [130.81, 196, 261.63],
  [87.31, 130.81, 174.61],
];

let seed = 741239;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};
const smoothstep = (x) => Math.max(0, Math.min(1, x)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, x)));

for (let i = 0; i < count; i++) {
  const t = i / sampleRate;
  const chord = chords[Math.floor(t / 4) % chords.length];
  const globalFade = smoothstep(t / 1.3) * smoothstep((duration - t) / 1.8);
  let v = 0;

  for (let h = 0; h < chord.length; h++) {
    const f = chord[h];
    const drift = 0.18 * Math.sin(2 * Math.PI * (0.04 + h * 0.012) * t);
    v += Math.sin(2 * Math.PI * (f + drift) * t + h * 1.7) * (0.030 / (h + 1));
    v += Math.sin(2 * Math.PI * (f * 2.005) * t + h) * 0.007;
  }

  const pulsePhase = t % 1;
  if (pulsePhase < 0.18) {
    const env = Math.exp(-pulsePhase * 24);
    v += Math.sin(2 * Math.PI * (58 - pulsePhase * 80) * pulsePhase) * env * 0.065;
  }

  for (const marker of transitions) {
    const dt = t - marker;
    if (dt > -0.36 && dt < 0.1) {
      const p = (dt + 0.36) / 0.46;
      v += noise() * Math.sin(Math.PI * p) * (0.018 + p * 0.02);
    }
    if (dt >= 0 && dt < 1.2) {
      const env = Math.exp(-dt * 3.3);
      v += Math.sin(2 * Math.PI * 880 * dt) * env * 0.032;
      v += Math.sin(2 * Math.PI * 1320 * dt) * env * 0.014;
    }
  }

  const clickTimes = [13.5, 15.2, 23.0, 27.9, 34.0, 35.3, 36.6, 37.9];
  for (const click of clickTimes) {
    const dt = t - click;
    if (dt >= 0 && dt < 0.09) v += Math.sin(2 * Math.PI * 1450 * dt) * Math.exp(-dt * 58) * 0.055;
  }

  samples[i] = Math.max(-0.92, Math.min(0.92, v * globalFade));
}

const dataSize = samples.length * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
fs.writeFileSync(out, wav);
console.log(out);
