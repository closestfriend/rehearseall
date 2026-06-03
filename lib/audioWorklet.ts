export const audioWorkletCode = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 512;
    this.buffer = new Float32Array(this.chunkSize);
    this.bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channel = input[0];
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bytesWritten++] = channel[i];
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
