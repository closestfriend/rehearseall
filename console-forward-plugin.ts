import type { Plugin } from 'vite';

const COLOR = {
  log:   '\x1b[36m',
  info:  '\x1b[32m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

export function consoleForwardPlugin(): Plugin {
  return {
    name: 'console-forward',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__console', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const { level, args, stack } = JSON.parse(body);
            const color = (COLOR as Record<string, string>)[level] ?? COLOR.log;
            // eslint-disable-next-line no-console
            console.log(`${color}[browser:${level}]${COLOR.reset}`, ...args);
            if (stack) console.log(`${COLOR.error}${stack}${COLOR.reset}`);
          } catch {
            // ignore malformed payloads
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
    transformIndexHtml() {
      const client = `
(function () {
  const safeStringify = (a) => {
    try {
      if (typeof a === 'string') return a;
      return JSON.stringify(a, (_, v) => v instanceof Error
        ? { name: v.name, message: v.message, stack: v.stack }
        : v);
    } catch { return String(a); }
  };
  const post = (level, args, stack) => {
    try {
      fetch('/__console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, args: args.map(safeStringify), stack }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args) => { post(level, args); orig(...args); };
  });
  window.addEventListener('error', (e) => post('error', [e.message], e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    post('error', ['Unhandled Promise Rejection:', (r && r.message) || String(r)], r && r.stack);
  });
})();`;
      return [{
        tag: 'script',
        attrs: { type: 'module' },
        children: client,
        injectTo: 'head-prepend',
      }];
    },
  };
}
