import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The simulated Alexa+ host: a plain web page that is a real MCP client of the RehearseAll server.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { port: 5180, strictPort: true },
  build: { outDir: fileURLToPath(new URL('../dist-simulator', import.meta.url)), emptyOutDir: true },
});
