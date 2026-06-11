import { createResampler } from './resample';

// The worklet runs in AudioWorkletGlobalScope where `sampleRate` is a global
// holding the actual context rate. iOS Safari often ignores the requested
// 16kHz and runs at 48kHz — the embedded resampler guarantees the PCM we
// post (and ultimately send to the Live API as rate=16000) really is 16kHz.
// Linear interpolation without an anti-alias filter is a deliberate tradeoff:
// speech for ASR tolerates the aliased HF content, and a proper filter would
// be far more code on the realtime audio thread.
export const audioWorkletCode = `
const createResampler = ${createResampler.toString()};
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 512;
    this.buffer = new Float32Array(this.chunkSize);
    this.bytesWritten = 0;
    this.resample = createResampler(sampleRate, 16000);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const samples = this.resample(input[0]);
      for (let i = 0; i < samples.length; i++) {
        this.buffer[this.bytesWritten++] = samples[i];
        if (this.bytesWritten >= this.chunkSize) {
          this.flush();
        }
      }
    }
    return true;
  }

  flush() {
    const pcm16 = new Int16Array(this.chunkSize);
    for (let i = 0; i < this.chunkSize; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage(pcm16);
    this.bytesWritten = 0;
  }
}
registerProcessor('recorder-worklet', RecorderProcessor);
`;

export function base64Encode(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
