// Scans the built client bundle for material that must never ship:
// the Gemini API key (or its env-var name) and server-side prompt text.
// Spec: docs/superpowers/specs/2026-07-11-billing-and-variants-design.md §9.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;

const FORBIDDEN = [
  { name: 'Gemini API key', pattern: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: 'old client key env name', pattern: /VITE_GEMINI_API_KEY/ },
  // Sentinels for the two server-side prompt bodies (persona fragment + evaluator):
  { name: 'persona fragment text', pattern: /evidence-driven interviewer/ },
  { name: 'evaluator prompt text', pattern: /ACCOUNT FOR TRANSCRIPTION ARTIFACTS/ },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let failed = false;
for (const file of walk(DIST)) {
  const text = readFileSync(file, 'latin1');
  for (const { name, pattern } of FORBIDDEN) {
    if (pattern.test(text)) {
      console.error(`LEAK: ${name} found in ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('check-bundle: clean — no key or prompt material in dist/');
