import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrainReply, HostTurn } from '../mcp/hostBrain';

// A stand-in for Alexa+: this page is a real MCP client of the RehearseAll server
// (initialize, tools/list, tools/call, resources/read over Streamable HTTP). The "brain"
// deciding which tool to call is an LLM proxy for Alexa+'s own reasoning; see mcp/hostBrain.ts.
const MCP_URL = import.meta.env.VITE_MCP_URL ?? 'http://localhost:8787/mcp';
const BRAIN_URL = import.meta.env.VITE_BRAIN_URL ?? 'http://localhost:8787/host/brain';
const UI_PROTOCOL = '2026-01-26';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const stage = $<HTMLDivElement>('#stage');
const banner = $<HTMLDivElement>('#banner');
const statusEl = $<HTMLDivElement>('#status');
const ring = $<HTMLDivElement>('#ring');
const mic = $<HTMLButtonElement>('#mic');
const textInput = $<HTMLInputElement>('#text');
const card = $<HTMLDivElement>('#card');
const cardFrame = $<HTMLIFrameElement>('#card-frame');
const logEl = $<HTMLOListElement>('#log');
const voiceToggle = $<HTMLInputElement>('#voice');
const handsFree = $<HTMLInputElement>('#handsfree');

// ---------- inspector ----------
type LogKind = 'out' | 'in' | 'brain' | 'ui' | 'error';
const ARROWS: Record<LogKind, string> = { out: '→', in: '←', brain: '◆', ui: '▣', error: '!' };

function logEntry(kind: LogKind, method: string, meta: string, payload: unknown) {
  const li = document.createElement('li');
  li.className = kind;
  li.innerHTML = `<div class="line"><span class="dir">${ARROWS[kind]}</span><span class="method"></span><span class="meta"></span></div><pre></pre>`;
  li.querySelector('.method')!.textContent = method;
  li.querySelector('.meta')!.textContent = meta;
  li.querySelector('pre')!.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  li.addEventListener('click', () => li.classList.toggle('open'));
  logEl.append(li);
  logEl.scrollTop = logEl.scrollHeight;
}

/** Wraps fetch so every JSON-RPC request/response the MCP SDK sends shows up in the inspector. */
const loggingFetch: typeof fetch = async (input, init) => {
  const started = performance.now();
  let body: any;
  try { body = init?.body ? JSON.parse(String(init.body)) : undefined; } catch { body = init?.body; }
  const label = `${body?.method ?? init?.method ?? 'GET'}${body?.method === 'tools/call' ? ` ${body.params?.name}` : ''}`;
  logEntry('out', label, '', body ?? '(no body)');
  const res = await fetch(input, init);
  const ms = Math.round(performance.now() - started);
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    res.clone().json()
      .then(j => logEntry(j.error || j.result?.isError ? 'error' : 'in', label, `${res.status} · ${ms} ms`, j))
      .catch(() => {});
  } else if (init?.method === 'GET' && res.status === 405) {
    logEntry('in', 'GET · optional push stream declined', `${res.status} · stateless server`, '(no body)');
  } else {
    logEntry('in', label, `${res.status} · ${ms} ms`, '(no body)');
  }
  return res;
};

// ---------- MCP client ----------
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: loggingFetch });
const client = new Client(
  { name: 'alexa-plus-simulator', title: 'Alexa+ (simulated host)', version: '0.1.0' },
  // Advertise MCP Apps support so servers know ui:// views will be rendered.
  { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } as any },
);
let tools: Tool[] = [];
let serverInstructions: string | undefined;
const views = new Map<string, string>();

async function connect() {
  try {
    await client.connect(transport);
    tools = (await client.listTools()).tools;
    serverInstructions = client.getInstructions();
    const info = client.getServerVersion();
    statusEl.textContent = `Connected · ${info?.title ?? info?.name} ${info?.version ?? ''} · MCP ${transport.protocolVersion ?? '2025-11-25'} · ${tools.length} tools`;
    statusEl.className = 'status ok';
  } catch (err) {
    statusEl.textContent = 'MCP server offline: run npm run mcp';
    statusEl.className = 'status err';
    bubble('err', `Could not reach the RehearseAll MCP server at ${MCP_URL}. ${String(err)}`);
  }
}

function resourceUriFor(toolName: string): string | undefined {
  const meta = tools.find(t => t.name === toolName)?._meta as any;
  return meta?.ui?.resourceUri ?? meta?.['ui/resourceUri'];
}

async function viewHtml(uri: string): Promise<string> {
  if (!views.has(uri)) {
    const res = await client.readResource({ uri });
    const first = res.contents[0] as { text?: string };
    views.set(uri, first.text ?? '');
  }
  return views.get(uri)!;
}

