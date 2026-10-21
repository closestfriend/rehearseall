import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { GeminiRehearsalLLM, type RehearsalLLM } from './llm';
import { OpenRouterRehearsalLLM, openRouterBrain } from './openrouter';
import { createRehearsalServer } from './rehearsalServer';
import { FileStore } from './store';
import { geminiBrain, type BrainRequest, type HostBrain } from './hostBrain';

// Optional .env.local (a fresh clone may not have one; shell env vars work too).
const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const PORT = Number(process.env.MCP_PORT || 8787);
const USER_ID = process.env.REHEARSEALL_USER || 'demo';
const SIMULATOR_ORIGINS = (process.env.SIMULATOR_ORIGINS || 'http://localhost:5180,http://127.0.0.1:5180').split(',');
const ALLOWED_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`, ...(process.env.MCP_ALLOWED_HOSTS?.split(',') ?? [])];

// Same Gemini models either way; OpenRouter is just the gateway when its key is present.
const PROVIDER = process.env.REHEARSEALL_LLM ?? (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini');
const KEY = PROVIDER === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error(`No API key for provider "${PROVIDER}". Set ${PROVIDER === 'openrouter' ? 'OPENROUTER_API_KEY' : 'GEMINI_API_KEY'} in .env.local or the shell.`);
  process.exit(1);
}

const llm: RehearsalLLM = PROVIDER === 'openrouter' ? new OpenRouterRehearsalLLM(KEY) : new GeminiRehearsalLLM(KEY);
const brain: HostBrain = PROVIDER === 'openrouter' ? openRouterBrain(KEY) : geminiBrain(KEY);
const store = new FileStore(fileURLToPath(new URL('./.data/store.json', import.meta.url)));

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && SIMULATOR_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    // Stateless server: no standalone SSE stream (GET) and no sessions to delete.
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }
  // Stateless mode, per the SDK: a fresh server + transport per request; state lives in the store.
  const server = createRehearsalServer({ llm, store, userId: USER_ID });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: ALLOWED_HOSTS,
    allowedOrigins: SIMULATOR_ORIGINS,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, await readJson(req));
}

const http = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  try {
    if (path === '/mcp') return await handleMcp(req, res);
    if (path === '/host/brain' && req.method === 'POST') {
      return json(res, 200, await brain((await readJson(req)) as BrainRequest));
    }
    if (path === '/health') return json(res, 200, { ok: true, user: USER_ID, provider: PROVIDER });
    json(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(`[${path}]`, err);
    if (!res.headersSent) json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

http.listen(PORT, () => {
  console.log(`RehearseAll MCP server: http://localhost:${PORT}/mcp (Streamable HTTP, stateless)`);
  console.log(`Simulated Alexa+ host brain: http://localhost:${PORT}/host/brain (models via ${PROVIDER})`);
});
