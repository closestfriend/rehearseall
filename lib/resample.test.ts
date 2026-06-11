import { describe, it, expect } from 'vitest';
import { createResampler } from './resample';

const ramp = (n: number, start = 0) =>
  Float32Array.from({ length: n }, (_, i) => start + i);

describe('createResampler', () => {
  it('returns input unchanged when rates match', () => {
    const resample = createResampler(16000, 16000);
    const input = ramp(512);
    expect(resample(input)).toBe(input);
  });

  it('produces 1/3 the samples for 48k -> 16k', () => {
    const resample = createResampler(48000, 16000);
    const out = resample(ramp(480));
    expect(out.length).toBe(160);
  });

  it('preserves a constant signal', () => {
    const resample = createResampler(48000, 16000);
    const out = resample(Float32Array.from({ length: 480 }, () => 0.5));
    for (const s of out) expect(s).toBeCloseTo(0.5, 6);
  });

  it('is continuous across chunk boundaries (chunked === one-shot)', () => {
    const whole = createResampler(48000, 16000)(ramp(960));
    const chunked = createResampler(48000, 16000);
    const a = chunked(ramp(480));
    const b = chunked(ramp(480, 480));
    const joined = Float32Array.from([...a, ...b]);
    expect(joined.length).toBe(whole.length);
    for (let i = 0; i < whole.length; i++) {
      expect(joined[i]).toBeCloseTo(whole[i], 4);
    }
  });

  it('handles non-integer ratios (44.1k -> 16k) without drift', () => {
    const resample = createResampler(44100, 16000);
    let total = 0;
    for (let c = 0; c < 100; c++) total += resample(ramp(441, c * 441)).length;
    // 100 chunks * 441 samples = 1s of audio -> ~16000 output samples
    expect(Math.abs(total - 16000)).toBeLessThanOrEqual(2);
  });
});
