// Starts the RehearseAll MCP server and the simulated Alexa+ host together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npx', ['tsx', 'mcp/http.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite', '--config', 'simulator/vite.config.ts', '--open'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', code => { if (code) stop(); });
