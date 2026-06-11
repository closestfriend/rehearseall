import { describe, it, expect } from 'vitest';
import { audioWorkletCode } from './audioWorklet';

function instantiate(contextRate: number) {
  const posted: Int16Array[] = [];
  class FakeAudioWorkletProcessor {
    port = { postMessage: (d: Int16Array) => posted.push(d) };
  }
  let ProcessorClass: any;
  const registerProcessor = (_name: string, cls: any) => { ProcessorClass = cls; };
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', audioWorkletCode)(
    FakeAudioWorkletProcessor, registerProcessor, contextRate
  );
  return { processor: new ProcessorClass(), posted };
}

describe('recorder worklet', () => {
  it('contains no backticks (createResampler.toString() embedding must stay clean)', () => {
    expect(audioWorkletCode).not.toContain('`');
  });

  it('posts 512-sample Int16 chunks at a 16kHz context (identity path)', () => {
    const { processor, posted } = instantiate(16000);
    const frame = Float32Array.from({ length: 128 }, () => 0.25);
    for (let i = 0; i < 8; i++) processor.process([[frame]]);
    expect(posted.length).toBe(2); // 8 * 128 = 1024 samples = 2 chunks
    expect(posted[0].length).toBe(512);
    expect(posted[0][0]).toBe(8191); // trunc(0.25 * 0x7fff) — Int16Array assignment truncates, not rounds
  });

  it('downsamples 3:1 at a 48kHz context', () => {
    const { processor, posted } = instantiate(48000);
    const frame = Float32Array.from({ length: 128 }, () => 0.25);
    // 36 * 128 = 4608 input samples -> 1536 output samples -> 3 chunks of 512
    for (let i = 0; i < 36; i++) processor.process([[frame]]);
    expect(posted.length).toBe(3);
    expect(posted[0].length).toBe(512);
  });

  it('downsamples at a fractional ratio (44.1kHz context)', () => {
    const { processor, posted } = instantiate(44100);
    const frame = Float32Array.from({ length: 128 }, () => 0.25);
    for (let i = 0; i < 100; i++) processor.process([[frame]]);
    // 12800 samples / 2.75625 ≈ 4644 outputs -> 9 full chunks of 512
    expect(posted.length).toBe(9);
    for (const chunk of posted) expect(chunk.length).toBe(512);
  });

  it('keeps running when the input is empty', () => {
    const { processor } = instantiate(48000);
    expect(processor.process([[]])).toBe(true);
  });
});
