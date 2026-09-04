import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';

const listenIndex = process.argv.indexOf('--listen');
const requestedPort = listenIndex >= 0 ? Number(process.argv[listenIndex + 1]) : Number(process.env.PORT || 3000);
const port = Number.isFinite(requestedPort) ? requestedPort : 3000;
const smoke = process.argv.includes('--smoke');

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
});
const { apiModuleForPath } = await vite.ssrLoadModule('/scripts/devServer.ts');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 2_000_000) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const modulePath = apiModuleForPath(url.pathname);
  if (!modulePath) {
    vite.middlewares(req, res);
    return;
  }

  try {
    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? await readJsonBody(req)
      : {};
    res.status = statusCode => {
      res.statusCode = statusCode;
      return res;
    };
    res.json = value => {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };

    const route = await vite.ssrLoadModule(modulePath);
    await route.default(req, res);
  } catch (error) {
    console.error('[local-dev-server]', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (!res.writableEnded) res.end(JSON.stringify({ error: { code: 'local_server_error', message: 'Local development server error.' } }));
  }
});

server.listen(port, '127.0.0.1', async () => {
  console.log(`RehearseAll ready at http://127.0.0.1:${port}`);
  if (smoke) {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(response => response.json());
    const home = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
    if (!health.ok || !health.hasKey || !home.includes('<div id="root"></div>')) {
      throw new Error('local smoke check failed');
    }
    console.log('Local UI + API smoke check passed');
    await vite.close();
    server.close();
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await vite.close();
    server.close(() => process.exit(0));
  });
}
