// Streaming linear-interpolation resampler.
// Returned function is stateful: it carries the fractional read position and
// the last input sample across calls, so chunked input produces the same
// output as one-shot input (no clicks or drift at chunk boundaries).
//
// CONSTRAINT: this function's source is embedded into the AudioWorklet code
// string via createResampler.toString() (see lib/audioWorklet.ts). It must
// stay self-contained — no imports, no outer-scope references, no backticks.
export function createResampler(
  fromRate: number,
  toRate: number
): (input: Float32Array) => Float32Array {
  if (fromRate === toRate) return (input) => input;
  const step = fromRate / toRate;
  let pos = 0;        // fractional read index into the current chunk
  let carry = 0;      // last sample of the previous chunk (for pos in (-1, 0))
  let hasCarry = false;
  return (input) => {
    const out: number[] = [];
    while (pos <= input.length - 1) {
      if (pos < 0) {
        const frac = pos + 1;
        out.push(hasCarry ? carry + (input[0] - carry) * frac : input[0]);
      } else {
        const i = Math.floor(pos);
        const frac = pos - i;
        const next = i + 1 < input.length ? input[i + 1] : input[i];
        out.push(input[i] + (next - input[i]) * frac);
      }
      pos += step;
    }
    if (input.length > 0) {
      pos -= input.length;
      carry = input[input.length - 1];
      hasCarry = true;
    }
    return Float32Array.from(out);
  };
}