// ---------- MCP Apps bridge (minimal host side) ----------
let cardPayload: { args: Record<string, unknown>; result: CallToolResult } | null = null;

async function showCard(toolName: string, args: Record<string, unknown>, result: CallToolResult) {
  const uri = resourceUriFor(toolName);
  if (!uri) return;
  cardPayload = { args, result };
  cardFrame.srcdoc = await viewHtml(uri);
  card.hidden = false;
}

window.addEventListener('message', e => {
  if (e.source !== cardFrame.contentWindow) return;
  const m = e.data;
  if (!m || m.jsonrpc !== '2.0') return;
  const post = (msg: unknown) => cardFrame.contentWindow!.postMessage(msg, '*');
  logEntry('ui', `view → ${m.method ?? 'response'}`, 'MCP Apps', m);
  if (m.method === 'ui/initialize' && m.id != null) {
    post({ jsonrpc: '2.0', id: m.id, result: {
      protocolVersion: UI_PROTOCOL,
      hostInfo: { name: 'alexa-plus-simulator', version: '0.1.0' },
      hostCapabilities: {},
      hostContext: { theme: 'dark', displayMode: 'inline', platform: 'web' },
    } });
  } else if (m.method === 'ui/notifications/initialized' && cardPayload) {
    post({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: cardPayload.args } });
    post({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: cardPayload.result });
    logEntry('ui', 'host → ui/notifications/tool-result', 'MCP Apps', cardPayload.result.structuredContent ?? {});
  }
});
$('#card-close').addEventListener('click', () => {
  card.hidden = true;
  if (handsFree.checked && !busy && !recognizer && !userStopped) {
    startListening();
  }
});

// ---------- voice ----------
const synth = window.speechSynthesis;
let alexaVoice: SpeechSynthesisVoice | undefined;
let themVoice: SpeechSynthesisVoice | undefined;

function chooseVoices() {
  const all = synth.getVoices().filter(v => v.lang.startsWith('en'));
  const find = (names: string[], not?: SpeechSynthesisVoice) =>
    names.map(n => all.find(v => v.name.includes(n) && v !== not)).find(Boolean) ?? all.find(v => v !== not);
  alexaVoice = find(['Samantha', 'Google US English', 'Aria', 'Allison', 'Ava']);
  themVoice = find(['Daniel', 'Google UK English Male', 'Guy', 'Aaron', 'Tom', 'Fred'], alexaVoice);
}
synth.addEventListener?.('voiceschanged', chooseVoices);
chooseVoices();

function say(text: string, who: 'alexa' | 'them'): Promise<void> {
  if (!voiceToggle.checked) return Promise.resolve();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = (who === 'alexa' ? alexaVoice : themVoice) ?? null;
    u.rate = who === 'alexa' ? 1.04 : 0.98;
    // Some browsers never fire onend; never let a stuck utterance freeze the conversation.
    const fallback = setTimeout(resolve, 2000 + text.length * 90);
    u.onend = () => { clearTimeout(fallback); resolve(); };
    u.onerror = () => { clearTimeout(fallback); resolve(); };
    synth.speak(u);
  });
}

const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
let recognizer: any = null;
let userStopped = false;

function startListening() {
  if (!Recognition || recognizer || busy) return;
  recognizer = new Recognition();
  recognizer.lang = 'en-US';
  recognizer.interimResults = true;
  recognizer.continuous = false;
  let finalText = '';
  recognizer.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    textInput.value = finalText || interim;
  };
  recognizer.onend = () => {
    recognizer = null;
    mic.classList.remove('listening');
    setRing('');
    const said = finalText.trim();
    textInput.value = '';
    if (said) {
      void handleUtterance(said);
    } else if (handsFree.checked && !userStopped && !busy) {
      // Re-arm so a short pause before speaking does not disable hands-free
      setTimeout(() => {
        if (!recognizer && !busy && handsFree.checked && !userStopped) {
          startListening();
        }
      }, 400);
    }
  };
  recognizer.onerror = () => { /* onend still fires */ };
  mic.classList.add('listening');
  setRing('listening');
  recognizer.start();
}

mic.addEventListener('click', () => {
  if (recognizer) {
    userStopped = true;
    recognizer.stop();
  } else {
    userStopped = false;
    synth.cancel();
    startListening();
  }
});
if (!Recognition) {
  mic.disabled = true;
  mic.title = 'Voice input needs Chrome. Type instead.';
  handsFree.checked = false;
}

// ---------- conversation ----------
const turns: HostTurn[] = [];
let active: { id: string; title: string } | null = null;
let busy = false;

function setRing(state: '' | 'listening' | 'thinking') {
  ring.className = `bezel-light ${state}`;
}

