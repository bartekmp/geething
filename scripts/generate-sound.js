// Generates src/sounds/default.wav — a short two-tone notification chime.
// Re-run after editing tone parameters: `node scripts/generate-sound.js`.

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/sounds/default.wav');

const sampleRate = 44100;
const duration = 1.0;
const tailFade = 0.08; // seconds of linear ramp to zero at the end
const numSamples = Math.floor(sampleRate * duration);
const samples = new Int16Array(numSamples);

// One sine tone with a quick attack and exponential decay.
function tone(t, freq, attack, decay) {
  if (t < 0) return 0;
  const env = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
  return env * Math.sin(2 * Math.PI * freq * t);
}

// Two tones: A5 (880 Hz) and E6 (≈1318.5 Hz, a fifth above), the second
// offset by 120 ms to give a "ping → pong" chime feel. Longer decays so the
// tail rings out naturally instead of getting chopped off.
const tailStart = duration - tailFade;
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  let v = 0;
  v += 0.55 * tone(t, 880, 0.005, 0.18);
  v += 0.45 * tone(t - 0.12, 1318.51, 0.005, 0.55);
  if (t > tailStart) {
    v *= Math.max(0, (duration - t) / tailFade);
  }
  v = Math.max(-1, Math.min(1, v));
  samples[i] = Math.round(v * 30000);
}

// PCM 16-bit mono WAV header.
const dataBytes = samples.byteLength;
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(dataBytes, 40);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, Buffer.from(samples.buffer)]));
console.log(`Wrote ${OUT} (${44 + dataBytes} bytes, ${duration.toFixed(2)}s)`);