function bubble(kind: 'you' | 'alexa' | 'them' | 'err', text: string, interim = false) {
  stage.querySelector('.empty')?.remove();
  const el = document.createElement('div');
  el.className = `msg ${kind}${interim ? ' interim' : ''}`;
  const who = { you: 'You', alexa: 'Alexa', them: active ? 'In the rehearsal' : 'Counterpart', err: 'Error' }[kind];
  el.innerHTML = `<span class="who"></span><span class="text"></span>`;
  el.querySelector('.who')!.textContent = who;
  el.querySelector('.text')!.textContent = text;
  stage.append(el);
  stage.scrollTop = stage.scrollHeight;
}

function updateBanner(exchange?: number, suggestFinish?: boolean) {
  if (!active) { banner.hidden = true; return; }
  banner.hidden = false;
  const hint = suggestFinish ? 'Good stopping point: say “how did I do?”' : 'Say “how did I do?” when you’re done';
  banner.innerHTML = `Rehearsing <b></b> · exchange ${exchange ?? 0} · ${hint}`;
  banner.querySelector('b')!.textContent = active.title;
}

async function askBrain(): Promise<BrainReply> {
  const body = {
    turns,
    tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    serverInstructions,
    activeSessionId: active?.id ?? null,
  };
  const started = performance.now();
  const res = await fetch(BRAIN_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const reply = await res.json();
  const ms = Math.round(performance.now() - started);
  if (!res.ok) throw new Error(reply.error ?? `host brain ${res.status}`);
  logEntry('brain', reply.type === 'tool_call' ? `decide → ${reply.name}` : 'decide → speak', `${ms} ms`, reply);
  return reply as BrainReply;
}

function textOf(result: CallToolResult): string {
  return result.content.map(c => (c.type === 'text' ? c.text : '')).join(' ').trim();
}

async function handleUtterance(text: string) {
  if (busy || !text.trim()) return;
  busy = true;
  userStopped = false;
  mic.disabled = true;
  setRing('thinking');
  bubble('you', text);
  turns.push({ role: 'user', text });
  try {
    for (let step = 0; step < 5; step++) {
      const reply = await askBrain();
      if (reply.type === 'speak') {
        turns.push({ role: 'assistant', text: reply.text });
        bubble('alexa', reply.text);
        await say(reply.text, 'alexa');
        break;
      }

      turns.push({ role: 'assistant', toolCall: { id: reply.id, name: reply.name, args: reply.args }, opaque: reply.opaque });
      if (reply.name === 'finish_rehearsal') {
        // Scoring is slower than a conversational turn; Alexa's guidance is to say so.
        const hold = 'One moment while I score that.';
        bubble('alexa', hold, true);
        void say(hold, 'alexa');
      }
      const result = (await client.callTool({ name: reply.name, arguments: reply.args })) as CallToolResult;
      const data = result.structuredContent as Record<string, any> | undefined;
      turns.push({ role: 'tool', toolCallId: reply.id, name: reply.name, result: data ?? textOf(result) });
      if (result.isError) continue; // let the host explain or recover

      if (reply.name === 'start_rehearsal' || reply.name === 'say_to_counterpart') {
        // Starting or advancing a rehearsal dismisses any previous card
        card.hidden = true;
      }

      await showCard(reply.name, reply.args, result);

      if (data?.counterpart_line) {
        if (reply.name === 'start_rehearsal') active = { id: data.session_id, title: data.title };
        updateBanner(data.exchange, data.suggest_finish);
        // Real Alexa+ would voice this itself. The simulated host relays it verbatim, in a second voice.
        turns.push({ role: 'assistant', text: `[Spoken in the counterpart's voice] ${data.counterpart_line}` });
        bubble('them', data.counterpart_line);
        await say(data.counterpart_line, 'them');
        break;
      }
      if (reply.name === 'finish_rehearsal') {
        active = null;
        updateBanner();
      }
    }
  } catch (err) {
    bubble('err', err instanceof Error ? err.message : String(err));
  } finally {
    busy = false;
    mic.disabled = !Recognition;
    setRing('');
    if (handsFree.checked && !userStopped) {
      setTimeout(() => {
        if (!busy && !recognizer && handsFree.checked && !userStopped) {
          startListening();
        }
      }, 500);
    }
  }
}

$<HTMLFormElement>('#say').addEventListener('submit', e => {
  e.preventDefault();
  const text = textInput.value;
  textInput.value = '';
  void handleUtterance(text);
});
$('#chips').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (b) void handleUtterance(b.textContent ?? '');
});

stage.innerHTML = `<div class="empty"><h2>Rehearse the conversation before you have it.</h2>
  Try “Alexa, help me practice asking for a raise,” or describe any hard conversation.
  The other person is played by the RehearseAll add-on; you get scored on the skills it trains.</div>`;
void connect();
